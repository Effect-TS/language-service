---
"@effect/language-service": patch
---

Handle unnecessary Effect.gen even when yielded expression is not returned

```ts
export const shouldRaiseForSingle = Effect.gen(function*() {
  yield* Effect.succeed(42)
})
// ^- this will become Effect.asVoid(Effect.succeed(42))

export const shouldRaiseForSingleReturnVoid = Effect.gen(function*() {
  yield* Effect.void
})
// ^- this will become Effect.void
```
