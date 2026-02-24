## Push PR to GitHub workflow
This workflow should be initiated only if asked by the user.

### 1. Ensure current branch
- The remote origin/main branch is not writeable, so if there are changes on the main branch, create a new one and work over there

### 2. Preliminary TypeScript checks
The following steps can be skipped if no typescript file has been changed in this branch, do not attempt any file change without user consent.
- run "pnpm lint-fix" to fix code formatting
- run "pnpm check" to see if you should fix some type errors
- run "pnpm test" and "pnpm test:v4" to validate that changes did not broke anything.

### 3. Documentation checks
- if new diagnostics, completions or refactor are added, ensure they are already mentioned in the README.md. Ensure to read examples and test/__snapshots__ related to the change to ensure full understanding of whats changed
- If in the git changes against origin/main does not exists a new changeset file describing current changes, create a new one in the .changeset folder, the pattern is something like this:
```
---
"@effect/language-service": ${patchType}
---

Description of the change with examples
```

"${patchType}" should be replaced by "patch" if the PR contains only bugfixes or small changes; or "minor" if new diagnostics, refactors or features are added.

### 4. Pushing the PR to GitHub
If all the preliminary checks pass, ask the user if some specific issue should be referenced, gather info on the issue and then create a new github PR for the changes that:
- Provide a description of what changed, ensure to read examples and test/__snapshots__ related to the change to ensure full understanding of whats changed
- If the change involve refactors or diagnostic, provide an example of the feature added/changed
