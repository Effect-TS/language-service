import * as Effect from "effect/Effect"

// Non-generator Effect.fn with pipe transformations
export const effectFnNonGen = Effect.fn(
  () => Effect.succeed(42),
  Effect.map((x) => x + 1)
)

export const effectFnNonGenMultiple = Effect.fn(
  () => Effect.succeed(42),
  Effect.map((x) => x + 1),
  Effect.map((x) => x.toString())
)

// Traced non-generator Effect.fn
export const tracedEffectFnNonGen = Effect.fn("traced")(
  () => Effect.succeed(42),
  Effect.map((x) => x + 1)
)
