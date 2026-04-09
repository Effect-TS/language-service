// @effect-diagnostics globalRandomInEffect:warning
import { Data, Effect } from "effect"

class ExampleError extends Data.TaggedError("ExampleError")<{}> {}

export const randomInSync = Effect.sync(() => Math.random())

export const randomInTryObject = Effect.try({
  try: () => Math.random(),
  catch: () => new ExampleError()
})

export const randomInTryPromise = Effect.tryPromise(async () => Math.random())

export const randomInTryPromiseObject = Effect.tryPromise({
  try: async () => Math.random(),
  catch: () => new ExampleError()
})

export const shouldNotTriggerReturnedFunction = Effect.sync(() => () => Math.random())
