/** @effect-diagnostics missingReturnYieldStar:skip-file */
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"

export declare const mustNotAppear: Effect.Effect<number, string, never>

class ErrorWithVeryLongName1 extends Data.TaggedError("Error1") {}
class ErrorWithVeryLongName2 extends Data.TaggedError("Error2") {}
class ErrorWithVeryLongName3 extends Data.TaggedError("Error3") {}
class ErrorWithVeryLongName4 extends Data.TaggedError("Error4") {}
class ErrorWithVeryLongName5 extends Data.TaggedError("Error5") {}
class ErrorWithVeryLongName6 extends Data.TaggedError("Error6") {}
class ErrorWithVeryLongName7 extends Data.TaggedError("Error7") {}
class ErrorWithVeryLongName8 extends Data.TaggedError("Error8") {}
class ErrorWithVeryLongName9 extends Data.TaggedError("Error9") {}
class ErrorWithVeryLongName10 extends Data.TaggedError("Error10") {}

/**
 * This is standard docs
 */
export const longErrorType = Effect.gen(function*() {
  yield* Effect.fail(new ErrorWithVeryLongName1())
  yield* Effect.fail(new ErrorWithVeryLongName2())
  yield* Effect.fail(new ErrorWithVeryLongName3())
  yield* Effect.fail(new ErrorWithVeryLongName4())
  yield* Effect.fail(new ErrorWithVeryLongName5())
  yield* Effect.fail(new ErrorWithVeryLongName6())
  yield* Effect.fail(new ErrorWithVeryLongName7())
  yield* Effect.fail(new ErrorWithVeryLongName8())
  yield* Effect.fail(new ErrorWithVeryLongName9())
  yield* Effect.fail(new ErrorWithVeryLongName10())
})

export const longSuccessValue = Effect.gen(function*() {
  const a: number = 0
  if (a === 1) return yield* Effect.succeed(new ErrorWithVeryLongName1())
  if (a === 2) return yield* Effect.succeed(new ErrorWithVeryLongName2())
  if (a === 3) return yield* Effect.succeed(new ErrorWithVeryLongName3())
  if (a === 4) return yield* Effect.succeed(new ErrorWithVeryLongName4())
  if (a === 5) return yield* Effect.succeed(new ErrorWithVeryLongName5())
  if (a === 6) return yield* Effect.succeed(new ErrorWithVeryLongName6())
  if (a === 7) return yield* Effect.succeed(new ErrorWithVeryLongName7())
  if (a === 8) return yield* Effect.succeed(new ErrorWithVeryLongName8())
  if (a === 9) return yield* Effect.succeed(new ErrorWithVeryLongName9())
  if (a === 10) return yield* Effect.succeed(new ErrorWithVeryLongName10())
})

export const asReturnFunction = () => longErrorType

export function testReturnSignature() {
  return longErrorType
}

export function withGenerics<A>(value: A) {
  return Effect.gen(function*() {
    if (Math.random() > 0.5) return yield* longErrorType
    return yield* Effect.succeed(value)
  })
}
