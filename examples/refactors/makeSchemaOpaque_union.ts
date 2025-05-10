// 4:17
import * as Schema from "effect/Schema"

export const MyUnion = Schema.Union(
    Schema.Literal("A"),
    Schema.Literal("B")
)
