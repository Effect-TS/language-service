// @effect-diagnostics *:off
// @effect-diagnostics unsafeEffectTypeAssertion:warning
import { Effect } from "effect"

declare const program: Effect.Effect<string, "boom", "service">

export const preview = program as Effect.Effect<string, never, never>
