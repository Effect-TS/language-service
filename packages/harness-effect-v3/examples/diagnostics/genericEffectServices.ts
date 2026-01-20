import { Effect } from "effect"

export class ShouldNotReport extends Effect.Service<ShouldNotReport>()("ShouldNotReport", {
  succeed: {}
}) {}

export class ShouldReport<_A> extends Effect.Service<ShouldReport<any>>()("ShouldReport", {
  succeed: {}
}) {}
