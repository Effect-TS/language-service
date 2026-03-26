// @effect-diagnostics globalFetch:warning
import { Effect } from "effect"

// Should trigger - fetch at module level
const _moduleFetch = fetch("https://example.com/module")

// Should trigger - fetch in regular function
const _regularFetch = () => fetch("https://example.com/regular")

// Should trigger - aliased fetch
const myFetch = fetch
const _aliasedFetch = myFetch("https://example.com/alias")

// Should NOT trigger - fetch directly inside Effect.gen
export const fetchInGen = Effect.gen(function*() {
  fetch("https://example.com/in-gen")
})

// Should trigger - fetch inside nested arrow in generator
export const nestedArrowInGen = Effect.gen(function*() {
  const fn = () => fetch("https://example.com/nested")
  return fn
})
