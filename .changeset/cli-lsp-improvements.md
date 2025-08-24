---
"@effect/language-service": patch
---

Fix CLI and LSP improvements:
- Remove deprecated check command from CLI
- Fix unpatch command to default to both typescript and tsc modules when no modules specified
- Add concatDiagnostics utility to prevent duplicate diagnostics in LSP