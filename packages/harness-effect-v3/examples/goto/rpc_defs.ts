import * as Rpc from "@effect/rpc/Rpc"
import * as RpcGroup from "@effect/rpc/RpcGroup"
import * as Schema from "effect/Schema"

export class MakeReservation extends Schema.TaggedRequest<MakeReservation>("MakeReservation")("MakeReservation", {
  payload: {
    seats: Schema.Number
  },
  success: Schema.Void,
  failure: Schema.Never
}) {}

export class GetAvailable extends Rpc.make("GetAvailable", {}) {}

export const MyApi = RpcGroup.make(
  Rpc.fromTaggedRequest(MakeReservation)
)
