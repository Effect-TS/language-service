import * as Schema from "effect/Schema"

// valid usage
export class ValidSchemaClass extends Schema.Class<ValidSchemaClass>("ValidSchemaClass")({
  prop: Schema.String
}) {}

// invalid usage: Schema.Class<ValidSchemaClass> should be Schema.Class<InvalidSchemaClass> because the Self type parameter is not the same as the class name
export class InvalidSchemaClass extends Schema.Class<ValidSchemaClass>("InvalidSchemaClass")({
  prop: Schema.String
}) {}

export class ValidSchemaTaggedClass
  extends Schema.TaggedClass<ValidSchemaTaggedClass>("ValidSchemaTaggedClass")("ValidSchemaTaggedClass", {
    prop: Schema.String
  })
{}

// invalid usage: Schema.TaggedClass<ValidSchemaTaggedClass> should be Schema.TaggedClass<InvalidSchemaTaggedClass> because the Self type parameter is not the same as the class name
export class InvalidSchemaTaggedClass
  extends Schema.TaggedClass<ValidSchemaTaggedClass>("InvalidSchemaTaggedClass")("InvalidSchemaTaggedClass", {
    prop: Schema.String
  })
{}

export class ValidSchemaTaggedError
  extends Schema.TaggedError<ValidSchemaTaggedError>("ValidSchemaTaggedError")("ValidSchemaTaggedError", {
    prop: Schema.String
  })
{}

// invalid usage: Schema.TaggedError<ValidSchemaTaggedError> should be Schema.TaggedError<InvalidSchemaTaggedError> because the Self type parameter is not the same as the class name
export class InvalidSchemaTaggedError
  extends Schema.TaggedError<ValidSchemaTaggedError>("InvalidSchemaTaggedError")("InvalidSchemaTaggedError", {
    prop: Schema.String
  })
{}

export class ValidSchemaTaggedRequest
  extends Schema.TaggedRequest<ValidSchemaTaggedRequest>("ValidSchemaTaggedRequest")("ValidSchemaTaggedRequest", {
    payload: {},
    success: Schema.Void,
    failure: Schema.Never
  })
{}

// invalid usage: Schema.TaggedRequest<ValidSchemaTaggedRequest> should be Schema.TaggedRequest<InvalidSchemaTaggedRequest> because the Self type parameter is not the same as the class name
export class InvalidSchemaTaggedRequest
  extends Schema.TaggedRequest<ValidSchemaTaggedRequest>("InvalidSchemaTaggedRequest")("InvalidSchemaTaggedRequest", {
    payload: {},
    success: Schema.Void,
    failure: Schema.Never
  })
{}
