import * as Nano from "@effect/language-service/core/Nano"
import * as Either from "effect/Either"
import { pipe } from "effect/Function"

import { describe, expect, it } from "vitest"

describe("nano", () => {
  it("flatMap-ping", () => {
    const program = Nano.flatMap(Nano.succeed(2), (_) => Nano.succeed(_ * 2))
    expect(Nano.run(program)).toEqual(Either.right(4))
  })
  it("sync", () => {
    const program = Nano.sync(() => 42)
    expect(Nano.run(program)).toEqual(Either.right(42))
  })
  it("provide service test", () => {
    const Tag = Nano.Tag<{ value: number }>("test")
    const program = Nano.provideService(Tag, { value: 42 })(Nano.service(Tag))
    expect(Nano.run(program)).toEqual(Either.right({ value: 42 }))
    const program2 = Nano.provideService(Tag, { value: 1 })(Nano.service(Tag))
    expect(Nano.run(program2)).toEqual(Either.right({ value: 1 }))
    const nested = pipe(
      Nano.service(Tag),
      Nano.provideService(Tag, { value: 1 }),
      Nano.flatMap((a) => Nano.map(Nano.service(Tag), (b) => [a, b])),
      Nano.provideService(Tag, { value: 2 }),
      Nano.provideService(Tag, { value: 3 }),
      Nano.run
    )
    expect(nested).toEqual(Either.right([{ value: 1 }, { value: 2 }]))
  })
  it("should run gen", () => {
    const program = Nano.gen(function*() {
      const a = yield* Nano.succeed(1)
      const b = yield* Nano.succeed(2)
      return a + b
    })
    expect(Nano.run(program)).toEqual(Either.right(3))
  })
  it("should run fn", () => {
    const program = Nano.fn("program")(function*(v1: number, v2: number) {
      const a = yield* Nano.succeed(v1)
      const b = yield* Nano.succeed(v2)
      return a + b
    })
    expect(Nano.run(program(1, 2))).toEqual(Either.right(3))
  })

  it("should handle simple context", () => {
    interface MyService {
      value: number
    }
    const myServiceTag = Nano.Tag<MyService>("myServiceTag")
    const result = pipe(
      Nano.service(myServiceTag),
      Nano.provideService(myServiceTag, { value: 42 }),
      Nano.run
    )
    expect(result).toEqual(
      Either.right({ value: 42 })
    )
  })

  it("should catch exceptions", () => {
    const result = pipe(
      Nano.gen(function*() {
        throw "error"
        return yield* Nano.succeed(1)
      }),
      Nano.run
    )
    expect(result).toEqual(
      Either.left(new Nano.NanoDefectException("error"))
    )
  })
  it("orElse", () => {
    const program = pipe(
      Nano.fail("error"),
      Nano.orElse((_) => Nano.succeed(42))
    )
    expect(Nano.run(program)).toEqual(Either.right(42))
  })
})
