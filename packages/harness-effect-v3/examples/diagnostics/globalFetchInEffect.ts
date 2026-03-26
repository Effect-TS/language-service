// @effect-diagnostics globalFetchInEffect:warning
import { Effect } from "effect"

// Should trigger - fetch directly inside Effect.gen
export const fetchInGen = Effect.gen(function*() {
  fetch("https://example.com/in-gen")
})

// Should trigger - fetch directly inside Effect.fn
export const fetchInFn = Effect.fn("fetchInFn")(function*() {
  fetch("https://example.com/in-fn")
})

// Should NOT trigger - fetch at module level
const _moduleFetch = fetch("https://example.com/module")

// Should NOT trigger - fetch in regular function
const _regularFetch = () => fetch("https://example.com/regular")

// Should NOT trigger - fetch inside nested arrow in generator
export const nestedArrowInGen = Effect.gen(function*() {
  const fn = () => fetch("https://example.com/nested")
  return fn
})
