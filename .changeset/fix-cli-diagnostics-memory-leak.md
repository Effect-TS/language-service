---
"@effect/language-service": patch
---

Fix memory leak in CLI diagnostics by properly disposing language services when they change between batches.

The CLI diagnostics command now tracks the language service instance and disposes of it when a new instance is created, preventing memory accumulation during batch processing of large codebases.
