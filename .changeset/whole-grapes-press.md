---
"@effect/language-service": minor
---

Add refactor to wrap an `Effect` expression with `Effect.gen`. This refactor identifies an `Effect` expression at the specified position and wraps it in an `Effect.gen` generator function. The original `Effect` expression is transformed into a `yield*` statement within the generator function, and the resulting generator function is returned as the new `Effect.gen` call.
