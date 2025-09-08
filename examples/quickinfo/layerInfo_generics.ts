import { Layer } from "effect"
import * as Context from "effect/Context"

const MyTypeId: unique symbol = Symbol.for("x")
type MyTypeId = typeof MyTypeId

export interface IsGeneric<X> {
  readonly [MyTypeId]: MyTypeId
  readonly value: X
}

interface UserRepository {
  getNameById(id: number): string
}

const UserRepository = Context.GenericTag<IsGeneric<UserRepository>>("IsGeneric<UserRepository>")
const userLayer = Layer.succeed(UserRepository, { getNameById: () => "John" } as any)

export const NoComment = userLayer
