---
"@effect/language-service": minor
---

Add new diagnostic `unnecessaryFailYieldableError` that warns when using `yield* Effect.fail()` with yieldable error types. The diagnostic suggests yielding the error directly instead of wrapping it with `Effect.fail()`, as yieldable errors (like `Data.TaggedError` and `Schema.TaggedError`) can be yielded directly in Effect generators.

Example:
```typescript
// ❌ Unnecessary Effect.fail wrapper
yield* Effect.fail(new DataTaggedError())

// ✅ Direct yield of yieldable error  
yield* new DataTaggedError()
```