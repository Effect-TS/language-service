import * as Effect from "effect/Effect"

export const shouldNotRant = Effect.gen(function*() {
  yield* Effect.succeed(true)
  return yield* Effect.succeed(42)
})

export const shouldNotRaiseForNonEffect = Effect.gen(function*() {
  return 42
})

export const shouldRaiseForSingle = Effect.gen(function*() {
  return yield* Effect.succeed(42)
})
