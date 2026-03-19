// @effect-diagnostics *:off
// @effect-diagnostics outdatedEffectCodegen:warning
import * as Effect from "effect/Effect"

// @effect-codegens accessors:stale-preview
export class Preview extends Effect.Service<Preview>()("Preview", {
  accessors: true,
  effect: Effect.succeed({ value: Effect.succeed(1) })
}) {}
