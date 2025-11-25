---
"@effect/language-service": minor
---

Add new `annotate` codegen that automatically adds type annotations to exported constants based on their initializer types. This codegen can be used by adding `// @effect-codegens annotate` comments above variable declarations.

Example:
```typescript
// @effect-codegens annotate
export const test = Effect.gen(function*() {
  if (Math.random() < 0.5) {
    return yield* Effect.fail("error")
  }
  return 1 as const
})
// Becomes:
// @effect-codegens annotate:5fce15f7af06d924
export const test: Effect.Effect<1, string, never> = Effect.gen(function*() {
  if (Math.random() < 0.5) {
    return yield* Effect.fail("error")
  }
  return 1 as const
})
```

The codegen automatically detects the type from the initializer and adds the appropriate type annotation, making code more explicit and type-safe.