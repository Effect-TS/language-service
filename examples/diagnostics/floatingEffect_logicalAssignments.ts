import * as Effect from "effect/Effect"

let logicalAssignment: Effect.Effect<void> | undefined = undefined
logicalAssignment ??= Effect.void
logicalAssignment ||= Effect.void
logicalAssignment &&= Effect.void
