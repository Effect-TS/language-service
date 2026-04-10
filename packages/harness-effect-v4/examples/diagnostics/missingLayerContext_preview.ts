// @effect-diagnostics *:off
// @effect-diagnostics missingLayerContext:warning
import { Effect, Layer, Context } from "effect"

class A extends Context.Service<A>()("A", { make: Effect.succeed({}) }) {
  static Default = Layer.effect(this, this.make)
}
declare const layer: Layer.Layer<A, never, A>
// @ts-expect-error
export const preview: Layer.Layer<A> = layer
