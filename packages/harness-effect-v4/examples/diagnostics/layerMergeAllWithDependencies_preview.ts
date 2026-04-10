// @effect-diagnostics *:off
// @effect-diagnostics layerMergeAllWithDependencies:warning
import { Effect, Layer, Context } from "effect"

class A extends Context.Service<A>()("A", { make: Effect.succeed({}) }) {
  static Default = Layer.effect(this, this.make)
}
class B extends Context.Service<B>()("B", { make: Effect.as(A.asEffect(), {}) }) {
  static Default = Layer.effect(this, this.make)
}
export const preview = Layer.mergeAll(A.Default, B.Default)
