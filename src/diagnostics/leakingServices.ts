import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeParser from "../utils/TypeParser.js"

export const leakingServices = LSP.createDiagnostic({
  name: "leakingServices",
  code: 8,
  apply: Nano.fn("leakingServices.apply")(function*(sourceFile) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    const effectDiagnostics: Array<LSP.ApplicableDiagnosticDefinition> = []
    const unnecessaryGenerators = new Map<ts.Node, Nano.Nano<ts.Node>>()

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      // we need to check the type of the class declaration (if any)
      const typesToCheck = [typeChecker.getTypeAtLocation(node)]
      if (node.parent && ts.isClassDeclaration(node) && node.name && node.parent === node.getSourceFile()) {
        const classSym = typeChecker.getSymbolAtLocation(node.name)
        if (classSym) {
          const type = typeChecker.getTypeOfSymbolAtLocation(classSym, node.parent)
          typesToCheck.push(type)
        }
      }

      // check the types
      for (const type of typesToCheck) {
        yield* pipe(
          TypeParser.contextTag(type, node),
          Nano.map(({ Identifier, Service }) => {
            console.log(Identifier, Service)
            return true
          }),
          Nano.ignore
        )
      }
    }

    // emit diagnostics
    unnecessaryGenerators.forEach((yieldedResult, effectGenCall) =>
      effectDiagnostics.push({
        node: effectGenCall,
        category: ts.DiagnosticCategory.Suggestion,
        messageText: `This Effect.gen contains a single return statement.`,
        fixes: [{
          fixName: "unnecessaryEffectGen_fix",
          description: "Remove the Effect.gen, and keep the body",
          apply: Nano.gen(function*() {
            const textChanges = yield* Nano.service(
              TypeScriptApi.ChangeTracker
            )
            textChanges.replaceNode(sourceFile, effectGenCall, yield* yieldedResult)
          })
        }]
      })
    )

    return effectDiagnostics
  })
})
