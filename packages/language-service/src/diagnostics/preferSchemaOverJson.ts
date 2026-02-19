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

    // Plain check: is this node a JSON.parse or JSON.stringify call?
    const isJsonCall = (node: ts.Node): node is ts.CallExpression =>
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      ts.idText(node.expression.expression) === "JSON" &&
      (ts.idText(node.expression.name) === "parse" || ts.idText(node.expression.name) === "stringify")

    // Plain walk up parents from a JSON call to find the nearest enclosing
    // Effect.try(...) CallExpression (if the JSON call is inside a lazy/thunk
    // that is an argument to it). Returns undefined if no such pattern is found.
    const findEnclosingEffectTry = (jsonCall: ts.CallExpression): ts.CallExpression | undefined => {
      const parent = jsonCall.parent

      let lazy: ts.ArrowFunction | ts.FunctionExpression | undefined
      // () => JSON.parse(...) - arrow with expression body
      if (
        ts.isArrowFunction(parent) &&
        parent.body === jsonCall &&
        parent.parameters.length === 0 &&
        (!parent.typeParameters || parent.typeParameters.length === 0)
      ) {
        lazy = parent
      }
      // () => { return JSON.parse(...) } - block body with single return
      if (
        !lazy &&
        ts.isReturnStatement(parent) &&
        parent.expression === jsonCall
      ) {
        const block = parent.parent
        if (ts.isBlock(block) && block.statements.length === 1) {
          const fn = block.parent
          if (
            (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) &&
            fn.parameters.length === 0 &&
            (!fn.typeParameters || fn.typeParameters.length === 0)
          ) {
            lazy = fn
          }
        }
      }

      if (!lazy) return undefined
      const lazyParent = lazy.parent

      // Effect.try(() => JSON.parse(...)) - lazy is direct argument
      if (
        ts.isCallExpression(lazyParent) &&
        lazyParent.arguments.length > 0 &&
        lazyParent.arguments[0] === lazy
      ) {
        return lazyParent
      }
      // Effect.try({ try: () => JSON.parse(...), ... }) - lazy is inside "try" property
      if (
        ts.isPropertyAssignment(lazyParent) &&
        ts.isIdentifier(lazyParent.name) &&
        ts.idText(lazyParent.name) === "try"
      ) {
        const objLiteral = lazyParent.parent
        if (ts.isObjectLiteralExpression(objLiteral)) {
          const callExpr = objLiteral.parent
          if (
            ts.isCallExpression(callExpr) &&
            callExpr.arguments.length > 0 &&
            callExpr.arguments[0] === objLiteral
          ) {
            return callExpr
          }
        }
      }

      return undefined
    }

    // Step 1: Collect all JSON.parse/JSON.stringify calls with a plain traversal (no Nano).
    // Most files won't have any JSON API usage, so this early-exit is a big perf win.
    const jsonCalls: Array<ts.CallExpression> = []
    const collectJsonCalls = (node: ts.Node): void => {
      if (isJsonCall(node)) {
        jsonCalls.push(node)
      }
      ts.forEachChild(node, collectJsonCalls)
    }
    ts.forEachChild(sourceFile, collectJsonCalls)

    if (jsonCalls.length === 0) return

    // Step 2: For each JSON call, check if it's inside Effect.try or Effect.gen/fn
    // Match Effect.try(() => JSON.parse/stringify(...)) - simple form
    const effectTrySimple = (node: ts.CallExpression) =>
      Nano.gen(function*() {
        yield* typeParser.isNodeReferenceToEffectModuleApi("try")(node.expression)
        if (node.arguments.length === 0) return yield* TypeParser.TypeParserIssue.issue
        const lazyFn = yield* typeParser.lazyExpression(node.arguments[0])
        if (!isJsonCall(lazyFn.expression)) return yield* TypeParser.TypeParserIssue.issue
        return lazyFn.expression as ts.CallExpression
      })

    // Match Effect.try({ try: () => JSON.parse/stringify(...), ... }) - object form
    const effectTryObject = (node: ts.CallExpression) =>
      Nano.gen(function*() {
        yield* typeParser.isNodeReferenceToEffectModuleApi("try")(node.expression)
        if (node.arguments.length === 0) return yield* TypeParser.TypeParserIssue.issue
        const arg = node.arguments[0]
        if (!ts.isObjectLiteralExpression(arg)) return yield* TypeParser.TypeParserIssue.issue
        const tryProp = arg.properties.find(
          (p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && ts.idText(p.name) === "try"
        ) as ts.PropertyAssignment | undefined
        if (!tryProp) return yield* TypeParser.TypeParserIssue.issue
        const lazyFn = yield* typeParser.lazyExpression(tryProp.initializer)
        if (!isJsonCall(lazyFn.expression)) return yield* TypeParser.TypeParserIssue.issue
        return lazyFn.expression as ts.CallExpression
      })

    // Match direct JSON.parse/stringify inside Effect generator
    const jsonMethodInEffectGen = (jsonCall: ts.CallExpression) =>
      Nano.gen(function*() {
        const { effectGen, scopeNode } = yield* typeParser.findEnclosingScopes(jsonCall)
        if (!effectGen || effectGen.body.statements.length === 0) {
          return yield* TypeParser.TypeParserIssue.issue
        }
        if (scopeNode && scopeNode !== effectGen.generatorFunction) {
          return yield* TypeParser.TypeParserIssue.issue
        }
        return jsonCall
      })

    for (const jsonCall of jsonCalls) {
      // Walk up to find the enclosing Effect.try call (if any)
      const effectTryCall = findEnclosingEffectTry(jsonCall)

      let match: Option.Option<ts.CallExpression>
      if (effectTryCall) {
        match = yield* pipe(
          Nano.firstSuccessOf([
            effectTrySimple(effectTryCall),
            effectTryObject(effectTryCall)
          ]),
          Nano.option
        )
      } else {
        match = yield* pipe(
          jsonMethodInEffectGen(jsonCall),
          Nano.option
        )
      }

      if (Option.isSome(match)) {
        report({
          location: match.value,
          messageText: "Consider using Effect Schema for JSON operations instead of JSON.parse/JSON.stringify",
          fixes: []
        })
      }
    }
  })
})
