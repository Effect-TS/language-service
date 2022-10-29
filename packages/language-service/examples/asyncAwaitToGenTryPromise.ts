// 4:28
import * as Effect from "@effect/core/io/Effect"

export async function refactorMe(arg: string) {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve(i)
  }
  return await Promise.resolve(arg)
}
