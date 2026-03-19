// @effect-diagnostics *:off
// @effect-diagnostics missingEffectContext:warning
import { Effect, ServiceMap } from "effect"

class Db extends ServiceMap.Service<Db>()("Db", { make: Effect.succeed({}) }) {}

// @ts-expect-error
export const preview: Effect.Effect<void> = Db.asEffect().pipe(Effect.asVoid)
