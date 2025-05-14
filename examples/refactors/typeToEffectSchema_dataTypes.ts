// 8:23
import * as Option from "effect/Option"
import * as Either from "effect/Either"
import * as Chunk from "effect/Chunk"
import * as Duration from "effect/Duration"
import * as Schema from "effect/Schema"

export interface MyStruct {
    optionProp: Option.Option<string>
    eitherProp: Either.Either<number, string>
    pickProp: Pick<{a: string, b: boolean}, "a">
    omitProp: Omit<{a: string, b: boolean}, "b">
    chunkProp: Chunk.Chunk<string>
    durationProp: Duration.Duration
}
