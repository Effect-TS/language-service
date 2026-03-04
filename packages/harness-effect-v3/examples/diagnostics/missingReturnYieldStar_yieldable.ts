import * as Effect from "effect/Effect"

export const shouldComplain = (n: number) =>
  Effect.gen(function*() {
    if (n === 0) {
      // In v3, yieldable parsing falls back to Effect typing.
      yield* Effect.fail("no zero!")
    }
    return n / 1
  })
