---
"@effect/language-service": minor
---

Add `effectFnIife` diagnostic to warn when `Effect.fn` or `Effect.fnUntraced` is used as an IIFE (Immediately Invoked Function Expression).

`Effect.fn` is designed to create reusable functions that can take arguments and provide tracing. When used as an IIFE, `Effect.gen` is more appropriate.

**Example:**

```ts
// Before (triggers warning)
const result = Effect.fn("test")(function*() {
  yield* Effect.succeed(1)
})()

// After (using Effect.gen)
const result = Effect.gen(function*() {
  yield* Effect.succeed(1)
})
```

A quick fix is provided to automatically convert `Effect.fn` IIFEs to `Effect.gen`.
