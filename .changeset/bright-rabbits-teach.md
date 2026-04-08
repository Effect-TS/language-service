---
"@effect/language-service": minor
---

Add the `nestedEffectGenYield` diagnostic to detect `yield* Effect.gen(...)` inside an existing Effect generator context.

Example:

```ts
Effect.gen(function*() {
  yield* Effect.gen(function*() {
    yield* Effect.succeed(1)
  })
})
```
