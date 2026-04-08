// @effect-diagnostics effectDoNotation:warning
import { Effect } from "effect"

export const direct = Effect.Do

export const piped = Effect.bind(Effect.Do, "a", () => Effect.succeed(1))

const alias = Effect
export const aliased = alias.Do

const local = { Do: 1 }
export const shouldNotReport = local.Do
