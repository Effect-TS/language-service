// @effect-diagnostics globalFetchInEffect:warning
import { Data, Effect } from "effect"

class ExampleError extends Data.TaggedError("ExampleError")<{}> {}

export const fetchInSync = Effect.sync(() => fetch("https://example.com/sync"))

export const fetchInTryObject = Effect.try({
  try: () => fetch("https://example.com/try"),
  catch: () => new ExampleError()
})

export const fetchInTryPromise = Effect.tryPromise(async () => fetch("https://example.com/try-promise"))

export const fetchInTryPromiseObject = Effect.tryPromise({
  try: async () => fetch("https://example.com/try-promise-object"),
  catch: () => new ExampleError()
})

export const shouldNotTriggerReturnedFunction = Effect.sync(() => () => fetch("https://example.com/nested"))
