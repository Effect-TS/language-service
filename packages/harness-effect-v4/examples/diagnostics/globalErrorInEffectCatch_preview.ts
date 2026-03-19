// @effect-diagnostics *:off
// @effect-diagnostics globalErrorInEffectCatch:warning
import { Effect } from "effect"

export const preview = Effect.tryPromise({
  try: async () => 1,
  catch: (error) => new Error(String(error))
})
