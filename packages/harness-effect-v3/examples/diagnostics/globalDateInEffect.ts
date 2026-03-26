// @effect-diagnostics globalDateInEffect:warning
import { Effect } from "effect"

// Should trigger - Date.now() inside Effect.gen
export const dateNowInGen = Effect.gen(function*() {
  const now = Date.now()
  return now
})

// Should trigger - new Date() inside Effect.gen
export const newDateInGen = Effect.gen(function*() {
  const now = new Date()
  return now
})

// Should trigger - new Date(...) with args inside Effect.fn
export const newDateWithArgsInFn = Effect.fn("newDateWithArgsInFn")(function*() {
  const date = new Date("2024-01-01")
  return date
})

// Should trigger - aliased Date
export const aliasedDate = Effect.gen(function*() {
  const MyDate = Date
  const now = MyDate.now()
  return now
})

// Should NOT trigger - Date.now() at module level
const _moduleLevel = Date.now()

// Should NOT trigger - new Date() in regular function
const _regularNewDate = () => {
  return new Date()
}

// Should NOT trigger - Date.now() inside nested arrow in generator
export const nestedArrowInGen = Effect.gen(function*() {
  const fn = () => Date.now()
  return fn
})
