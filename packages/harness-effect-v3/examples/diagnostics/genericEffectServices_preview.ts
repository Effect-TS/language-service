// @effect-diagnostics *:off
// @effect-diagnostics genericEffectServices:warning
import { Effect } from "effect"

export class Preview<_A> extends Effect.Service<Preview<any>>()("Preview", {
  succeed: {}
}) {}
