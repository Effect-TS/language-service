// 14:21
import * as Schema from "effect/Schema"

type User = {
  id: number
  name: string
}

const User: User = {
  id: 1,
  name: "John Doe"
}

export interface AppState {
  users: User
}
