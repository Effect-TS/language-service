import { Data, Effect } from "effect"
import * as Function from "effect/Function"

class MyError extends Data.TaggedError("MyError")<{
  cause: unknown
}> {}

export const shouldNotTrigger = Effect.tryPromise({
  try: () => fetch("http://something"),
  catch: (e) => new MyError({ cause: e })
})

export const shouldTriggerAsWell = Effect.tryPromise({
  try: () => fetch("http://something"),
  catch: () => new Error("Unknown!")
})
