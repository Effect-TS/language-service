// @effect-diagnostics processEnvInEffect:warning
/// <reference types="node" />
import { Effect } from "effect"

// Should trigger - process.env directly inside Effect.gen
export const envInGen = Effect.gen(function*() {
  return process.env.SECRET
})

// Should trigger - bracket access inside Effect.fn
export const envInFn = Effect.fn("envInFn")(function*() {
  return process.env["API_KEY"]
})

// Should NOT trigger - process.env at module level
const _moduleEnv = process.env.PORT

// Should NOT trigger - process.env in regular function
const _regularEnv = () => process.env["HOST"]

// Should NOT trigger - process.env inside nested arrow in generator
export const nestedArrowInGen = Effect.gen(function*() {
  const fn = () => process.env.NODE_ENV
  return fn
})
