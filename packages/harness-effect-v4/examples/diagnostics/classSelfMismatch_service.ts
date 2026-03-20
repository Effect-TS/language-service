import { ServiceMap, Effect } from "effect"

export class CorrectName extends ServiceMap.Service<CorrectName, {
    writeCache: () => Effect.Effect<void, never, FileSystem | Cache>
    readCache: Effect.Effect<void, never, FileSystem | Cache>
}>()("CorrectName") {}

export class WrongName extends ServiceMap.Service<CorrectName, {
    writeCache: () => Effect.Effect<void, never, FileSystem | Cache>
    readCache: Effect.Effect<void, never, FileSystem | Cache>
}>()("WrongName") {}
