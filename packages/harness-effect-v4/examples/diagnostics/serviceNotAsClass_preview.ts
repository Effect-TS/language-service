// @effect-diagnostics *:off
// @effect-diagnostics serviceNotAsClass:warning
import { ServiceMap } from "effect"

export const Preview = ServiceMap.Service<{ port: number }>("Preview")
