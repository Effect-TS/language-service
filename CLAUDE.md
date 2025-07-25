## MANDATORY Validation workflow
This step should happen after any change to ensure they are valid.
- run "pnpm lint-fix" to fix code formatting
- run "pnpm check" to see if you should fix some type errors
- run "pnpm test" to validate that changes did not broke anything
- if new diagnostics, completions or refactor are added, ensure they are already mentioned in the README.md
- when you think that you have finished it all, drop all the files from test/__snapshots__ and run "pnpm test". Look at the git changes in snapshot files and ensure that they are expected changes and there are no side effects.

## Repo structure
- Tests for diagnostics are placed inside the examples/diagnostic folder, and the name should start with the rule name
  e.g. for rule "floatingEffect" the file name of the test should be either "floatingEffect.ts" or "floatingEffect_xxxx.ts" where xxxx is anything.

## PR
- The remote origin/main branch is not writeable, so anytime you are asked to push commits, ensure you are in a non-origin/main branch.
- Provide a description of what changed
- If the change involve refactors or diagnostic, provide an example of the feature added/changed
- Before pushing ensure:
  - The validation workflow MUST pass
  - If in the git changes does not exists a new changeset file to be added, create a new one in the .changeset folder, the pattern is something like this:
  ```
---
"@effect/language-service": ${patchType}
---

Description of the change with examples
```
"${patchType}" should be replaced by "patch" if the PR contains only bugfixes or small changes; or "minor" if new diagnostics, refactors or features are added.
If you end up creating a changeset, ask the user if it seems ok.

- If all checks pass, create a github PR
