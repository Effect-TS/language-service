// 5:14
import * as Effect from "effect/Effect"

export const program = Effect.timeoutFail(Effect.never, {
  duration: ""
})
