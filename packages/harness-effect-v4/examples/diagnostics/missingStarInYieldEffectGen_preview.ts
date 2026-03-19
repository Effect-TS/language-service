// @effect-diagnostics *:off
// @effect-diagnostics missingStarInYieldEffectGen:warning
import * as Effect from "effect/Effect"

export const preview = Effect.gen(function*() {
  const value = yield Effect.succeed(1)
  return value
})
