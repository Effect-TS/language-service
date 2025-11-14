---
"@effect/language-service": minor
---

Add `codegen` CLI command to automatically update Effect codegens

This release introduces a new CLI command `effect-language-service codegen` that allows you to automatically update Effect codegens in your TypeScript files from the command line. The command scans files containing `@effect-codegens` directives and applies the necessary code transformations.

**Usage:**
- `effect-language-service codegen --file <path>` - Update a specific file
- `effect-language-service codegen --project <tsconfig.json>` - Update all files in a project
- `effect-language-service codegen --verbose` - Show detailed output during processing

**Example:**
```bash
# Update a single file
effect-language-service codegen --file src/MyService.ts

# Update entire project
effect-language-service codegen --project tsconfig.json --verbose
```

This is particularly useful for CI/CD pipelines or batch processing scenarios where you want to ensure all codegens are up-to-date without manual editor intervention.
