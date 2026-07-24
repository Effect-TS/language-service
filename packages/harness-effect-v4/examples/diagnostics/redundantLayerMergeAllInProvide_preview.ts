// @effect-diagnostics *:off
// @effect-diagnostics redundantLayerMergeAllInProvide:suggestion
import { Effect, Layer } from "effect"

export const preview = Effect.void.pipe(
  Effect.provide(Layer.mergeAll(Layer.empty, Layer.empty))
)
