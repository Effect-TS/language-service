import * as Schema from "effect/Schema"

// valid usage
export class ValidSchemaClass extends Schema.Class<ValidSchemaClass>("ValidSchemaClass")({
  prop: Schema.String
}) {}

// invalid usage: Schema.Class<ValidSchemaClass> should be Schema.Class<InvalidSchemaClass> because the Self type parameter is not the same as the class name
export class InvalidSchemaClass extends Schema.Class<ValidSchemaClass>("InvalidSchemaClass")({
  prop: Schema.String
}) {}

// valid usage
export class ValidErrorSchemaClass extends Schema.Class<ValidErrorSchemaClass>("ValidErrorSchemaClass")({
  prop: Schema.String
}) {}

// invalid usage: Schema.Class<ValidSchemaClass> should be Schema.Class<InvalidSchemaClass> because the Self type parameter is not the same as the class name
export class InvalidErrorSchemaClass extends Schema.Class<ValidErrorSchemaClass>("InvalidErrorSchemaClass")({
  prop: Schema.String
}) {}


