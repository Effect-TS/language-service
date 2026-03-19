// @effect-diagnostics *:off
// @effect-diagnostics classSelfMismatch:warning
import * as Effect from "effect/Effect"

interface ServiceShape { value: number }

export class InvalidContextTag
  extends Effect.Tag("ValidContextTag")<ValidContextTag, ServiceShape>() {}

declare class ValidContextTag {}
