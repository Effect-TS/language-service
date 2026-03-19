// @effect-diagnostics *:off
// @effect-diagnostics schemaStructWithTag:warning
import * as Schema from "effect/Schema"

export const preview = Schema.Struct({
  _tag: Schema.Literal("User"),
  name: Schema.String
})
