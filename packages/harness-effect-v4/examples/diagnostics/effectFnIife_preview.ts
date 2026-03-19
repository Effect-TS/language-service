// @effect-diagnostics *:off
// @effect-diagnostics effectFnIife:warning
import * as Effect from "effect/Effect"

export const preview = Effect.fn("preview")(function*() {
  return yield* Effect.succeed(1)
})()
