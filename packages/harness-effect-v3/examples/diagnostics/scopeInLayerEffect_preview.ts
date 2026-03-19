// @effect-diagnostics *:off
// @effect-diagnostics scopeInLayerEffect:warning
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

class Cache extends Context.Tag("Cache")<Cache, { ok: true }>() {}
export const preview = Layer.effect(Cache, Effect.gen(function*() {
  yield* Effect.addFinalizer(() => Effect.void)
  return { ok: true as const }
}))
