// @effect-diagnostics *:off
// @effect-diagnostics lazyPromiseInEffectSync:warning
import { Effect } from "effect"

export const preview = Effect.sync(() => Promise.resolve(1))
