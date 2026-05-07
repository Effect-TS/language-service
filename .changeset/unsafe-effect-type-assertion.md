---
"@effect/language-service": minor
---

Add the `unsafeEffectTypeAssertion` diagnostic to catch `as Effect<...>` assertions that unsafely narrow the error or requirements channels.

The rule skips channels whose original type is `any` and offers a quick fix that removes the assertion while preserving the original expression.
