// @effect-diagnostics *:off
// @effect-diagnostics strictEffectProvide:warning
import { Effect, Layer, ServiceMap } from "effect"

class Config extends ServiceMap.Service<Config>()("Config", { make: Effect.succeed({}) }) {
  static Default = Layer.effect(this, this.make)
}
export const preview = Effect.void.pipe(Effect.provide(Config.Default))
