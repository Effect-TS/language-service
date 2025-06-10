import { MyApi } from "@/goto/rpc_defs"
import * as RpcClient from "@effect/rpc/RpcClient"
import * as Effect from "effect/Effect"

export const program = Effect.gen(function*() {
  const client = yield* RpcClient.make(MyApi)
  yield* client.GetAvailable()
  yield* client.MakeReservation({ seats: 2 })
})
