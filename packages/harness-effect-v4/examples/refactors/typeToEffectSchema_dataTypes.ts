// 8:23
import type * as Chunk from "effect/Chunk"
import type * as Duration from "effect/Duration"
import type * as Result from "effect/Result"
import type * as Option from "effect/Option"
import * as Schema from "effect/Schema"

export interface MyStruct {
  optionProp: Option.Option<string>
  eitherProp: Result.Result<number, string>
  pickProp: Pick<{ a: string; b: boolean }, "a">
  omitProp: Omit<{ a: string; b: boolean }, "b">
  chunkProp: Chunk.Chunk<string>
  durationProp: Duration.Duration
}
