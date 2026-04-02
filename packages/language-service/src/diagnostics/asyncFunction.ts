import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

type AsyncFunctionNode =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration

export const asyncFunction = LSP.createDiagnostic({
  name: "asyncFunction",
  code: 69,
  description:
    "Warns when declaring async functions and suggests using Effect values and Effect.gen for async control flow",
  group: "effectNative",
  severity: "off",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("asyncFunction.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

    const hasAsyncModifier = (node: AsyncFunctionNode) =>
      ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) === true

    const visit = (node: ts.Node) => {
      if (
        !ts.isFunctionDeclaration(node) &&
        !ts.isFunctionExpression(node) &&
        !ts.isArrowFunction(node) &&
        !ts.isMethodDeclaration(node)
      ) {
        ts.forEachChild(node, visit)
        return undefined
      }

      if (hasAsyncModifier(node)) {
        report({
          location: node,
          messageText:
            "This code declares an async function, consider representing this async control flow with Effect values and `Effect.gen`.",
          fixes: []
        })
      }

      ts.forEachChild(node, visit)
      return undefined
    }

    ts.forEachChild(sourceFile, visit)
  })
})
