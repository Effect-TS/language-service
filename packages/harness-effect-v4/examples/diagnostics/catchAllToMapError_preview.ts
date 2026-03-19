// @effect-diagnostics *:off
// @effect-diagnostics catchAllToMapError:warning
import { Effect } from "effect"

class WrappedError {
  constructor(readonly cause: unknown) {}
}

export const preview = Effect.fail("boom").pipe(
  Effect.catch((cause) => Effect.fail(new WrappedError(cause)))
)
