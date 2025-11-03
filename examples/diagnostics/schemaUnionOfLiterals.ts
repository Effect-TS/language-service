// @effect-diagnostics schemaUnionOfLiterals:warning
import { Schema } from "effect"

export const thisShouldReport = Schema.Union(Schema.Literal("A"), Schema.Literal("B"))

export const noSenseForSingleMemberUnion = Schema.Union(Schema.Literal("A"))
