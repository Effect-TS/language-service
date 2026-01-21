// 11:15
import * as Effect from "effect/Effect"
import * as ParseResult from "effect/ParseResult"
import * as Schema from "effect/Schema"
import * as ParseOption from "effect/SchemaAST"

class Person extends Schema.TaggedClass<Person>("Person")("Person", {
  name: Schema.NonEmptyString,
  age: Schema.Int
}) {
  static decode = Schema.decode(Person)
}
