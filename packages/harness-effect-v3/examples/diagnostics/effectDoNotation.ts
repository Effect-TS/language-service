// @effect-diagnostics effectDoNotation:warning
import * as Effect from "effect/Effect"

export const direct = Effect.Do

export const piped = Effect.bind(Effect.Do, "a", () => Effect.succeed(1))

const alias = Effect
export const aliased = alias.Do

const local = { Do: 1 }
export const shouldNotReport = local.Do
