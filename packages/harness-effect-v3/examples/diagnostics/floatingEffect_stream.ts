import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"

export const shouldWarn = Effect.gen(function*() {
  Stream.succeed(42)
})
