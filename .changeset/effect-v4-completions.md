---
"@effect/language-service": minor
---

Add Effect v4 completions support

- Detect installed Effect version (v3 or v4) and conditionally enable version-specific completions
- Add `Schema.ErrorClass` and `Schema.RequestClass` completions for Effect v4
- Disable v3-only completions (`Effect.Service`, `Effect.Tag`, `Schema.TaggedError`, `Schema.TaggedClass`, `Schema.TaggedRequest`, `Context.Tag` self, `Rpc.make` classes, `Schema.brand`, `Model.Class`) when Effect v4 is detected
- Support lowercase `taggedEnum` in addition to `TaggedEnum` for v4 API compatibility
