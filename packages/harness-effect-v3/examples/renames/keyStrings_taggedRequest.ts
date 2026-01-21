// 4:20
import * as Schema from "effect/Schema"

export class MyService extends Schema.TaggedRequest<MyService>("MyService")("MyService", {
  payload: {},
  success: Schema.Void,
  failure: Schema.Never
}) {}
