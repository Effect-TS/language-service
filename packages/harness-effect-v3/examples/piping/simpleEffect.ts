import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"

export const simpleEffect = Effect.succeed(1).pipe(
  Effect.map((x) => x + 1),
  Effect.map((x) => x.toString()),
  Effect.map((x) => x.length > 0)
)

export const nestedSimple = Effect.succeed(1).pipe(Effect.map((x) => x + 1)).pipe(
  Effect.map((x) => x * 2),
  Effect.map((x) => x.toString()),
  Effect.map((x) => x.length > 0)
)

export const mixedCallsAndPipes = Effect.map(Effect.succeed(1), (x) => x + 1).pipe(
  Effect.map((x) => x * 2),
  Effect.map((x) => x.toString()),
  Effect.map((x) => x.length > 0)
)

export const twoDifferentPipingFlows = Effect.succeed(1).pipe(
  Effect.flatMap((x) => Effect.succeed(x + 1).pipe(Effect.map((x) => x * 2)))
)

export const traditionalPiping = pipe(
  Effect.succeed(1),
  Effect.map((x) => x * 2),
  Effect.map((x) => x.toString()),
  Effect.map((x) => x.length > 0)
)

export const usingConst = Effect.succeed(1).pipe(
  Effect.map((x) => x * 2),
  Effect.asVoid
)

export const usingConst2 = Effect.asVoid(Effect.succeed(1).pipe(Effect.map((x) => x * 2)))
