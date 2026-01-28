// 11:15
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as ParseOption from "effect/SchemaAST"


class Person extends Schema.Class<Person>("Person")({
  name: Schema.NonEmptyString,
  age: Schema.Int
}) {
  static decode = Schema.decodeEffect(Person)
}
