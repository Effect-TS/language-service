// 5:28
import * as Effect from "effect/Effect"

// this is a function existing jsdoc
export async function refactorMe(arg: string) {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve(i)
  }
  return await Promise.resolve(arg)
}
