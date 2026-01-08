---
"@effect/language-service": minor
---

Add `effectMapVoid` diagnostic that suggests using `Effect.asVoid` instead of `Effect.map(() => void 0)`, `Effect.map(() => undefined)`, or `Effect.map(() => {})`.

Also adds two new TypeParser utilities:
- `lazyExpression`: matches zero-argument arrow functions or function expressions that return a single expression
- `emptyFunction`: matches arrow functions or function expressions with an empty block body

And adds `isVoidExpression` utility to TypeScriptUtils for detecting `void 0` or `undefined` expressions.

Example:
```ts
// Before
Effect.succeed(1).pipe(Effect.map(() => void 0))
Effect.succeed(1).pipe(Effect.map(() => undefined))
Effect.succeed(1).pipe(Effect.map(() => {}))

// After (suggested fix)
Effect.succeed(1).pipe(Effect.asVoid)
```
