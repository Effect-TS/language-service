// @effect-diagnostics *:off
// @effect-diagnostics effectInVoidSuccess:warning
import * as Effect from "effect/Effect"

export const preview: Effect.Effect<void> = Effect.succeed(
  Effect.log("nested")
)
