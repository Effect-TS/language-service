// @effect-diagnostics *:off
// @effect-diagnostics schemaUnionOfLiterals:warning
import * as Schema from "effect/Schema"

export const preview = Schema.Union(Schema.Literal("a"), Schema.Literal("b"))
