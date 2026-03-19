// @effect-diagnostics *:off
// @effect-diagnostics nonObjectEffectServiceType:warning
import * as Effect from "effect/Effect"

export class BadService extends Effect.Service<BadService>()("BadService", {
  // @ts-expect-error
  succeed: "hello" as const
}) {}
