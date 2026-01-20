import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const preferSchemaOverJson = LSP.createDiagnostic({
  name: "preferSchemaOverJson",
  code: 44,
  description: "Suggests using Effect Schema for JSON operations instead of JSON.parse/JSON.stringify which may throw",
  severity: "suggestion",
  apply: Nano.fn("preferSchemaOverJson.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const parseJsonMethod = (node: ts.Node) =>
      Nano.gen(function*() {
        if (!ts.isCallExpression(node)) return yield* Nano.fail("node is not a call expression")
        const expression = node.expression
        if (!ts.isPropertyAccessExpression(expression)) return yield* Nano.fail("expression is not a property access")
        const objectExpr = expression.expression
        const methodName = ts.idText(expression.name)
        if (!ts.isIdentifier(objectExpr) || ts.idText(objectExpr) !== "JSON") {
          return yield* Nano.fail("object is not JSON")
        }
        if (methodName !== "parse" && methodName !== "stringify") {
          return yield* Nano.fail("method is not parse or stringify")
        }
        return { node, methodName }
      })

    // Match Effect.try(() => JSON.parse/stringify(...)) - simple form
    const effectTrySimple = (node: ts.Node) =>
      Nano.gen(function*() {
        if (!ts.isCallExpression(node)) return yield* Nano.fail("node is not a call expression")
        yield* typeParser.isNodeReferenceToEffectModuleApi("try")(node.expression)
        if (node.arguments.length === 0) return yield* Nano.fail("Effect.try has no arguments")
        const lazyFn = yield* typeParser.lazyExpression(node.arguments[0])
        const jsonMethod = yield* parseJsonMethod(lazyFn.expression)
        return { node: jsonMethod.node, methodName: jsonMethod.methodName }
      })

    // Match Effect.try({ try: () => JSON.parse/stringify(...), ... }) - object form
    const effectTryObject = (node: ts.Node) =>
      Nano.gen(function*() {
        if (!ts.isCallExpression(node)) return yield* Nano.fail("node is not a call expression")
        yield* typeParser.isNodeReferenceToEffectModuleApi("try")(node.expression)
        if (node.arguments.length === 0) return yield* Nano.fail("Effect.try has no arguments")
        const arg = node.arguments[0]
        if (!ts.isObjectLiteralExpression(arg)) return yield* Nano.fail("argument is not an object literal")
        const tryProp = arg.properties.find(
          (p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && ts.idText(p.name) === "try"
        ) as ts.PropertyAssignment | undefined
        if (!tryProp) return yield* Nano.fail("object has no 'try' property")
        const lazyFn = yield* typeParser.lazyExpression(tryProp.initializer)
        const jsonMethod = yield* parseJsonMethod(lazyFn.expression)
        return { node: jsonMethod.node, methodName: jsonMethod.methodName }
      })

    // Match direct JSON.parse/stringify inside Effect generator
    const jsonMethodInEffectGen = (node: ts.Node) =>
      Nano.gen(function*() {
        const jsonMethod = yield* parseJsonMethod(node)
        const { effectGen, scopeNode } = yield* typeParser.findEnclosingScopes(node)
        if (!effectGen || effectGen.body.statements.length === 0) {
          return yield* Nano.fail("not inside an Effect generator")
        }
        if (scopeNode && scopeNode !== effectGen.generatorFunction) {
          return yield* Nano.fail("inside a nested function scope")
        }
        return { node: jsonMethod.node, methodName: jsonMethod.methodName }
      })

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      const match = yield* pipe(
        Nano.firstSuccessOf([
          effectTrySimple(node),
          effectTryObject(node),
          jsonMethodInEffectGen(node)
        ]),
        Nano.option
      )

      if (Option.isSome(match)) {
        report({
          location: match.value.node,
          messageText: "Consider using Effect Schema for JSON operations instead of JSON.parse/JSON.stringify",
          fixes: []
        })
      }
    }
  })
})
