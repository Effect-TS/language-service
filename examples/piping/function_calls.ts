import { pipe } from "effect/Function"
import * as Effect from "effect/Effect"

// Helper functions that wrap effects
const addOne = Effect.map((n: number) => n + 1)
const double = Effect.map((n: number) => n * 2)

// Function call wrapping pipe
const result1 = Effect.runSync(
  pipe(
    Effect.succeed(1),
    Effect.map((n) => n + 1)
  )
)

// Multiple function calls wrapping pipe
const wrapWithLog = <A>(effect: Effect.Effect<A>) =>
  Effect.tap(effect, (a) => Effect.log(`Got: ${a}`))

const result2 = wrapWithLog(
  Effect.succeed(1).pipe(Effect.map((n) => n + 1))
)
