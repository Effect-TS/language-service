// @effect-diagnostics globalConsole:warning
import { Effect } from "effect"

// Should trigger - console.log at module level
console.log("module level")

// Should trigger - console.warn in regular function
const _regularFn = () => {
  console.warn("warning")
}

// Should trigger - aliased console at module level
const myConsole = console
myConsole.info("info")

// Should NOT trigger - console.log inside Effect.gen
export const consoleLogInGen = Effect.gen(function*() {
  console.log("hello")
})

// Should NOT trigger - console.warn inside Effect.fn
export const consoleWarnInFn = Effect.fn("consoleWarnInFn")(function*() {
  console.warn("warning")
})

// Should trigger - console.error inside nested arrow in generator
export const nestedArrowInGen = Effect.gen(function*() {
  const fn = () => console.error("nested")
  return fn
})

// Should NOT trigger - shadowed console
const _shadowedConsole = () => {
  const console = { log: (..._args: Array<unknown>) => undefined }
  console.log("hello")
}
