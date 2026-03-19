// @effect-diagnostics *:off
// @effect-diagnostics unsupportedServiceAccessors:warning
import * as Effect from "effect/Effect"

export class Preview extends Effect.Service<Preview>()("Preview", {
  accessors: true,
  effect: Effect.succeed({ get: <A>(value: A) => Effect.succeed(value) })
}) {}
