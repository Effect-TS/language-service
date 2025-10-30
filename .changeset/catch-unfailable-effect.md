---
"@effect/language-service": minor
---

Add new diagnostic `catchUnfailableEffect` to warn when using catch functions on effects that never fail

This diagnostic detects when catch error handling functions are applied to effects that have a `never` error type (meaning they cannot fail). It supports all Effect catch variants:

- `Effect.catchAll`
- `Effect.catch`
- `Effect.catchIf`
- `Effect.catchSome`
- `Effect.catchTag`
- `Effect.catchTags`

Example:

```typescript
// Will trigger diagnostic
const example = Effect.succeed(42).pipe(
  Effect.catchAll(() => Effect.void) // <- Warns here
)

// Will not trigger diagnostic
const example2 = Effect.fail("error").pipe(
  Effect.catchAll(() => Effect.succeed(42))
)
```

The diagnostic works in both pipeable style (`Effect.succeed(x).pipe(Effect.catchAll(...))`) and data-first style (`pipe(Effect.succeed(x), Effect.catchAll(...))`), analyzing the error type at each position in the pipe chain.
