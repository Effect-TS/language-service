import { Effect } from "effect"

const program = Effect.succeed(1).pipe(
  Effect.flatMap((value) => Effect.succeed(value + 1))
)
