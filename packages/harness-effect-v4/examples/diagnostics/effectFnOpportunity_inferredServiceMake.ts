// @test-config { "effectFn": ["inferred-span"] }
import { Effect, Layer, Context } from "effect"

export class UserService extends Context.Service<UserService>()("UserService", {
    make: Effect.gen(function*() {
        return {
            getUser: (id: string) =>
                Effect.gen(function*() {
                    yield* Effect.log(`Looking up user ${id}`)
                })
        }
    })
}) {}

