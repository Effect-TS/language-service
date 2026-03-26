// @effect-diagnostics *:off
// @effect-diagnostics globalConsoleInEffect:warning
import { Effect } from "effect"

export const preview = Effect.gen(function*() {
  console.log("hello")
})
