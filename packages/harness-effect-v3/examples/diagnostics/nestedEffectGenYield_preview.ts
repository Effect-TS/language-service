// @effect-diagnostics *:off
// @effect-diagnostics nestedEffectGenYield:warning
import * as Effect from "effect/Effect"

export const preview = Effect.gen(function*() {
  yield* Effect.gen(function*() {
    return 1
  })
})
