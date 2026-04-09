// @effect-diagnostics processEnvInEffect:warning
/// <reference types="node" />
import { Data, Effect } from "effect"

class ExampleError extends Data.TaggedError("ExampleError")<{}> {}

export const envInSync = Effect.sync(() => process.env.SYNC_SECRET)

export const envInTryObject = Effect.try({
  try: () => process.env.TRY_SECRET,
  catch: () => new ExampleError()
})

export const envInTryPromise = Effect.tryPromise(async () => process.env.TRY_PROMISE_SECRET)

export const envInTryPromiseObject = Effect.tryPromise({
  try: async () => process.env.TRY_PROMISE_OBJECT_SECRET,
  catch: () => new ExampleError()
})

export const shouldNotTriggerReturnedFunction = Effect.sync(() => () => process.env.NESTED_SECRET)
