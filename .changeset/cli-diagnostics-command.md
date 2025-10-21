---
"@effect/language-service": minor
---

Add new `diagnostics` CLI command to check Effect-specific diagnostics for files or projects

The new `effect-language-service diagnostics` command provides a way to get Effect-specific diagnostics through the CLI without patching your TypeScript installation. It supports:
- `--file` option to get diagnostics for a specific file
- `--project` option with a tsconfig file to check an entire project

The command outputs diagnostics in the same format as the TypeScript compiler, showing errors, warnings, and messages with their locations and descriptions.
