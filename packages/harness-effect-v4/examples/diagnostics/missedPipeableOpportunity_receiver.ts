// @effect-diagnostics missedPipeableOpportunity:warning
// @test-config {"pipeableMinArgCount": 1}
import * as Schema from "effect/Schema"

const Inner = Schema.Struct({ a: Schema.String })

// should trigger on the receiver of .annotate
export const B = Schema.NullishOr(Inner).annotate({ identifier: "B" })

// should trigger on the receiver and on the nested Schema.Array(Inner)
export const C = Schema.NullishOr(Schema.Struct({ x: Schema.Array(Inner) })).annotate({ identifier: "C" })

// should trigger with the merged suggestion Inner.pipe(Schema.Array, Schema.check(Schema.isMinLength(1)))
export const D = Schema.Array(Inner).pipe(Schema.check(Schema.isMinLength(1)))
