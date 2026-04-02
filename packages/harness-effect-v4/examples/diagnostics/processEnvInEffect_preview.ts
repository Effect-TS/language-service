// @effect-diagnostics *:off
// @effect-diagnostics processEnvInEffect:warning
/// <reference types="node" />
import { Effect } from "effect"

export const preview = Effect.gen(function*() {
  return process.env.PORT
})
