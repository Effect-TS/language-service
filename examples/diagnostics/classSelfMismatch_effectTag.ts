import * as Effect from "effect/Effect"

interface ServiceShape {
  value: number
}

// valid usage: <ValidContextTag, ServiceShape> is correct because the Self type parameter is the same as the class name
export class ValidContextTag extends Effect.Tag("ValidContextTag")<ValidContextTag, ServiceShape>() {}

// invalid usage: <ValidContextTag, ServiceShape> should be <InvalidContextTag, ServiceShape> because the Self type parameter is not the same as the class name
export class InvalidContextTag extends Effect.Tag("ValidContextTag")<ValidContextTag, ServiceShape>() {}
