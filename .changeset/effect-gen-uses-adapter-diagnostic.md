---
"@effect/language-service": minor
---

Add new diagnostic: `effectGenUsesAdapter` - warns when using `Effect.gen` with the generator adapter pattern (function*(_)) instead of using `pipe()`

The generator adapter pattern `function*(_)` is an old pattern. Users should use `pipe()` for composing effects or `Effect.gen(function*())` without the adapter for generator-based code.

Example that will trigger the warning:
```ts
const example = Effect.gen(function*(_) {
  const result = yield* _(Effect.succeed(42))
  return result
})
```