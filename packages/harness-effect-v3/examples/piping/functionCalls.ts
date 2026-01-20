import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"

// Function call wrapping pipe
export const result1 = Effect.runSync(
  pipe(
    Effect.succeed(1),
    Effect.map((n) => n + 1)
  )
)

// Multiple function calls wrapping pipe
const wrapWithLog = <A>(effect: Effect.Effect<A>) => Effect.tap(effect, (a) => Effect.log(`Got: ${a}`))

export const result2 = wrapWithLog(
  Effect.succeed(1).pipe(Effect.map((n) => n + 1))
)
