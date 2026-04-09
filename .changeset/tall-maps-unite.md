---
"@effect/language-service": patch
---

Refactor Effect context tracking to use cached node context flags and direct generator lookups.

This aligns the TypeScript implementation more closely with the TSGo version and simplifies diagnostics that need to detect whether code is inside an Effect generator.
