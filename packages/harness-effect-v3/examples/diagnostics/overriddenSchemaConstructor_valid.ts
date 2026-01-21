import * as Schema from "effect/Schema"

export class Valid extends Schema.Class<Valid>("Valid")({
  a: Schema.Number
}) {
  protected constructor(a: Valid, options: Schema.MakeOptions) {
    super(a, options)
  }
}
