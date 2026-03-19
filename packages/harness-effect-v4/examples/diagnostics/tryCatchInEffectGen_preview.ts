// @effect-diagnostics *:off
// @effect-diagnostics tryCatchInEffectGen:warning
import * as Effect from "effect/Effect"

export const preview = Effect.gen(function*() {
  try { return yield* Effect.succeed(1) }
  catch { return 0 }
})
