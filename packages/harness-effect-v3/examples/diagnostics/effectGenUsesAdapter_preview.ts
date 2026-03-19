// @effect-diagnostics *:off
// @effect-diagnostics effectGenUsesAdapter:warning
import * as Effect from "effect/Effect"

export const preview = Effect.gen(function*(_) {
  return yield* Effect.succeed(1)
})
