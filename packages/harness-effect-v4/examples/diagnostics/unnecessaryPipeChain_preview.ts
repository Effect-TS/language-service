// @effect-diagnostics *:off
// @effect-diagnostics unnecessaryPipeChain:warning
import * as Effect from "effect/Effect"

export const preview = Effect.succeed(1).pipe(Effect.asVoid).pipe(Effect.as("done"))
