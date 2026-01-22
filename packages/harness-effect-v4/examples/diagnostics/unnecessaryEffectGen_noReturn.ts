import * as Effect from "effect/Effect"

export const shouldNotRant = Effect.gen(function*() {
  yield* Effect.succeed(true)
  yield* Effect.succeed(42)
})

export const shouldNotRaiseForNonEffect = Effect.gen(function*() {
  return 42
})

export const shouldRaiseForSingle = Effect.gen(function*() {
  yield* Effect.succeed(42)
})

export const shouldRaiseForSingleReturnVoid = Effect.gen(function*() {
  yield* Effect.void
})
