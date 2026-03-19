// @effect-diagnostics *:off
// @effect-diagnostics unknownInEffectCatch:warning
import { Effect } from "effect"

export const preview = Effect.tryPromise({
  try: async () => 1,
  catch: (error) => error
})
