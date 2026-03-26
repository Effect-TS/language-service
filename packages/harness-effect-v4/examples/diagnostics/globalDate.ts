// @effect-diagnostics globalDate:warning
import { Effect } from "effect"

// Should trigger - Date.now() at module level
const _moduleLevelNow = Date.now()

// Should trigger - new Date() in regular function
const _regularNewDate = () => {
  return new Date()
}

// Should trigger - aliased Date at module level
const MyDate = Date
const _aliasedDateNow = MyDate.now()

// Should NOT trigger - Date.now() inside Effect.gen
export const dateNowInGen = Effect.gen(function*() {
  const now = Date.now()
  return now
})

// Should NOT trigger - new Date(...) inside Effect.fn
export const newDateWithArgsInFn = Effect.fn("newDateWithArgsInFn")(function*() {
  return new Date("2024-01-01")
})

// Should trigger - Date.now() inside nested arrow in generator
export const nestedArrowInGen = Effect.gen(function*() {
  const fn = () => Date.now()
  return fn
})
