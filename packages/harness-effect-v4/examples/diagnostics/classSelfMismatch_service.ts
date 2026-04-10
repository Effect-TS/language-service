import { Context, Effect } from "effect"

export class CorrectName extends Context.Service<CorrectName, {
    writeCache: () => Effect.Effect<void, never, FileSystem | Cache>
    readCache: Effect.Effect<void, never, FileSystem | Cache>
}>()("CorrectName") {}

export class WrongName extends Context.Service<CorrectName, {
    writeCache: () => Effect.Effect<void, never, FileSystem | Cache>
    readCache: Effect.Effect<void, never, FileSystem | Cache>
}>()("WrongName") {}
