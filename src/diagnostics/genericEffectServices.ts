import { pipe } from "effect/Function"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const genericEffectServices = LSP.createDiagnostic({
  name: "genericEffectServices",
  code: 10,
  apply: Nano.fn("genericEffectServices.apply")(function*(report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    return {
      [ts.SyntaxKind.ClassDeclaration]: (node) => {
        if (node.name && node.typeParameters && node.heritageClauses) {
          const classSym = typeChecker.getSymbolAtLocation(node.name)
          if (classSym) {
            const type = typeChecker.getTypeOfSymbol(classSym)
            return pipe(
              typeParser.contextTag(type, node),
              Nano.map(() => {
                report({
                  node: node.name!,
                  category: ts.DiagnosticCategory.Warning,
                  messageText:
                    `Effect Services with type parameters are not supported because they cannot be properly discriminated at runtime, which may cause unexpected behavior.`,
                  fixes: []
                })
              }),
              Nano.ignore
            )
          }
        }
        return Nano.void_
      }
    }
  })
})
