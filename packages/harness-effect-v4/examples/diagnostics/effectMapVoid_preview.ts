// @effect-diagnostics *:off
// @effect-diagnostics effectMapVoid:warning
import { Effect } from "effect"

export const preview = Effect.succeed(1).pipe(
  Effect.map(() => undefined)
)
