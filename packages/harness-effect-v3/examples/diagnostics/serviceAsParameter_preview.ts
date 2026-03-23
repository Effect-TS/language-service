// @effect-diagnostics *:off
// @effect-diagnostics serviceAsParameter:warning
import { Context, Effect } from "effect"

class Database extends Context.Tag("Database")<Database, {
  readonly query: (sql: string) => Effect.Effect<string>
}>() {}

declare const processOrder: (order: string, db: {
  readonly query: (sql: string) => Effect.Effect<string>
}) => Effect.Effect<void>

export const preview = Effect.gen(function*() {
  const db = yield* Database
  yield* processOrder("order-1", db)
})
