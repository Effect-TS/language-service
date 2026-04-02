// @effect-diagnostics processEnv:warning
/// <reference types="node" />
import { Effect } from "effect"

// Should trigger - process.env at module level
const _moduleEnv = process.env.PORT

// Should trigger - bracket access in regular function
const _regularEnv = () => process.env["HOST"]

// Should NOT trigger - process.env directly inside Effect.gen
export const envInGen = Effect.gen(function*() {
  return process.env.SECRET
})

// Should trigger - process.env inside nested arrow in generator
export const nestedArrowInGen = Effect.gen(function*() {
  const fn = () => process.env.API_KEY
  return fn
})
