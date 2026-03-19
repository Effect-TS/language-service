// @effect-diagnostics *:off
// @effect-diagnostics catchUnfailableEffect:warning
import { Effect } from "effect"

export const preview = Effect.succeed(1).pipe(
  Effect.catch(() => Effect.succeed(0))
)
