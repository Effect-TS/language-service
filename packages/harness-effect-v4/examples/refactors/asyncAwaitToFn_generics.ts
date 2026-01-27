// 4:28
import * as Effect from "effect/Effect"

export async function refactorMe<X>(arg: X) {
  return await Promise.resolve(arg)
}
