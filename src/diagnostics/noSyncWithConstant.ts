import * as AST from "@effect/language-service/ast"
import type { DiagnosticDefinitionMessage } from "@effect/language-service/diagnostics/definition"
import { createDiagnostic } from "@effect/language-service/diagnostics/definition"
import { getEffectModuleIdentifier, isCombinatorCall, isLiteralConstantValue } from "@effect/language-service/utils"
import * as Ch from "@fp-ts/data/Chunk"
import { pipe } from "@fp-ts/data/Function"

export const noSyncWithConstantMethodsMap = {
  sync: "succeed",
  failSync: "fail",
  dieSync: "die"
}

export function isEffectSyncWithConstantCall(ts: AST.TypeScriptApi) {
  return (moduleIdentifier: string, methodName: string) =>
    (node: ts.Node): node is ts.CallExpression => {
      if (isCombinatorCall(ts)(moduleIdentifier, methodName)(node) && node.arguments.length === 1) {
        const arg = node.arguments[0]
        if (ts.isArrowFunction(arg) && isLiteralConstantValue(ts)(arg.body)) {
          return true
        }
      }
      return false
    }
}

export default createDiagnostic({
  code: 1002,
  category: "warning",
  apply: (ts) =>
    (sourceFile) => {
      const effectIdentifier = getEffectModuleIdentifier(ts)(sourceFile)

      let result: Ch.Chunk<DiagnosticDefinitionMessage> = Ch.empty

      for (const methodName of Object.keys(noSyncWithConstantMethodsMap)) {
        const suggestedMethodName: string = noSyncWithConstantMethodsMap[methodName]!
        result = pipe(
          result,
          Ch.concat(
            pipe(
              AST.collectAll(ts)(sourceFile, isEffectSyncWithConstantCall(ts)(effectIdentifier, methodName)),
              Ch.map((node) => ({
                node,
                messageText: `Value is constant, instead of using ${methodName} you could use ${suggestedMethodName}.`
              }))
            )
          )
        )
      }

      return result
    }
})
