---
"@effect/language-service": minor
---

Add `unknownInEffectCatch` diagnostic to warn when catch callbacks in `Effect.tryPromise`, `Effect.tryMap`, or `Effect.tryMapPromise` return `unknown` or `any` types. This helps ensure proper error typing by encouraging developers to wrap unknown errors into Effect's `Data.TaggedError` or narrow down the type to the specific error being raised.

Example:
```typescript
// ❌ Will trigger diagnostic
const program = Effect.tryPromise({
  try: () => fetch("http://something"),
  catch: (e) => e // returns unknown
})

// ✅ Proper typed error
class MyError extends Data.TaggedError("MyError")<{ cause: unknown }> {}

const program = Effect.tryPromise({
  try: () => fetch("http://something"),
  catch: (e) => new MyError({ cause: e })
})
```
