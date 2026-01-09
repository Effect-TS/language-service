// @effect-diagnostics missedPipeableOpportunity:warning
// @test-config {"pipeableMinArgCount": 2}
import { Duration, identity, pipe, Schedule, Schema } from "effect"
import * as Effect from "effect/Effect"

const MyStruct = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number
})

export const shouldNotTrigger = identity(Schema.decodeUnknown(MyStruct)({ x: 42, y: 42 }))

export const shouldNotTriggerFunctionReturned = pipe(
  Schedule.exponential(Duration.millis(10), 4),
  Schedule.whileOutput(Duration.lessThanOrEqualTo(Duration.seconds(10))) // should not report
)

export const shouldNotTriggerInnerPipe = Effect.log("Hello").pipe(
  Effect.ensuring(Effect.log("World"))
)
