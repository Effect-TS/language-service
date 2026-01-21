// 14:21
import * as Schema from "effect/Schema"

type User = {
  id: number
  name: string
}

const MyUserSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String
})

export interface AppState {
  users: User
}
