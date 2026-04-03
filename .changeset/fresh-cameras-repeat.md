---
"@effect/language-service": minor
---

Add the `lazyPromiseInEffectSync` diagnostic to catch `Effect.sync(() => Promise...)` patterns and suggest using `Effect.promise` or `Effect.tryPromise` for async work.

Example:

```ts
Effect.sync(() => Promise.resolve(1))
```
