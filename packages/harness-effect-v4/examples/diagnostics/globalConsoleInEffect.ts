// @effect-diagnostics globalConsoleInEffect:warning
import { Effect } from "effect"

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

// Should trigger - aliased console
export const aliasedConsoleAgain = Effect.gen(function*() {
  const myConsole = console
  myConsole.log("hello")
})

// Should trigger - aliased console
export const aliasedConsole = Effect.gen(function*() {
  const myConsole = console
  myConsole.log("hello")
})

// Should NOT trigger - console.log at module level
console.log("module level")

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
