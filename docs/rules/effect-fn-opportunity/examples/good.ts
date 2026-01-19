import * as Effect from "effect/Effect"

// Good: Using Effect.fn with inferred span name
export const arrowBlockGen = Effect.fn("arrowBlockGen")(function* () {
  yield* Effect.succeed(1)
  return 42
})

// Good: Using Effect.fn without span (when tracing not needed)
export const arrowExpressionGen = Effect.fn(function* () {
  yield* Effect.succeed(1)
  return 42
})

// Good: Using Effect.fnUntraced for maximum performance
export const functionExpressionGen = Effect.fnUntraced(function* () {
  yield* Effect.succeed(1)
  return 42
})

// Good: Function declaration converted to const with Effect.fn
export const functionDeclarationGen = Effect.fn("functionDeclarationGen")(
  function* () {
    yield* Effect.succeed(1)
    return 42
  }
)

// Good: With parameters - Effect.fn preserves the signature
export const withParams = Effect.fn("withParams")(function* (
  a: number,
  b: string
) {
  yield* Effect.log(`${a} ${b}`)
  return a
})

// Good: With pipe transformations after the generator
export const withPipe = Effect.fn("withPipe")(
  function* () {
    yield* Effect.succeed(1)
    return 42
  },
  Effect.map((n) => n * 2)
)
