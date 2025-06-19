import { Effect } from "effect"

export const shouldNotWarn = Effect.gen(function*() {
  yield* Effect.log("about to fail")
  return yield* Effect.fail("error")
})

function lazy<A>(f: () => A) {
  return f()
}

export const shouldNotWarn2 = Effect.gen(function*() {
  yield* Effect.log("about to fail")
  yield* lazy(() => {
    return Effect.succeed("success")
  })
})

export const classGetter = Effect.gen(function*() {
  return class Test {
    get value() {
      return Effect.fail("error")
    }
  }
})
