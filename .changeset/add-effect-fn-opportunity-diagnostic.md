---
"@effect/language-service": minor
---

Add `effectFnOpportunity` diagnostic that suggests converting functions returning `Effect.gen` to `Effect.fn` for better tracing and concise syntax.

The diagnostic triggers on:
- Arrow functions returning `Effect.gen(...)`
- Function expressions returning `Effect.gen(...)`
- Function declarations returning `Effect.gen(...)`
- Functions with `Effect.gen(...).pipe(...)` patterns

It provides two code fixes:
- Convert to `Effect.fn` (traced) - includes the function name as the span name
- Convert to `Effect.fnUntraced` - without tracing

The diagnostic skips:
- Generator functions (can't be converted)
- Named function expressions (typically used for recursion)
- Functions with multiple call signatures (overloads)

When the original function has a return type annotation, the converted function will use `Effect.fn.Return<A, E, R>` as the return type.

Example:
```ts
// Before
export const myFunction = (a: number) =>
  Effect.gen(function*() {
    yield* Effect.succeed(1)
    return a
  })

// After (with Effect.fn)
export const myFunction = Effect.fn("myFunction")(function*(a: number) {
  yield* Effect.succeed(1)
  return a
})

// Before (with pipe)
export const withPipe = () =>
  Effect.gen(function*() {
    return yield* Effect.succeed(1)
  }).pipe(Effect.withSpan("withPipe"))

// After (with Effect.fn)
export const withPipe = Effect.fn("withPipe")(function*() {
  return yield* Effect.succeed(1)
}, Effect.withSpan("withPipe"))
```
