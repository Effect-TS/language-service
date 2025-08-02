---
"@effect/language-service": patch
---

Fix diagnostics not running for all source files in transform

Previously, diagnostics were only running on the current file being transformed instead of all root files in the TypeScript program. This could cause some diagnostics to be missed during compilation.

Also updated README with important notes about ts-patch limitations:
- Effect diagnostics in watch mode with noEmit enabled are not supported
- Incremental builds may require a full rebuild after enabling ts-patch to invalidate the previous diagnostics cache