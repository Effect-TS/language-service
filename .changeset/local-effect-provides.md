---
"@effect/language-service": patch
---

Ignore Effect v4 local `Effect.provide(..., { local: true })` calls when reporting chained provides with the `multipleEffectProvide` diagnostic.
