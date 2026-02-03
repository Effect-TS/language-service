import { Schema } from "effect"

export interface ExternalUser {
  id: number
  name: string
  email: string
  isActive: boolean
  metadata?: Record<string, string>
}

export type ExternalStatus = "pending" | "active" | "completed"

export const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String
})
export type User = Schema.Schema.Type<typeof User>
