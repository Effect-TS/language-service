import * as Fn from "effect/Function"

export const shouldNotReport = Fn.pipe(
  "Hello",
  (_) => _.length
)

export const shouldReport = Fn.pipe(
  "hello"
)
