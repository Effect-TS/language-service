// @effect-diagnostics missedPipeableOpportunity:warning
// @test-config {"pipeableMinArgCount": 2}
import { Duration, identity, pipe, Schedule, Schema } from "effect"
import * as Effect from "effect/Effect"

const MyStruct = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number
})

export const shouldNotTrigger = identity(Schema.decodeEffect(MyStruct)({ x: 42, y: 42 }))

export const shouldTriggerBecauseHas2 = identity(identity(Schema.decodeEffect(MyStruct)({ x: 42, y: 42 })))

export const shouldNotTriggerFunctionReturned = pipe(
  Schedule.exponential(Duration.millis(10), 4),
  Schedule.while(_ => Effect.succeed(Duration.isLessThanOrEqualTo(Duration.seconds(10))(_.duration))) // should not report
)

export const shouldNotTriggerInnerPipe = Effect.log("Hello").pipe(
  Effect.ensuring(Effect.log("World"))
)
