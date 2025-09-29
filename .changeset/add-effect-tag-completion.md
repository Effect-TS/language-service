---
"@effect/language-service": patch
---

Add Effect.Tag completion for classes extending Effect

When typing `Effect.` in a class that extends Effect, the completion now also suggests `Effect.Tag` alongside the existing `Effect.Service` completion. This provides an additional way to define tagged services using the Effect.Tag pattern.