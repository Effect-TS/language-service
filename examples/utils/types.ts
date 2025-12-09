export interface ExternalUser {
  id: number
  name: string
  email: string
  isActive: boolean
  metadata?: Record<string, string>
}

export type ExternalStatus = "pending" | "active" | "completed"
