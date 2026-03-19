// @effect-diagnostics *:off
// @effect-diagnostics effectInFailure:warning
import { Effect } from "effect"

export const preview = Effect.try({
  try: () => JSON.parse("{"),
  catch: (error) => Effect.logError(error)
})
