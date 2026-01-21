import * as Effect from "effect/Effect"

export const isValid = Effect.gen(function*() {
  const x = yield* Effect.succeed(1)
  return x
})

// when the adapter usage is detected, warn
export const isNotValid = Effect.gen(function*(_) {
  const x = yield* Effect.succeed(1)
  return x
})
