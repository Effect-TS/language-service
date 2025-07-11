import { pipe } from "effect/Function"
import type ts from "typescript"
import * as AST from "../core/AST.js"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const scopeInLayerEffect = LSP.createDiagnostic({
  name: "scopeInLayerEffect",
  code: 13,
  severity: "warning",
  apply: Nano.fn("scopeInLayerEffect.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const layerModuleIdentifier = yield* pipe(
      AST.findImportedModuleIdentifierByPackageAndNameOrBarrel(
        sourceFile,
        "effect",
        "Layer"
      ),
      Nano.map((_) => _.text),
      Nano.orElse(() => Nano.succeed("Layer"))
    )

    function parseLayerEffectApiCall(node: ts.Node): { methodIdentifier: ts.Identifier } | undefined {
      // should be a call expression of a property access like Layer.effect
      // we first check thats a call, then ensure that the callee is a property access
      // and that the property is "effect"
      if (!ts.isCallExpression(node)) return
      const expression = node.expression
      if (!ts.isPropertyAccessExpression(expression)) return
      // we check that the api is called on the Layer module
      const calledModule = expression.expression
      if (!(ts.isIdentifier(calledModule) && calledModule.text === layerModuleIdentifier)) return
      const methodIdentifier = expression.name
      // *.effect, *.effectContext, whatever...
      if (!(ts.isIdentifier(methodIdentifier) && methodIdentifier.text.toLowerCase().startsWith("effect"))) return
      return { methodIdentifier }
    }

    const reportIfLayerRequireScope = (type: ts.Type, node: ts.Node, methodIdentifier: ts.Identifier | undefined) => {
      let toCheck = [type]
      const entries: Array<ts.Type> = []
      while (toCheck.length > 0) {
        const type = toCheck.pop()!
        if (type.isUnion()) {
          toCheck = toCheck.concat(type.types)
        } else {
          entries.push(type)
        }
      }
      return pipe(
        Nano.firstSuccessOf(entries.map((type) => typeParser.scopeType(type, node))),
        Nano.map(() =>
          report({
            node,
            messageText:
              `Seems like you are constructing a layer with a scope in the requirements.\nConsider using "scoped" instead to get rid of the scope in the requirements.`,
            fixes: methodIdentifier ?
              [{
                fixName: "scopeInLayerEffect_scoped",
                description: "Use scoped for Layer creation",
                apply: Nano.gen(function*() {
                  const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

                  changeTracker.replaceNode(
                    sourceFile,
                    methodIdentifier,
                    ts.factory.createIdentifier("scoped")
                  )
                })
              }] :
              []
          })
        ),
        Nano.ignore
      )
    }

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }

    ts.forEachChild(sourceFile, appendNodeToVisit)
    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!

      const layerEffectApiCall = parseLayerEffectApiCall(node)
      if (layerEffectApiCall) {
        const type = typeChecker.getTypeAtLocation(node)
        yield* pipe(
          typeParser.layerType(type, node),
          Nano.flatMap(({ RIn }) => reportIfLayerRequireScope(RIn, node, layerEffectApiCall.methodIdentifier)),
          Nano.ignore
        )
        continue
      }

      if (ts.isClassDeclaration(node) && node.name && node.heritageClauses) {
        const classSym = typeChecker.getSymbolAtLocation(node.name)
        if (classSym) {
          const classType = typeChecker.getTypeOfSymbol(classSym)
          const defaultLayer = typeChecker.getPropertyOfType(classType, "Default")
          if (defaultLayer) {
            const type = typeChecker.getTypeOfSymbolAtLocation(defaultLayer, node)
            yield* pipe(
              typeParser.layerType(type, node),
              Nano.flatMap(({ RIn }) => reportIfLayerRequireScope(RIn, node, undefined)),
              Nano.ignore
            )
            continue
          }
        }
      }

      ts.forEachChild(node, appendNodeToVisit)
    }
  })
})
