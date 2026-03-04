import * as Effect from "effect/Effect"
import * as Option from "effect/Option"

export const shouldComplain = (n: number) =>
  Effect.gen(function*() {
    if (n === 0) {
      yield* Option.none() // should trigger because Option<A> is yieldable
    }
    return n / 1
  })
