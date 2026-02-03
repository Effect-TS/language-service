---
"@effect/language-service": patch
---

Fix effectGenToFn refactor to convert `Effect<A, E, R>` return types to `Effect.fn.Return<A, E, R>`

Before this fix, the "Convert to fn" refactor would keep the original `Effect.Effect<A, E, R>` return type, producing code that doesn't compile. Now it correctly transforms the return type:

```ts
// Before refactor
const someFunction = (value: string): Effect.Effect<number, boolean> =>
  Effect.gen(function* () { /* ... */ })

// After refactor (fixed)
const someFunction = Effect.fn("someFunction")(function* (value: string): Effect.fn.Return<number, boolean, never> {
  /* ... */
})
```
