import type { DiagnosticDefinitionMessage } from "@effect/language-service/diagnostics/definition"
import { createDiagnostic } from "@effect/language-service/diagnostics/definition"
import * as AST from "@effect/language-service/utils/AST"
import { pipe } from "@effect/language-service/utils/Function"
import * as Ch from "@effect/language-service/utils/ReadonlyArray"

export const noSyncWithConstantMethodsMap = {
  sync: "succeed",
  failSync: "fail",
  dieSync: "die"
}

export function isEffectSyncWithConstantCall(ts: AST.TypeScriptApi) {
  return (moduleIdentifier: string, methodName: string) =>
    (node: ts.Node): node is ts.CallExpression => {
      if (AST.isCombinatorCall(ts)(moduleIdentifier, methodName)(node) && node.arguments.length === 1) {
        const arg = node.arguments[0]
        if (ts.isArrowFunction(arg) && AST.isLiteralConstantValue(ts)(arg.body)) {
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
      const effectIdentifier = AST.getEffectModuleIdentifier(ts)(sourceFile)

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
