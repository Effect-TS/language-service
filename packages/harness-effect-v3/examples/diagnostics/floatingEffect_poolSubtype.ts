import { Effect, Pool } from "effect"

export const shouldNotTrigger = Effect.gen(function*() {
  yield* Pool.make({ acquire: Effect.succeed(1), size: 10 })
})
