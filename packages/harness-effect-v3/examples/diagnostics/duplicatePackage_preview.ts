// @effect-diagnostics *:off
// @effect-diagnostics duplicatePackage:warning
import * as Effect from "effect/Effect"

// This preview only reports when the workspace resolves duplicated
// Effect package versions.
export const preview = Effect.succeed(true)
