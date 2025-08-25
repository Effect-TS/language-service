// 4:20
import * as Schema from "effect/Schema"

export class MyService extends Schema.TaggedError<MyService>("MyService")("MyService", {}) {}
