// @strict
// @effect-diagnostics *:off
// @effect-diagnostics effectFnImplicitAny:error
import * as Effect from "effect/Effect"

export const preview = Effect.fn("preview")((input) => Effect.succeed(input))
