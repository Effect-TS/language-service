import * as Nano from "@effect/language-service/utils/Nano"
import * as Either from "effect/Either"
import { pipe } from "effect/Function"

import { describe, expect, it } from "vitest"

describe("nano", () => {
  it("should run gen", () => {
    const program = Nano.gen(function*() {
      const a = yield* Nano.succeed(1)
      const b = yield* Nano.succeed(2)
      return a + b
    })
    expect(Nano.run(program)).toEqual(Either.right(3))
  })

  it("should handle simple context", () => {
    interface MyService {
      value: number
    }
    const myServiceTag = Nano.Tag<MyService>("myServiceTag")
    const result = pipe(
      Nano.service(myServiceTag),
      Nano.provide(myServiceTag, { value: 42 }),
      Nano.run
    )
    expect(result).toEqual(
      Either.right({ value: 42 })
    )
  })
})
