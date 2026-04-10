// @effect-diagnostics *:off
// @effect-diagnostics strictEffectProvide:warning
import { Effect, Layer, Context } from "effect"

class Config extends Context.Service<Config>()("Config", { make: Effect.succeed({}) }) {
  static Default = Layer.effect(this, this.make)
}
export const preview = Effect.void.pipe(Effect.provide(Config.Default))
