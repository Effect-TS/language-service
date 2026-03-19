// @effect-diagnostics *:off
// @effect-diagnostics missingEffectError:warning
import type * as Effect from "effect/Effect"
import { Data } from "effect"

class Boom extends Data.TaggedError("Boom")<{}> {}
declare const effect: Effect.Effect<number, Boom>

// @ts-expect-error
export const preview: () => Effect.Effect<number> = () => effect
