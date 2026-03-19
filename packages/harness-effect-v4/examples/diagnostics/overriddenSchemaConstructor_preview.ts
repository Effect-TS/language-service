// @effect-diagnostics *:off
// @effect-diagnostics overriddenSchemaConstructor:warning
import * as Schema from "effect/Schema"

export class User extends Schema.Class<User>("User")({ name: Schema.String }) {
  constructor(readonly input: { name: string }) { super(input) }
}
