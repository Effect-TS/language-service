// @effect-diagnostics *:off
// @effect-diagnostics instanceOfSchema:warning
import { Schema } from "effect"

class User extends Schema.Class<User>("User")({ name: Schema.String }) {}
declare const value: unknown
export const preview = value instanceof User
