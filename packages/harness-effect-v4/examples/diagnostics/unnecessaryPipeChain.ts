import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"

export const asPipeable = Effect.succeed(1).pipe(Effect.map((x) => x + 2)).pipe(Effect.map((x) => x + 3))

export const asPipe = pipe(pipe(Effect.succeed(1), Effect.map((x) => x + 2)), Effect.map((x) => x + 3))
