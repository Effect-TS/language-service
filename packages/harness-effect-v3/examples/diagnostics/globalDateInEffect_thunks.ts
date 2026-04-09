// @effect-diagnostics globalDateInEffect:warning
import { Data, Effect } from "effect"

class ExampleError extends Data.TaggedError("ExampleError")<{}> {}

export const dateInSync = Effect.sync(() => Date.now())

export const newDateInTryObject = Effect.try({
  try: () => new Date(),
  catch: () => new ExampleError()
})

export const dateInTryPromise = Effect.tryPromise(async () => Date.now())

export const dateInTryPromiseObject = Effect.tryPromise({
  try: async () => new Date(),
  catch: () => new ExampleError()
})

export const shouldNotTriggerReturnedFunction = Effect.sync(() => () => new Date())
