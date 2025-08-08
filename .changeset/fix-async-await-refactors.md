---
"@effect/language-service": patch
---

Fix async/await to Effect.gen.tryPromise and Effect.fn.tryPromise refactors to use Data.TaggedError for error handling instead of inline objects