// @effect-diagnostics *:off
// @effect-diagnostics globalErrorInEffectFailure:warning
import { Effect } from "effect"

export const preview = Effect.fail(new Error("boom"))
