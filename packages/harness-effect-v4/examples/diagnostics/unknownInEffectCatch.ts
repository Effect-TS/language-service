import { Data, Effect } from "effect"
import * as Function from "effect/Function"

export const program = Effect.tryPromise({
  try: () => fetch("http://something"),
  catch: (e) => e // <- This is the error
})

class MyError extends Data.TaggedError("MyError")<{
  cause: unknown
}> {}

export const shouldNotTrigger = Effect.tryPromise({
  try: () => fetch("http://something"),
  catch: (e) => new MyError({ cause: e })
})

export const shouldTriggerAsWell = Effect.tryPromise({
  try: () => fetch("http://something"),
  catch: Function.identity
})

export const shouldTriggerAsWellForAny = Effect.tryPromise({
  try: () => fetch("http://something"),
  catch: (_) => _ as any
})
