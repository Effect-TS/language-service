import * as Schema from "effect/Schema"

export class Valid extends Schema.Class<Valid>("Valid")({
  a: Schema.Number
}) {}

export class Valid2 extends Schema.Class<Valid2>("Valid")({
  a: Schema.Number
}) {
  otherMethod() {
    return this.a
  }
}

export class BaseClass {}
export class Valid3 extends BaseClass {
  constructor() {
    super()
  }
}

// this is invalid because if the class extends a Schema, there should be no constructor override
export class InvalidBecauseOfConstructor
  extends Schema.Class<InvalidBecauseOfConstructor>("InvalidBecauseOfConstructor")({
    a: Schema.Number
  })
{
  // should be report here at constructor location
  constructor() {
    super({ a: 42 })
  }
}
