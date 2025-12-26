---
"@effect/language-service": minor
---

Add `globalErrorInEffectFailure` diagnostic

This diagnostic warns when `Effect.fail` is called with the global `Error` type. Using the global `Error` type in Effect failures is not recommended as they can get merged together, making it harder to distinguish between different error types.

Instead, the diagnostic recommends using:
- Tagged errors with `Data.TaggedError`
- Custom error classes with a discriminator property (like `_tag`)

Example:
```ts
// This will trigger a warning
Effect.fail(new Error("global error"))

// These are recommended alternatives
Effect.fail(new CustomError()) // where CustomError extends Data.TaggedError
Effect.fail(new MyError()) // where MyError has a _tag property
```
