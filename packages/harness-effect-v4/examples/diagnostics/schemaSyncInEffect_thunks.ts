import { Data, Effect, Schema } from "effect"

class ExampleError extends Data.TaggedError("ExampleError")<{}> {}

const Person = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
})

export const decodeInSync = Effect.sync(() => Schema.decodeSync(Person)({ name: "John", age: 30 }))

export const decodeInTryObject = Effect.try({
  try: () => Schema.decodeSync(Person)({ name: "Jane", age: 25 }),
  catch: () => new ExampleError()
})

export const encodeInTryPromise = Effect.tryPromise(async () => Schema.encodeSync(Person)({ name: "Bob", age: 40 }))

export const encodeInTryPromiseObject = Effect.tryPromise({
  try: async () => Schema.encodeUnknownSync(Person)({ name: "Carol", age: 50 }),
  catch: () => new ExampleError()
})

export const shouldNotTriggerReturnedFunction = Effect.sync(
  () => () => Schema.decodeSync(Person)({ name: "Nested", age: 10 })
)
