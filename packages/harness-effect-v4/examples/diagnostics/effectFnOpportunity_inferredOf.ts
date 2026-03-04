// @test-config { "effectFn": ["inferred-span"] }
import { Effect, Layer, ServiceMap } from "effect"

class UserService extends ServiceMap.Service<UserService, {
    getUser(id: string): Effect.Effect<void>
  }>()("UserService") {}

  
const _shouldTrigger = UserService.of({ // UserService is an Effect Tag
  getUser: (id: string) =>
    Effect.gen(function*() {
      yield* Effect.log(`Looking up user ${id}`)
    })
})
