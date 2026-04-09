// @effect-diagnostics cryptoRandomUUIDInEffect:warning
import { Data, Effect } from "effect"

class ExampleError extends Data.TaggedError("ExampleError")<{}> {}

export const uuidInSync = Effect.sync(() => crypto.randomUUID())

export const uuidInTryObject = Effect.try({
  try: () => crypto.randomUUID(),
  catch: () => new ExampleError()
})

export const uuidInTryPromise = Effect.tryPromise(async () => crypto.randomUUID())

export const uuidInTryPromiseObject = Effect.tryPromise({
  try: async () => crypto.randomUUID(),
  catch: () => new ExampleError()
})

export const shouldNotTriggerReturnedFunction = Effect.sync(() => () => crypto.randomUUID())
