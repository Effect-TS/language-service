import { Data, Effect } from "effect"

class JsonParseError extends Data.TaggedError("JsonParseError")<{ cause: unknown }> {}

export const shouldReport = Effect.try({
  try: () => JSON.parse("{"),
  catch: (e) => Effect.log(e)
})

export const shouldNotReport = Effect.try({
  try: () => JSON.parse("{"),
  catch: (e) => new JsonParseError({ cause: e })
})

export const shouldReportOnlyInner = Effect.try({
  try: () => JSON.parse("{"),
  catch: (e) =>
    Effect.try({
      try: () => JSON.parse(String(e)),
      catch: (innerError) => Effect.log(innerError)
    })
})
