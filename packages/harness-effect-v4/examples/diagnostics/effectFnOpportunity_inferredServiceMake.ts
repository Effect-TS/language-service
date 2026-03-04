// @test-config { "effectFn": ["inferred-span"] }
import { Effect, Layer, ServiceMap } from "effect"

export class UserService extends ServiceMap.Service<UserService>()("UserService", {
    make: Effect.gen(function*() {
        return {
            getUser: (id: string) =>
                Effect.gen(function*() {
                    yield* Effect.log(`Looking up user ${id}`)
                })
        }
    })
}) {}

