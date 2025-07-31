import type ts from "typescript"
import type * as LanguageServicePluginOptions from "./core/LanguageServicePluginOptions.js"
import * as Nano from "./core/Nano.js"
import type * as TypeCheckerApi from "./core/TypeCheckerApi.js"
import type * as TypeParser from "./core/TypeParser.js"
import type * as TypeScriptApi from "./core/TypeScriptApi.js"
import type * as TypeScriptUtils from "./core/TypeScriptUtils.js"
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
  | TypeScriptApi.TypeScriptApi
  | TypeScriptUtils.TypeScriptUtils
  | TypeCheckerApi.TypeCheckerApi
  | TypeParser.TypeParser
  | LanguageServicePluginOptions.LanguageServicePluginOptions
> {
  return Nano.gen(function*() {
    const deduped = yield* dedupeJsDocs(quickInfo)
    const withEffectTypeArgs = yield* effectTypeArgs(sourceFile, position, deduped)
    const withLayerInfo = yield* layerInfo(sourceFile, position, withEffectTypeArgs)
    return withLayerInfo
  })
}
