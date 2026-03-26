// @effect-diagnostics globalTimers:warning
import { Effect } from "effect"

// Should trigger - setTimeout at module level
const _timeout = setTimeout(() => {}, 100)

// Should trigger - setInterval in regular function
const _interval = () => setInterval(() => {}, 100)

// Should trigger - aliased setTimeout at module level
const later = setTimeout
const _aliasedTimeout = later(() => {}, 100)

// Should NOT trigger - setTimeout inside Effect.gen
export const setTimeoutInGen = Effect.gen(function*() {
  return setTimeout(() => {}, 100)
})

// Should trigger - setInterval inside nested arrow in generator
export const nestedArrowInGen = Effect.gen(function*() {
  const fn = () => setInterval(() => {}, 100)
  return fn
})

// Should NOT trigger - shadowed setTimeout
const _shadowedTimeout = () => {
  const setTimeout = () => 0
  return setTimeout()
}
