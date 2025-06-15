import type ts from "typescript"
import * as Nano from "./core/Nano.js"
import type * as TypeCheckerApi from "./core/TypeCheckerApi.js"
import type * as TypeParser from "./core/TypeParser.js"
import type * as TypeScriptApi from "./core/TypeScriptApi.js"
import { dedupeJsDocs } from "./quickinfo/dedupeJsDocs.js"
import { effectTypeArgs } from "./quickinfo/effectTypeArgs.js"
import { layerInfo } from "./quickinfo/layerInfo.js"

export function quickInfo(
  sourceFile: ts.SourceFile,
  position: number,
  quickInfo: ts.QuickInfo | undefined
): Nano.Nano<
  ts.QuickInfo | undefined,
  never,
  TypeScriptApi.TypeScriptApi | TypeCheckerApi.TypeCheckerApi | TypeParser.TypeParser
> {
  return Nano.gen(function*() {
    const deduped = yield* dedupeJsDocs(quickInfo)
    const withEffectTypeArgs = yield* effectTypeArgs(sourceFile, position, deduped)
    const withLayerInfo = yield* layerInfo(sourceFile, position, withEffectTypeArgs)
    return withLayerInfo
  })
}
