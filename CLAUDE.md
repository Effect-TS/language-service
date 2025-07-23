## MANDATORY STEPS
- After any write to a TypeScript .ts file, run "pnpm lint-fix"

## Repo structure
- Tests for diagnostics are placed inside the examples/diagnostic folder, and the name should start with the rule name
  e.g. for rule "floatingEffect" the file name of the test should be either "floatingEffect.ts" or "floatingEffect_xxxx.ts" where xxxx is anything.

## PR
- The remote origin/main branch is not writeable, so anytime you are asked to push commits, ensure you are in a non-origin/main branch.
- Provide a description of what changed
- If the change involve refactors or diagnostic, provide an example of the feature added/changed
- Before pushing ensure:
  - Run "pnpm test" to ensure that all test passes
  - If in the git changes does not exists a new changeset file to be added, create a new one in the .changeset folder, the pattern is something like this:
  ```
---
"@effect/language-service": ${patchType}
---

Description of the change with examples
```
"${patchType}" should be replaced by "patch" if the PR contains only bugfixes or small changes; or "minor" if new diagnostics, refactors or features are added.

- If all checks pass, create a github PR
