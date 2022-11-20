import * as T from "@effect/core/io/Effect"

const a1 = T.sync(() => 42)
const a2 = T.sync(() => true)
const a3 = T.sync(() => [])

function stuff() {
  return "Hello"
}
const a4 = T.sync(stuff)
const a5 = T.sync(() => stuff)

const b1 = T.failSync(() => 42)
const b2 = T.failSync(() => [])

const c1 = T.dieSync(() => 42)
const c2 = T.dieSync(() => [])
