// 7:13
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"

const test = () =>
  pipe(
    Effect.gen(function*() {
      const test = "test"
      return yield* Effect.succeed(test)
    }).pipe(Effect.asVoid),
    Effect.tapError(Effect.logError)
  )
