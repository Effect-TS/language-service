import { Effect } from "effect"

// Should trigger diagnostic - JSON.parse inside Effect.try (object form)
export const parseWithCatch = Effect.try({
  try: () => JSON.parse("{\"name\":\"Jane\"}"),
  catch: () => new Error("Failed to parse")
})

// Should trigger diagnostic - JSON.stringify inside Effect.try (object form)
export const stringifyWithCatch = Effect.try({
  try: () => JSON.stringify({ name: "Alice" }),
  catch: () => new Error("Failed to stringify")
})

// Should trigger diagnostic - JSON.parse inside Effect.gen
export const parseInGen = Effect.gen(function*() {
  const text = yield* Effect.succeed("{\"name\":\"Test\"}")
  const parsed = JSON.parse(text)
  //             ^- should suggest using Effect Schema
  return parsed
})

// Should trigger diagnostic - JSON.stringify inside Effect.gen
export const stringifyInGen = Effect.gen(function*() {
  const data = yield* Effect.succeed({ name: "Test" })
  const json = JSON.stringify(data)
  //           ^- should suggest using Effect Schema
  return json
})

// Should trigger diagnostic - JSON.parse inside Effect.fn
export const parseInFn = Effect.fn("parseInFn")(function*() {
  const text = "{\"name\":\"FnTest\"}"
  const parsed = JSON.parse(text)
  //             ^- should suggest using Effect Schema
  return parsed
})

// Should NOT trigger - JSON.parse in regular function
const _regularParse = () => {
  const text = "{\"name\":\"Regular\"}"
  return JSON.parse(text)
}

// Should NOT trigger - JSON.parse inside nested function in Effect.gen
export const nestedFunctionInGen = Effect.gen(function*() {
  const parseFn = () => JSON.parse("{\"nested\":true}")
  //                    ^- this is inside a nested function, should NOT trigger
  return parseFn()
})
