import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const serviceAsParameter = LSP.createDiagnostic({
  name: "serviceAsParameter",
  code: 55,
  description:
    "Warns when a yielded service is passed as an argument instead of letting the callee yield it from context",
  group: "antipattern",
  severity: "suggestion",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("serviceAsParameter.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    // Check if a callee expression refers to a Layer construction method
    const isLayerConstruction = Nano.fn("serviceAsParameter.isLayerConstruction")(
      function*(calleeExpr: ts.Expression) {
        if (!ts.isPropertyAccessExpression(calleeExpr)) {
          return yield* TypeParser.TypeParserIssue.issue
        }
        yield* Nano.firstSuccessOf([
          typeParser.isNodeReferenceToEffectLayerModuleApi("succeed")(calleeExpr),
          typeParser.isNodeReferenceToEffectLayerModuleApi("effect")(calleeExpr),
          typeParser.isNodeReferenceToEffectLayerModuleApi("scoped")(calleeExpr),
          typeParser.isNodeReferenceToEffectLayerModuleApi("sync")(calleeExpr)
        ])
      }
    )

    // Check if a yield* expression yields a Context.Tag or ServiceMap.Service
    const isServiceYield = Nano.fn("serviceAsParameter.isServiceYield")(
      function*(yieldedExpr: ts.Expression) {
        const yieldedType = typeChecker.getTypeAtLocation(yieldedExpr)
        yield* pipe(
          typeParser.contextTag(yieldedType, yieldedExpr),
          Nano.orElse(() => typeParser.serviceType(yieldedType, yieldedExpr))
        )
      }
    )

    const nodeToVisit: Array<ts.Node> = [sourceFile]
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.pop()!
      ts.forEachChild(node, appendNodeToVisit)

      // Try to match Effect.gen, Effect.fn, or Effect.fnUntraced generators
      const generatorFunction = yield* pipe(
        typeParser.effectGen(node),
        Nano.map((result) => result.generatorFunction),
        Nano.orElse(() =>
          pipe(
            typeParser.effectFnGen(node),
            Nano.map((result) => result.generatorFunction)
          )
        ),
        Nano.orElse(() =>
          pipe(
            typeParser.effectFnUntracedGen(node),
            Nano.map((result) => result.generatorFunction)
          )
        ),
        Nano.orUndefined
      )

      if (!generatorFunction) continue

      const generatorBody = generatorFunction.body

      // Step 1: Collect yielded service bindings by symbol
      const serviceSymbols = new Map<ts.Symbol, string>()

      for (const stmt of generatorBody.statements) {
        if (
          !ts.isVariableStatement(stmt) ||
          !(stmt.declarationList.flags & ts.NodeFlags.Const)
        ) continue

        for (const decl of stmt.declarationList.declarations) {
          if (
            !ts.isIdentifier(decl.name) ||
            !decl.initializer ||
            !ts.isYieldExpression(decl.initializer) ||
            !decl.initializer.asteriskToken ||
            !decl.initializer.expression
          ) continue

          const isService = yield* pipe(
            isServiceYield(decl.initializer.expression),
            Nano.map(() => true),
            Nano.orElse(() => Nano.succeed(false))
          )

          if (isService) {
            const sym = typeChecker.getSymbolAtLocation(decl.name)
            if (sym) {
              serviceSymbols.set(sym, ts.idText(decl.name))
            }
          }
        }
      }

      if (serviceSymbols.size === 0) continue

      // Step 2: Find call arguments that pass yielded services
      // Walk generator body for call expressions (not inside nested functions)
      const callNodes: Array<ts.CallExpression> = []
      const collectCalls = (bodyNode: ts.Node): void => {
        if (
          ts.isFunctionExpression(bodyNode) ||
          ts.isArrowFunction(bodyNode) ||
          ts.isFunctionDeclaration(bodyNode)
        ) {
          // Skip nested function bodies (but not the generator itself)
          if (bodyNode !== generatorFunction) return
        }

        if (ts.isCallExpression(bodyNode)) {
          callNodes.push(bodyNode)
        }

        ts.forEachChild(bodyNode, collectCalls)
      }
      ts.forEachChild(generatorBody, collectCalls)

      for (const callNode of callNodes) {
        // Check if this is a Layer construction call — skip
        const isLayer = yield* pipe(
          isLayerConstruction(callNode.expression),
          Nano.map(() => true),
          Nano.orElse(() => Nano.succeed(false))
        )
        if (isLayer) continue

        // Check if the call returns an Effect type
        const callType = typeChecker.getTypeAtLocation(callNode)
        const isEffectful = yield* pipe(
          typeParser.effectType(callType, callNode),
          Nano.map(() => true),
          Nano.orElse(() => Nano.succeed(false))
        )
        if (!isEffectful) continue

        // Check each argument
        for (const arg of callNode.arguments) {
          if (!ts.isIdentifier(arg)) continue
          const argSymbol = typeChecker.getSymbolAtLocation(arg)
          if (!argSymbol) continue
          const varName = serviceSymbols.get(argSymbol)
          if (varName === undefined) continue

          report({
            location: arg,
            messageText:
              `Service '${varName}' was yielded from context and passed as an argument. Consider having the callee yield the service directly from context instead of receiving it as a parameter.`,
            fixes: []
          })
        }
      }
    }
  })
})
