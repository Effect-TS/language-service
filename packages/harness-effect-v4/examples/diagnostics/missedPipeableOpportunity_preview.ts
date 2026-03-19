// @effect-diagnostics *:off
// @effect-diagnostics missedPipeableOpportunity:warning
// @test-config { "pipeableMinArgCount": 2 }
import { identity, Schema } from "effect"

const User = Schema.Struct({ id: Schema.Number })
export const preview = identity(identity(Schema.decodeEffect(User)({ id: 1 })))
