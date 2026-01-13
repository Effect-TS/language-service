import { Effect } from "effect"

class MyErrorTagged {
  readonly _tag = "MyErrorTagged"
  constructor(readonly cause: unknown) {}
}

// Effect.fn with regular (non-generator) function - catchAll that should be mapError
export const shouldReportEffectFnRegular = Effect.fn(
  () => Effect.fail("error"),
  Effect.catchAll((cause) => Effect.fail(new MyErrorTagged(cause)))
)

export const shouldReportEffectFnRegularTraced = Effect.fn("traced")(
  () => Effect.fail("error"),
  Effect.catchAll((cause) => Effect.fail(new MyErrorTagged(cause)))
)

// Should NOT report: catchAll returning Effect.succeed
export const shouldNotReportEffectFnRegular = Effect.fn(
  () => Effect.fail("error"),
  Effect.catchAll(() => Effect.succeed(42))
)
