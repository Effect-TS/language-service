// @effect-diagnostics *:off
// @effect-diagnostics returnEffectInGen:warning
import * as Effect from "effect/Effect"

export const preview = Effect.gen(function*() {
  return Effect.succeed(1)
})
