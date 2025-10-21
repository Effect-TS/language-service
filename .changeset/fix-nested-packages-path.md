---
"@effect/language-service": patch
---

Fix nested project references relative paths in CLI diagnostics command

The CLI diagnostics command now correctly resolves paths for nested project references by:
- Using absolute paths when parsing tsconfig files
- Correctly resolving the base directory for relative paths in project references
- Processing files in batches to improve memory usage and prevent leaks
