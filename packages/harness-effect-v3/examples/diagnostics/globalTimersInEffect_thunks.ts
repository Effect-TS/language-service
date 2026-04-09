// @effect-diagnostics globalTimersInEffect:warning
import { Data, Effect } from "effect"

class ExampleError extends Data.TaggedError("ExampleError")<{}> {}

export const timersInSync = Effect.sync(() => setTimeout(() => {}, 10))

export const timersInTryObject = Effect.try({
  try: () => setInterval(() => {}, 10),
  catch: () => new ExampleError()
})

export const timersInTryPromise = Effect.tryPromise(async () => setTimeout(() => {}, 10))

export const timersInTryPromiseObject = Effect.tryPromise({
  try: async () => setTimeout(() => {}, 10),
  catch: () => new ExampleError()
})

export const shouldNotTriggerReturnedFunction = Effect.sync(() => () => setTimeout(() => {}, 10))
