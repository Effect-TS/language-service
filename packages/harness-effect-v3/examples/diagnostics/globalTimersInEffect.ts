// @effect-diagnostics globalTimersInEffect:warning
import { Effect } from "effect"

// Should trigger - setTimeout inside Effect.gen
export const setTimeoutInGen = Effect.gen(function*() {
  setTimeout(() => {}, 100)
})

// Should trigger - setInterval inside Effect.gen
export const setIntervalInGen = Effect.gen(function*() {
  setInterval(() => {}, 1000)
})

// Should trigger - aliased setTimeout
export const aliasedTimeout = Effect.gen(function*() {
  const myTimeout = setTimeout
  myTimeout(() => {}, 100)
})

// Should NOT trigger - setTimeout at module level
setTimeout(() => {}, 0)

// Should NOT trigger - setTimeout in regular function
const _regularFn = () => {
  setTimeout(() => {}, 100)
}

// Should NOT trigger - setTimeout inside nested arrow in generator
export const nestedArrowInGen = Effect.gen(function*() {
  const fn = () => setTimeout(() => {}, 100)
  return fn
})
