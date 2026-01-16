---
"@effect/language-service": patch
---

Tone down `effectFnOpportunity` diagnostic to skip suggestions when function parameters are referenced inside pipe transformations. Converting such functions to `Effect.fn` would break the code since parameters would no longer be in scope for the pipe arguments.

```ts
// This no longer triggers the diagnostic because `a` and `b` are used in the pipe
export const shouldSkip = (a: number, b: string) => {
  return Effect.gen(function*() {
    yield* Effect.succeed(a)
    return b
  }).pipe(Effect.withSpan("withParameters", { attributes: { a, b } }))
}
```
