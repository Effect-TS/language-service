import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const extendsNativeError = LSP.createDiagnostic({
  name: "extendsNativeError",
  code: 50,
  description: "Warns when a class directly extends the native Error class",
  group: "effectNative",
  severity: "off",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("extendsNativeError.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    const errorSymbol = typeChecker.resolveName("Error", undefined, ts.SymbolFlags.Type, false)
    if (!errorSymbol) return

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!

      if (ts.isClassDeclaration(node) && node.heritageClauses) {
        for (const clause of node.heritageClauses) {
          if (clause.token === ts.SyntaxKind.ExtendsKeyword && clause.types.length > 0) {
            const typeExpression = clause.types[0].expression
            const exprSymbol = typeChecker.getSymbolAtLocation(typeExpression)
            // Resolve import aliases to their target symbol
            const resolvedSymbol = exprSymbol && (exprSymbol.flags & ts.SymbolFlags.Alias)
              ? typeChecker.getAliasedSymbol(exprSymbol)
              : exprSymbol
            // Direct symbol match or variable alias (e.g. const E = Error)
            const isNativeError = resolvedSymbol === errorSymbol || (() => {
              if (!resolvedSymbol || resolvedSymbol === errorSymbol) return false
              const exprType = typeChecker.getTypeAtLocation(typeExpression)
              const constructSignatures = typeChecker.getSignaturesOfType(exprType, ts.SignatureKind.Construct)
              if (constructSignatures.length > 0) {
                const instanceType = typeChecker.getReturnTypeOfSignature(constructSignatures[0])
                return instanceType.symbol === errorSymbol
              }
              return false
            })()
            if (isNativeError) {
              report({
                location: node.name ?? typeExpression,
                messageText:
                  "This class extends the native `Error` type directly. Untagged native errors lose distinction in the Effect failure channel.",
                fixes: []
              })
            }
          }
        }
      }

      ts.forEachChild(node, appendNodeToVisit)
    }
  })
})
