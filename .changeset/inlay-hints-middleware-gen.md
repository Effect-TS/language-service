---
"@effect/language-service": minor
---

Add support for inlay hints in Effect.gen-like middleware functions

This feature provides TypeScript inlay hints for generator functions used with Effect.gen, Effect.fn.gen, and Effect.fn.untraced.gen. When enabled, it shows the inferred return type directly in the editor, making it easier to understand the types without hovering over the function.

Example:
```typescript
const myEffect = Effect.gen(function* () /* : Effect<number> */ {
  yield* Effect.succeed(42)
})
```