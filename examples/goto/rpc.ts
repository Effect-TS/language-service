import * as Rpc from "@effect/rpc/Rpc"
import * as RpcClient from "@effect/rpc/RpcClient"
import * as RpcGroup from "@effect/rpc/RpcGroup"
import * as Effect from "effect/Effect"

const MyApi = RpcGroup.make(
  Rpc.make("methodA"),
  Rpc.make("methodB")
)

const program = Effect.gen(function*() {
  const client = yield* RpcClient.make(MyApi)
  yield* client.methodA()
})
