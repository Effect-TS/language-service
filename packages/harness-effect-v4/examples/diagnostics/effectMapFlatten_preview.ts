// @effect-diagnostics *:off
// @effect-diagnostics effectMapFlatten:warning
import { Effect } from "effect"

export const preview = Effect.succeed(1).pipe(
  Effect.map((n) => Effect.succeed(n + 1)),
  Effect.flatten
)
