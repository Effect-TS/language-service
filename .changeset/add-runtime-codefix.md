---
"@effect/language-service": patch
---

Add codefix to `runEffectInsideEffect` diagnostic that automatically transforms `Effect.run*` calls to use `Runtime.run*` when inside nested Effect contexts. The codefix will extract or reuse an existing Effect runtime and replace the direct Effect run call with the appropriate Runtime method.

Example:
```typescript
// Before
Effect.gen(function*() {
  websocket.onmessage = (event) => {
    Effect.runPromise(check)
  }
})

// After applying codefix
Effect.gen(function*() {
  const effectRuntime = yield* Effect.runtime<never>()

  websocket.onmessage = (event) => {
    Runtime.runPromise(effectRuntime, check)
  }
})
```
