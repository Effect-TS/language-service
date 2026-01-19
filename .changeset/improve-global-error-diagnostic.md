---
"@effect/language-service": minor
---

Improve `globalErrorInEffectFailure` diagnostic to detect global Error type in any Effect failure channel.

The diagnostic now works by finding `new Error()` expressions and checking if they end up in an Effect's failure channel, rather than only checking `Effect.fail` calls. This means it will now detect global Error usage in:

- `Effect.fail(new Error(...))`
- `Effect.gen` functions that fail with global Error
- `Effect.mapError` converting to global Error
- `Effect.flatMap` chains that include global Error

The diagnostic now reports at the `new Error()` location for better precision.
