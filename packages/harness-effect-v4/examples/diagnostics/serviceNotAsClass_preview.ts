// @effect-diagnostics *:off
// @effect-diagnostics serviceNotAsClass:warning
import { Context } from "effect"

export const Preview = Context.Service<{ port: number }>("Preview")
