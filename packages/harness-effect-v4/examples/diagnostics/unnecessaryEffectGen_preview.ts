// @effect-diagnostics *:off
// @effect-diagnostics unnecessaryEffectGen:warning
import * as Effect from "effect/Effect"

export const preview = Effect.gen(function*() {
  return yield* Effect.succeed(1)
})
