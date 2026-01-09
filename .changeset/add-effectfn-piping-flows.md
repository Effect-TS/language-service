---
"@effect/language-service": patch
---

Add `Effect.fn` and `Effect.fnUntraced` support to the piping flows parser.

The piping flows parser now recognizes pipe transformations passed as additional arguments to `Effect.fn`, `Effect.fn("traced")`, and `Effect.fnUntraced`. This enables diagnostics like `catchAllToMapError`, `catchUnfailableEffect`, and `multipleEffectProvide` to work with these patterns.

Example:
```ts
// This will now trigger the catchAllToMapError diagnostic
const example = Effect.fn(function*() {
  return yield* Effect.fail("error")
}, Effect.catchAll((cause) => Effect.fail(new MyError(cause))))
```
