import * as Effect from "effect/Effect"

// These should not trigger because they are not returning just Effect.gen,
// but also have other statements and there aren't at least 5 statements
// in the body of the function.

export const arrowMultipleReturns = () => {
  if (Math.random() > 0.5) return Effect.succeed(true)
  return Effect.gen(function*() {
    return yield* Effect.succeed(true)
  })
}

export const functionExpressionMultipleReturns = function() {
  if (Math.random() > 0.5) return Effect.succeed(true)
  return Effect.gen(function*() {
    return yield* Effect.succeed(true)
  })
}

export function functionDeclarationMultipleReturns() {
  if (Math.random() > 0.5) return Effect.succeed(true)
  return Effect.gen(function*() {
    return yield* Effect.succeed(true)
  })
}
