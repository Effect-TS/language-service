---
"@effect/language-service": minor
---

Add `globalErrorInEffectCatch` diagnostic to detect global Error types in catch callbacks

This new diagnostic warns when catch callbacks in `Effect.tryPromise`, `Effect.try`, `Effect.tryMap`, or `Effect.tryMapPromise` return the global `Error` type instead of typed errors.

Using the global `Error` type in Effect failures is not recommended as they can get merged together, making it harder to distinguish between different error cases. Instead, it's better to use tagged errors (like `Data.TaggedError`) or custom errors with discriminator properties to enable proper type checking and error handling.

Example of code that triggers the diagnostic:
```typescript
Effect.tryPromise({
  try: () => fetch("http://example.com"),
  catch: () => new Error("Request failed") // ⚠️ Warning: returns global Error type
})
```

Recommended approach:
```typescript
class FetchError extends Data.TaggedError("FetchError")<{
  cause: unknown
}> {}

Effect.tryPromise({
  try: () => fetch("http://example.com"),
  catch: (e) => new FetchError({ cause: e }) // ✅ Uses typed error
})
```

This diagnostic also improves the clarity message for the `leakingRequirements` diagnostic by adding additional guidance on how services should be collected in the layer creation body.
