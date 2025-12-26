---
"@effect/language-service": patch
---

refactor: simplify `unnecessaryFailYieldableError` diagnostic implementation

Changed the implementation to check if a type extends `Cause.YieldableError` on-demand rather than fetching all yieldable error types upfront.
