// @effect-diagnostics globalInEffect:warning
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

// Should trigger - console.log inside Effect.gen
export const consoleLogInGen = Effect.gen(function*() {
  console.log("hello")
})

// Should trigger - console.warn inside Effect.fn
export const consoleWarnInFn = Effect.fn("consoleWarnInFn")(function*() {
  console.warn("warning")
})

// Should trigger - console.error inside Effect.gen
export const consoleErrorInGen = Effect.gen(function*() {
  console.error("error")
})

// Should trigger - Math.random() inside Effect.gen
export const mathRandomInGen = Effect.gen(function*() {
  const r = Math.random()
  return r
})

// Should trigger - setTimeout inside Effect.gen
export const setTimeoutInGen = Effect.gen(function*() {
  setTimeout(() => {}, 100)
})

// Should trigger - setInterval inside Effect.gen
export const setIntervalInGen = Effect.gen(function*() {
  setInterval(() => {}, 1000)
})

// Should NOT trigger - Date.now() at module level
const _moduleLevel = Date.now()

// Should NOT trigger - console.log in regular function
const _regularFn = () => {
  console.log("regular")
}

// Should NOT trigger - console.log inside nested arrow in generator
export const nestedArrowInGen = Effect.gen(function*() {
  const fn = () => console.log("nested")
  return fn
})

// Should NOT trigger - console.table inside generator (no Effect equivalent)
export const consoleTableInGen = Effect.gen(function*() {
  console.table({ a: 1 })
})

// Should NOT trigger - new Date() in regular function
const _regularNewDate = () => {
  return new Date()
}
