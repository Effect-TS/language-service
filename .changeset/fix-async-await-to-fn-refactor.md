---
"@effect/language-service": patch
---

Fix async/await to Effect.fn refactor to use correct function name

Previously, the refactor would incorrectly use the function's own name instead of `Effect.fn` when transforming async functions. This patch fixes the issue to properly generate `Effect.fn("functionName")` in the refactored code.