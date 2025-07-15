import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const strictBooleanExpressions = LSP.createDiagnostic({
  name: "strictBooleanExpressions",
  code: 17,
  severity: "off",
  apply: Nano.fn("strictBooleanExpressions.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const conditionChecks = new WeakMap<ts.Node, boolean>()

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      const nodes: Array<ts.Node> = []
      if (ts.isIfStatement(node)) {
        conditionChecks.set(node, true)
        nodes.push(node.expression)
      } else if (ts.isWhileStatement(node)) {
        conditionChecks.set(node, true)
        nodes.push(node.expression)
      } else if (ts.isConditionalExpression(node)) {
        conditionChecks.set(node, true)
        nodes.push(node.condition)
      } else if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
        conditionChecks.set(node, true)
        nodes.push(node.operand)
      } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
        if (conditionChecks.has(node.parent)) conditionChecks.set(node, true)
        nodes.push(node.left)
        nodes.push(node.right)
      } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        if (conditionChecks.has(node.parent)) conditionChecks.set(node, true)
        nodes.push(node.left)
        nodes.push(node.right)
      }

      for (const nodeToCheck of nodes) {
        if (!nodeToCheck) continue
        if (!conditionChecks.has(nodeToCheck.parent)) continue

        const nodeType = typeChecker.getTypeAtLocation(nodeToCheck)
        const constrainedType = typeChecker.getBaseConstraintOfType(nodeType)
        let typesToCheck = [constrainedType || nodeType]

        while (typesToCheck.length > 0) {
          const type = typesToCheck.pop()!

          // unroll union types
          if (type.isUnion()) {
            typesToCheck = typesToCheck.concat(type.types)
            continue
          }

          // skip boolean and never types
          if (type.flags & ts.TypeFlags.Boolean) continue
          if (type.flags & ts.TypeFlags.Never) continue
          if (type.flags & ts.TypeFlags.BooleanLiteral) continue

          // report the error
          const typeName = typeChecker.typeToString(type)
          report({
            node: nodeToCheck,
            messageText: `Unexpected \`${typeName}\` type in condition, expected strictly a boolean instead.`,
            fixes: []
          })
        }
      }
    }
  })
})
