import * as Effect from "effect/Effect"

// Bad: Arrow function with block body returning Effect.gen
export const arrowBlockGen = () => {
  return Effect.gen(function* () {
    yield* Effect.succeed(1)
    return 42
  })
}

// Bad: Arrow function with expression body returning Effect.gen
export const arrowExpressionGen = () =>
  Effect.gen(function* () {
    yield* Effect.succeed(1)
    return 42
  })

// Bad: Function expression returning Effect.gen
export const functionExpressionGen = function () {
  return Effect.gen(function* () {
    yield* Effect.succeed(1)
    return 42
  })
}

// Bad: Function declaration returning Effect.gen
export function functionDeclarationGen() {
  return Effect.gen(function* () {
    yield* Effect.succeed(1)
    return 42
  })
}

// Bad: With parameters - still can use Effect.fn
export const withParams = (a: number, b: string) =>
  Effect.gen(function* () {
    yield* Effect.log(`${a} ${b}`)
    return a
  })
