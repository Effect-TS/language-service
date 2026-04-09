// @effect-diagnostics globalConsoleInEffect:warning
import { Data, Effect } from "effect"

class ExampleError extends Data.TaggedError("ExampleError")<{}> {}

export const consoleInSync = Effect.sync(() => console.log("sync"))

export const consoleInTryObject = Effect.try({
  try: () => console.warn("try"),
  catch: () => new ExampleError()
})

export const consoleInTryPromise = Effect.tryPromise(async () => console.log("try-promise"))

export const consoleInTryPromiseObject = Effect.tryPromise({
  try: async () => console.warn("try-promise-object"),
  catch: () => new ExampleError()
})

export const shouldNotTriggerReturnedFunction = Effect.sync(() => () => console.log("nested"))
