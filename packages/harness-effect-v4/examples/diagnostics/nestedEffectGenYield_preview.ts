// @effect-diagnostics *:off
// @effect-diagnostics nestedEffectGenYield:warning
import { Effect } from "effect"

export const preview = Effect.gen(function*() {
  yield* Effect.gen(function*() {
    return 1
  })
})
