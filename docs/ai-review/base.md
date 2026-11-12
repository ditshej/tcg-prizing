<!-- rig-enforcement base 5. Do not edit; project points go into docs/ai-review/project.md. -->

# AI release review: base checklist

Review every change between the last release tag and the release commit.
Check the topics below and the points in `docs/ai-review/project.md`.

## Blocking findings

A finding blocks the release (`Status: blocked`) when it is one of these:

- **Security vulnerability:** injection (SQL, shell, template), XSS, a missing
  authentication or authorization check, mass assignment of protected fields,
  a CSRF gap, unsafe file upload, SSRF, open redirect, unsafe deserialization.
- **Secret or personal data exposed:** in the repository, in logs, in error
  pages or in API responses.
- **Data loss:** a destructive migration without a way back, deletes or
  overwrites without a guard, partial writes that leave broken data (missing
  transaction).
- **Clear behaviour bug:** the code does not do what the change says, breaks an
  existing feature, or fails on a normal path.

Everything else is a minor finding. Minor findings go into the note and become
issues; they do not hold the release.

## Topics

- **Clean code:** clear names, small units, no dead code, no duplication,
  follows the conventions of the project.
- **Security:** see above. All input validated (Form Requests), authorization
  through policies or gates, output escaped, rate limits on public endpoints.
- **Performance:** N+1 queries (eager loading), indexes for new queries,
  unbounded queries without pagination, slow work in the request that belongs
  in a queue.
- **Correctness:** edge cases, empty and null values, time zones, failure paths.
- **Tests:** new behaviour is covered by Pest tests that check behaviour, not
  implementation.
- **Migrations:** reversible and safe on existing data.
- **Static analysis:** every `@phpstan-ignore` names the error identifier and
  gives a reason. The baseline gets no new entries; a changed entry is the same
  error as before.
- **Dependencies:** every new package is needed and maintained.
- **Documentation:** `CLAUDE.md` and `docs/` follow changed project knowledge.

## Note format

The note on the release commit (`refs/notes/ai-review`) has exactly this form.
The `Status:` line is either `Status: pass` or `Status: blocked`.

```
AI review <version>
Commit: <full sha>
Range: <previous tag or "initial">..<short sha>
Model: <model id>
Date: <YYYY-MM-DD>
Status: pass

Blocking findings:
- none

Minor findings:
- <file:line> <finding> (issue: <link>)
```
