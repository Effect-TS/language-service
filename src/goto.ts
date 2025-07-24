import type * as ts from "typescript"
import type * as Nano from "./core/Nano"
import type * as TypeCheckerApi from "./core/TypeCheckerApi"
import type * as TypeScriptApi from "./core/TypeScriptApi"
import type * as TypeScriptUtils from "./core/TypeScriptUtils"
import { effectRpcDefinition } from "./goto/effectRpcDefinition"

export function goto(
  applicableGotoDefinition: ts.DefinitionInfoAndBoundSpan | undefined,
  sourceFile: ts.SourceFile,
  position: number
): Nano.Nano<
  ts.DefinitionInfoAndBoundSpan | undefined,
  never,
  | TypeScriptApi.TypeScriptApi
  | TypeScriptUtils.TypeScriptUtils
  | TypeScriptApi.TypeScriptProgram
  | TypeCheckerApi.TypeCheckerApi
> {
  return effectRpcDefinition(applicableGotoDefinition, sourceFile, position)
}
