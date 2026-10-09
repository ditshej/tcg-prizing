#!/bin/sh
set -eu

# Runs on the server, inside the checkout. No composer, no migrations, no
# cache: the app has no packages, no database and no build step (ADR 0004).
# Rolling back is a `git revert` on the branch and another deploy (#22).

# Overridable via .env.deploy (passed through by deploy.sh over SSH).
BRANCH="${DEPLOY_BRANCH:-main}"

current_branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$current_branch" != "$BRANCH" ]; then
    echo "Deploy aborted: server is on branch '$current_branch', expected '$BRANCH'." >&2
    echo "Fix on the server with: git checkout $BRANCH" >&2
    exit 1
fi

if ! git -c core.fileMode=false diff-index --quiet HEAD --; then
    echo "Deploy aborted: uncommitted changes in the server working tree." >&2
    echo "Inspect on the server with: git status" >&2
    exit 1
fi

git pull --ff-only origin "$BRANCH"
