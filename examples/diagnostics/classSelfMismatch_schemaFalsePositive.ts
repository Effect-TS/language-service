import * as Persistable from "./utils"

export class TTLRequest extends Persistable.Class<{
  payload: { id: number }
}>()("TTLRequest", {
  primaryKey: (req) => `TTLRequest:${req.id}`
}) {}
