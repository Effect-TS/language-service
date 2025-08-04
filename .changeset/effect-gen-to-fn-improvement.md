---
"@effect/language-service": patch
---

Improve `effectGenToFn` refactor to preserve function names

The `effectGenToFn` refactor now extracts and preserves the original function name when converting from `Effect.gen` to `Effect.fn`. For example:

```typescript
// Before refactor
export const programWithPipes = (fa: number, fb: number) => Eff.gen(function*() {
  const a = yield* Eff.succeed(fa)
  const b = yield* Eff.succeed(fb)
  return a + b
}, Eff.map((a) => a + 1))

// After refactor (now preserves "programWithPipes" name)
export const programWithPipes = Eff.fn("programWithPipes")(function*(fa: number, fb: number) {
  const a = yield* Eff.succeed(fa)
  const b = yield* Eff.succeed(fb)
  return a + b
}, Eff.map((a) => a + 1))
```
