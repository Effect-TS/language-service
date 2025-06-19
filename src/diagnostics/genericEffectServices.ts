import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const genericEffectServices = LSP.createDiagnostic({
  name: "genericEffectServices",
  code: 10,
  apply: Nano.fn("genericEffectServices.apply")(function*(sourceFile) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    const effectDiagnostics: Array<LSP.ApplicableDiagnosticDefinition> = []

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      const typesToCheck: Array<[ts.Type, ts.Node]> = []

      if (ts.isClassDeclaration(node) && node.name && node.typeParameters && node.heritageClauses) {
        const classSym = typeChecker.getSymbolAtLocation(node.name)
        if (classSym) {
          const type = typeChecker.getTypeOfSymbol(classSym)
          typesToCheck.push([type, node.name!])
        }
      } else {
        ts.forEachChild(node, appendNodeToVisit)
        continue
      }

      // check the types
      for (const [type, reportAt] of typesToCheck) {
        yield* pipe(
          typeParser.contextTag(type, node),
          Nano.map(() => {
            effectDiagnostics.push({
              node: reportAt,
              category: ts.DiagnosticCategory.Warning,
              messageText:
                `Effect Services with type parameters are not supported because they cannot be properly discriminated at runtime, which may cause unexpected behavior.`,
              fixes: []
            })
          }),
          Nano.orElse(() => Nano.sync(() => ts.forEachChild(node, appendNodeToVisit))),
          Nano.ignore
        )
      }
    }

    return effectDiagnostics
  })
})
