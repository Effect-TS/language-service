## Development Workflow

### Core Principles
- **Research → Plan → Implement**: Never jump straight to coding
- **Reality Checkpoints**: Regularly validate progress and approach
- **Zero Tolerance for Errors**: All automated checks must pass
- **Clarity over Cleverness**: Choose clear, maintainable solutions

### Implementation Specifications
- **Specifications Directory**: `.specs/` contains detailed implementation plans and specifications for all features; may be worth looking into when researching how to implement something
- **Organization**: Each specification is organized by feature name (e.g., `creating-new-diagnostics`, `parsing-effects`)
- **Purpose**: Reference these specifications when implementing new features or understanding existing implementation plans

### Structured Development Process
1. **Research Phase**
   - Understand the codebase and existing patterns
   - Identify related modules and dependencies
   - Review test files and usage examples
   - Use multiple approaches for complex problems

2. **Planning Phase**
   - Create detailed implementation plan
   - Identify validation checkpoints
   - Consider edge cases and error handling
   - Validate plan before implementation

3. **Implementation Phase**
   - Execute with frequent validation
   - **🚨 CRITICAL**: IMMEDIATELY run `pnpm lint --fix <typescript_file.ts>` and `pnpm check` after editing ANY TypeScript file
   - Run automated checks at each step
   - Use parallel approaches when possible
   - Stop and reassess if stuck

4. **Note taking**
   - If during all previous phases, something took significant iterations to get right or lot of time to research, consider writing a specification file in the .specs folder that contains all the information you've found in a format that is easy searchable

## Push PR to GitHub workflow
This workflow should be initiated only if asked by the user.

### 1. Ensure current branch
- The remote origin/main branch is not writeable, so if there are changes on the main branch, create a new one and work over there

### 2. Preliminary TypeScript checks
The following steps can be skipped if no typescript file has been changed in this branch
- run "pnpm lint-fix" to fix code formatting
- run "pnpm check" to see if you should fix some type errors
- run "pnpm test" to validate that changes did not broke anything
- when you think that you have finished it all, remove from disk all the files from test/__snapshots__ folder and run "pnpm test". Look at the git changes in snapshot files and ensure that they are expected changes and there are no side effects.

### 3. Documentation checks
- if new diagnostics, completions or refactor are added, ensure they are already mentioned in the README.md. Ensure to read examples and test/__snapshots__ related to the change to ensure full understanding of whats changed
- If in the git changes does not exists a new changeset file to be added, create a new one in the .changeset folder, the patt<ern is something like this:
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
