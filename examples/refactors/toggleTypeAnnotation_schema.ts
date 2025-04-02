// 11:15
import * as Schema from "effect/Schema"
import * as ParseResult from "effect/ParseResult"
import * as ParseOption from "effect/SchemaAST"
import * as Effect from "effect/Effect"

class Person extends Schema.TaggedClass<Person>("Person")("Person", {
    name: Schema.NonEmptyString,
    age: Schema.Int
}){
    static decode = Schema.decode(Person)
}
