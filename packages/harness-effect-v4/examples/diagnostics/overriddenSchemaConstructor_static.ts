import * as Schema from "effect/Schema"

export class InvalidBecauseOfConstructor
  extends Schema.Class<InvalidBecauseOfConstructor>("InvalidBecauseOfConstructor")({
    a: Schema.Number
  })
{
  b: number
  // should be report here at constructor location
  constructor() {
    super({ a: 42 })
    this.b = 56
  }
}
