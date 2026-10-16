---
"@effect/language-service": patch
---

Update Effect v4 support to 4.0.5 and fix `runEffectInsideEffect`.

`Effect.runPromiseExit` and `Effect.runSyncExit` called inside an Effect are now reported, like `Effect.runPromise` and `Effect.runSync`:

```ts
export const program = Effect.gen(function*() {
  yield* Effect.void
  setTimeout(() => {
    Effect.runPromiseExit(child)
    // ^- now suggests Effect.runPromiseExitWith (v4) or Runtime.runPromiseExit (v3)
  }, 0)
})
```

The v4 quick fix now inserts `yield* Effect.context<never>()` instead of the removed `Effect.services`, and reuses an existing `yield* Effect.context()` binding:

```ts
export const program = Effect.gen(function*() {
  const context = yield* Effect.context<never>()
  const run = () => Effect.runSyncWith(context)(Effect.succeed(1))
  return [context, run()] as const
})
```
