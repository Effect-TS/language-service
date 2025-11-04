// @effect-diagnostics missedPipeableOpportunity:warning
// @test-config {"pipeableMinArgCount": 2}
import { identity, Schema } from "effect"

const MyStruct = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number
})

export const shouldNotTrigger = identity(Schema.decodeUnknown(MyStruct)({ x: 42, y: 42 }))
