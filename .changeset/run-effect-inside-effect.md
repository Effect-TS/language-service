---
"@effect/language-service": minor
---

Add `runEffectInsideEffect` diagnostic to warn when using `Effect.runSync`, `Effect.runPromise`, `Effect.runFork`, or `Effect.runCallback` inside an Effect context (such as `Effect.gen`, `Effect.fn`, or `Effect.fnUntraced`).

Running effects inside effects is generally not recommended as it breaks the composability of the Effect system. Instead, developers should extract the Runtime and use `Runtime.runSync`, `Runtime.runPromise`, etc., or restructure their code to avoid running effects inside effects.

Example:
```typescript
// ❌ Will trigger diagnostic
export const program = Effect.gen(function*() {
  const data = yield* Effect.succeed(42)
  const result = Effect.runSync(Effect.sync(() => data * 2)) // Not recommended
  return result
})

// ✅ Proper approach - extract runtime
export const program = Effect.gen(function*() {
  const data = yield* Effect.succeed(42)
  const runtime = yield* Effect.runtime()
  const result = Runtime.runSync(runtime)(Effect.sync(() => data * 2))
  return result
})

// ✅ Better approach - compose effects
export const program = Effect.gen(function*() {
  const data = yield* Effect.succeed(42)
  const result = yield* Effect.sync(() => data * 2)
  return result
})
```
