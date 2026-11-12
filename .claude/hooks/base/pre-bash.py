#!/usr/bin/env python3
# rig-enforcement base 4. Do not edit; project rules go into
# .claude/hooks/project/pre-bash/.
#
# Claude Code PreToolUse hook for Bash. Blocks (exit 2, reason on stderr):
# - git identity changes (git config user.*, git -c user.*)
# - skipping or redirecting the git hooks (--no-verify, core.hooksPath)
# - commits and pushes to main/master
# - git tag v* and gh release create without an AI review note with
#   "Status: pass" on the release commit (refs/notes/ai-review)
# Then runs every executable in .claude/hooks/project/pre-bash/ with the same
# input; exit 2 there blocks as well.
import json
import os
import re
import shlex
import subprocess
import sys

PROTECTED = {"main", "master"}
NOTES_REF = "ai-review"
OPERATORS = {"&&", "||", ";", "|", "&", "\n", "(", ")", ";;", "|&"}
GIT_OPTS_WITH_VALUE = {"-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"}
TAG_OPTS_WITH_VALUE = {"-m", "--message", "-F", "--file", "-u", "--local-user", "--cleanup"}


def block(reason):
    print(f"Blocked by rig-enforcement: {reason}", file=sys.stderr)
    sys.exit(2)


def git(*args):
    result = subprocess.run(["git", *args], capture_output=True, text=True)
    return result.stdout.strip() if result.returncode == 0 else None


def split_commands(command):
    lexer = shlex.shlex(command.replace("\\\n", " "), posix=True, punctuation_chars=True)
    lexer.whitespace_split = True
    lexer.commenters = ""
    try:
        tokens = list(lexer)
    except ValueError:
        tokens = command.split()
    commands, current = [], []
    for token in tokens:
        if token in OPERATORS:
            if current:
                commands.append(current)
            current = []
        else:
            current.append(token)
    if current:
        commands.append(current)
    return commands


def strip_env(words):
    # Drops leading VAR=value assignments and wrappers like "env" or "command".
    while words and (re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", words[0]) or words[0] in {"env", "command", "exec", "sudo"}):
        words = words[1:]
    return words


def parse_git(words):
    # Returns (global options, subcommand, arguments) of a git call.
    i, options = 1, []
    while i < len(words) and words[i].startswith("-"):
        options.append(words[i])
        if words[i] in GIT_OPTS_WITH_VALUE and i + 1 < len(words):
            options.append(words[i + 1])
            i += 1
        i += 1
    if i >= len(words):
        return options, None, []
    return options, words[i], words[i + 1:]


def current_branch():
    return git("symbolic-ref", "--short", "-q", "HEAD")


def check_review(commit_ref, label):
    commit = git("rev-parse", "--verify", "-q", f"{commit_ref}^{{commit}}")
    if not commit:
        block(f"{label}: cannot resolve the release commit '{commit_ref}'.")
    note = git("notes", f"--ref={NOTES_REF}", "show", commit)
    if note is None:
        block(
            f"{label}: commit {commit[:12]} has no AI review. Run the release review "
            f"(rig-enforcement skill) and add the note to refs/notes/{NOTES_REF}. "
            f"If the review was done elsewhere: git fetch origin refs/notes/{NOTES_REF}:refs/notes/{NOTES_REF}"
        )
    status = re.search(r"^Status:\s*(\S+)\s*$", note, re.MULTILINE)
    if not status or status.group(1) != "pass":
        found = status.group(1) if status else "missing"
        block(f"{label}: the AI review of {commit[:12]} has status '{found}', not 'pass'. Fix the blocking findings in a pull request and review the new commit.")


def check_git(words):
    options, sub, args = parse_git(words)
    for i, opt in enumerate(options):
        if opt == "-c" and i + 1 < len(options):
            key = options[i + 1].lower()
        elif opt.startswith("-c"):
            key = opt[2:].lower()
        elif opt.startswith("--config-env="):
            key = opt.split("=", 1)[1].lower()
        else:
            continue
        if key.startswith("user."):
            block("do not set the git identity (git -c user.*). The configured identity must be used.")
        if key.startswith("core.hookspath"):
            block("do not change core.hooksPath. The rig-enforcement hooks must run.")
    if sub is None:
        return
    if sub == "config":
        keys = [a.lower() for a in args if not a.startswith("-")]
        unset = any(a.startswith("--unset") for a in args)
        reading = not unset and (any(a.startswith("--get") for a in args) or len(keys) == 1)
        if not reading and any(k.startswith("user.") for k in keys):
            block("do not set or override the git identity (git config user.*).")
        if not reading and "core.hookspath" in keys and (unset or keys[-1] != ".githooks/base"):
            block("core.hooksPath must stay .githooks/base. The rig-enforcement hooks must run.")
    if sub in {"commit", "push", "merge", "rebase", "cherry-pick", "am", "revert"} and "--no-verify" in args:
        block("do not skip the git hooks (--no-verify).")
    if sub == "commit":
        if skips_hooks(args):
            block("do not skip the git hooks (git commit -n).")
        if current_branch() in PROTECTED:
            block(f"do not commit on {current_branch()}. Create a branch and open a pull request.")
    if sub == "push":
        check_push(args)
    if sub == "tag":
        check_tag(args)


def skips_hooks(args):
    # Finds -n in short option groups of git commit, e.g. -an. Options that
    # take a value end the group (-m, -F, -C, -c, -t, -S, -u).
    skip_next = False
    for a in args:
        if skip_next:
            skip_next = False
            continue
        if a == "--" or not a.startswith("-") or a.startswith("--"):
            continue
        for i, ch in enumerate(a[1:]):
            if ch == "n":
                return True
            if ch in "mFCctSu":
                skip_next = ch in "mFCct" and i == len(a) - 2
                break
    return False


def check_push(args):
    positional = [a for a in args if not a.startswith("-")]
    refspecs = positional[1:]
    if any(a in {"--all", "--mirror"} for a in args):
        block("do not push all branches (--all/--mirror).")
    if not refspecs:
        if current_branch() in PROTECTED:
            block(f"do not push {current_branch()}. Push a branch and open a pull request.")
        return
    for spec in refspecs:
        target = spec.lstrip("+").split(":")[-1]
        if spec.lstrip("+") == "HEAD":
            target = current_branch() or ""
        target = target.removeprefix("refs/heads/")
        if target in PROTECTED:
            block(f"do not push to {target}. Push a branch and open a pull request.")


def check_tag(args):
    if any(a in {"-d", "--delete", "-l", "--list", "-v", "--verify"} for a in args):
        return
    positional, skip = [], False
    for a in args:
        if skip:
            skip = False
            continue
        if a in TAG_OPTS_WITH_VALUE:
            skip = True
            continue
        if a.startswith("-"):
            continue
        positional.append(a)
    if not positional or not positional[0].startswith("v"):
        return
    check_review(positional[1] if len(positional) > 1 else "HEAD", f"git tag {positional[0]}")


def check_gh(words):
    if words[1:3] != ["release", "create"]:
        return
    args = words[3:]
    tag = next((a for a in args if not a.startswith("-")), None)
    target = None
    for i, a in enumerate(args):
        if a == "--target" and i + 1 < len(args):
            target = args[i + 1]
        elif a.startswith("--target="):
            target = a.split("=", 1)[1]
    if tag and git("rev-parse", "--verify", "-q", f"refs/tags/{tag}"):
        ref = f"refs/tags/{tag}"
    elif target:
        ref = f"origin/{target}" if git("rev-parse", "--verify", "-q", f"origin/{target}") else target
    else:
        ref = git("symbolic-ref", "--short", "-q", "refs/remotes/origin/HEAD") or "origin/main"
    check_review(ref, f"gh release create {tag or ''}".strip())


def run_project_hooks(raw):
    folder = os.path.join(os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd()), ".claude", "hooks", "project", "pre-bash")
    if not os.path.isdir(folder):
        return
    for name in sorted(os.listdir(folder)):
        path = os.path.join(folder, name)
        if os.path.isfile(path) and os.access(path, os.X_OK):
            result = subprocess.run([path], input=raw, text=True)
            if result.returncode == 2:
                sys.exit(2)


def main():
    raw = sys.stdin.read()
    data = json.loads(raw)
    if os.path.isdir(data.get("cwd") or ""):
        os.chdir(data["cwd"])
    command = data.get("tool_input", {}).get("command", "")
    if "RIG_ALLOW_WORKFLOWS" in command:
        block("RIG_ALLOW_WORKFLOWS is for the user only. Put workflow changes into the pull request description.")
    for words in split_commands(command):
        words = strip_env(words)
        if not words:
            continue
        name = os.path.basename(words[0])
        if name == "git":
            check_git(words)
        elif name == "gh":
            check_gh(words)
    run_project_hooks(raw)


if __name__ == "__main__":
    main()
