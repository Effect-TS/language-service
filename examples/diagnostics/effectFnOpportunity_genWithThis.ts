import * as Effect from "effect/Effect"

// The diagnostic should NOT trigger for these cases because Effect.gen is
// using the `this` argument (first parameter). This is commonly used in
// class methods to access `this` inside the generator. Converting to
// Effect.fn does not support this yet.

class MyClass {
  value = 42

  methodWithThis() {
    return Effect.gen(this, function*() {
      return yield* Effect.succeed(this.value)
    })
  }

  arrowPropertyWithThis = () => {
    return Effect.gen(this, function*() {
      return yield* Effect.succeed(this.value)
    })
  }
}

export { MyClass }
