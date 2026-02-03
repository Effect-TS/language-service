// @effect-diagnostics instanceOfSchema:warning
import { Schema } from "effect"

class MySchema extends Schema.Class<MySchema>("MySchema")({
  name: Schema.String,
}){}

declare const value: unknown

// Should trigger - instanceof used with Effect Schema
if (value instanceof MySchema) {
  console.log("is my schema")
}

// Should trigger - with schema variable
class PersonSchema extends Schema.Class<PersonSchema>("MySchema")({
  name: Schema.String,
}){}
export const checkPerson = (x: unknown) => x instanceof PersonSchema

// Should NOT trigger - regular class
class MyClass {}
if (value instanceof MyClass) {
  console.log("is my class")
}

// Should NOT trigger - built-in types
if (value instanceof Date) {
  console.log("is date")
}

if (value instanceof RegExp) {
  console.log("is regexp")
}
