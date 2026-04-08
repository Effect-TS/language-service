import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const unnecessaryArrowBlock = LSP.createDiagnostic({
  name: "unnecessaryArrowBlock",
  code: 72,
  description: "Suggests using a concise arrow body when the block only returns an expression",
  group: "style",
  severity: "off",
  fixable: true,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("unnecessaryArrowBlock.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      if (!ts.isArrowFunction(node) || !ts.isBlock(node.body)) continue
      if (node.body.statements.length !== 1) continue

      const [statement] = node.body.statements
      if (!ts.isReturnStatement(statement) || !statement.expression) continue
      const returnedExpression = statement.expression

      report({
        location: node.body,
        messageText: "This arrow function block only returns an expression and can use a concise body.",
        fixes: [{
          fixName: "unnecessaryArrowBlock_fix",
          description: "Use a concise arrow body",
          apply: Nano.gen(function*() {
            const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
            const replacementNode = ts.factory.updateArrowFunction(
              node,
              node.modifiers,
              node.typeParameters,
              node.parameters,
              node.type,
              node.equalsGreaterThanToken,
              ts.factory.createParenthesizedExpression(returnedExpression)
            )
            changeTracker.replaceNode(sourceFile, node, replacementNode)
          })
        }]
      })
    }
  })
})
