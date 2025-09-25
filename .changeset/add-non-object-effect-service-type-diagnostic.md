---
"@effect/language-service": minor
---

Add new diagnostic to warn when `Effect.Service` is used with a primitive type instead of an object type. This diagnostic helps prevent common mistakes where developers try to use primitive values (strings, numbers, etc.) as service types, which is not supported by `Effect.Service`. The diagnostic suggests wrapping the value in an object or manually using `Context.Tag` or `Effect.Tag` for primitive types.