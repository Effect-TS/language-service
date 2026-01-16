---
"@effect/language-service": patch
---

Improved `missedPipeableOpportunity` diagnostic to check if callees are safe to use in pipes without losing `this` context.

The diagnostic now stops accumulating transformations when it encounters an unsafe callee (like method calls on class instances) and wraps the result with any remaining outer transformations.

Safe callees include:
- Property access on modules/namespaces (e.g., `Effect.map`)
- Standalone function identifiers
- Call expressions (already evaluated)
- Arrow functions and function expressions

Example - before this change, the diagnostic would incorrectly suggest:
```typescript
// Input
console.log(Effect.runPromise(Effect.ignore(Effect.log("Hello"))))

// Would produce (incorrect - loses console.log wrapper)
Effect.log("Hello").pipe(Effect.ignore, Effect.runPromise)
```

Now it correctly produces:
```typescript
// Input
console.log(Effect.runPromise(Effect.ignore(Effect.log("Hello"))))

// Output (correct - preserves console.log wrapper)
console.log(Effect.log("Hello").pipe(Effect.ignore, Effect.runPromise))
```
