import {Context} from "effect"

interface ServiceShape {
  value: number
}

// valid usage: <ValidContextTag, ServiceShape> is correct because the Self type parameter is the same as the class name
export class ValidContextTag extends Context.Service<ValidContextTag, ServiceShape>()("ValidContextTag"){}

// invalid usage: <ValidContextTag, ServiceShape> should be <InvalidContextTag, ServiceShape> because the Self type parameter is not the same as the class name
export class InvalidContextTag extends Context.Service<InvalidContextTag, ServiceShape>()("InvalidContextTag"){}
