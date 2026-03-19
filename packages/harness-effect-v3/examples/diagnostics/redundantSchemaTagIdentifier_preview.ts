// @effect-diagnostics *:off
// @effect-diagnostics redundantSchemaTagIdentifier:warning
import * as Schema from "effect/Schema"

export class Preview
  extends Schema.TaggedClass<Preview>("Preview")("Preview", {
    value: Schema.String
  }) {}
