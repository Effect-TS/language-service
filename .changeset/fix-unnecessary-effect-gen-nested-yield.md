---
"@effect/language-service": patch
---

Avoid suggesting removal of `Effect.gen` when a single return statement contains multiple `yield*` expressions, which would produce invalid code.
