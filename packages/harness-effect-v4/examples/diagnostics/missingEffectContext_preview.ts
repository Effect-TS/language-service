// @effect-diagnostics *:off
// @effect-diagnostics missingEffectContext:warning
import { Effect, Context } from "effect"

class Db extends Context.Service<Db>()("Db", { make: Effect.succeed({}) }) {}

// @ts-expect-error
export const preview: Effect.Effect<void> = Db.asEffect().pipe(Effect.asVoid)
