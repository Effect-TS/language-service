import * as Data from "effect/Data"
import * as Effect from "effect/Effect"

class DivisionByZeroError extends Data.TaggedError("DivisionByZeroError")<{}> {}

const divide = Effect.fn(function*(fa: number, divideBy: number) {
  if (divideBy === 0) return yield* new DivisionByZeroError()
  return fa / divideBy
})

export const program = Effect.gen(function*() {
  return yield* divide(42, 2)
})
