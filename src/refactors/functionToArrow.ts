import * as AST from "../utils/AST.js"
import { pipe } from "../utils/Function.js"
import * as O from "../utils/Option.js"
import * as Ch from "../utils/ReadonlyArray.js"
import { createRefactor } from "./definition.js"

export default createRefactor({
  name: "effect/functionToArrow",
  description: "Convert to arrow",
  apply: (ts) => (sourceFile, textRange) =>
    pipe(
      pipe(
        AST.getNodesContainingRange(ts)(sourceFile, textRange),
        Ch.filter(ts.isFunctionDeclaration)
      ),
      Ch.concat(
        pipe(
          AST.getNodesContainingRange(ts)(sourceFile, textRange),
          Ch.filter(ts.isMethodDeclaration)
        )
      ),
      Ch.filter((node) => !!node.body),
      Ch.filter((node) => !!node.name && AST.isNodeInRange(textRange)(node.name)),
      Ch.head,
      O.map(
        (node) => ({
          kind: "refactor.rewrite.effect.functionToArrow",
          description: "Convert to arrow",
          apply: (changeTracker) => {
            const body = node.body!
            let newBody: ts.ConciseBody = ts.factory.createBlock(body.statements)
            if (body.statements.length === 1) {
              const statement = body.statements[0]
              if (statement && ts.isReturnStatement(statement) && statement.expression) {
                newBody = statement.expression!
              }
            }

            let arrowFlags = ts.getCombinedModifierFlags(node)
            arrowFlags &= ~ts.ModifierFlags.Export
            arrowFlags &= ~ts.ModifierFlags.Default
            const arrowModifiers = ts.factory.createModifiersFromModifierFlags(arrowFlags)

            const arrowFunction = ts.factory.createArrowFunction(
              arrowModifiers,
              node.typeParameters,
              node.parameters,
              undefined,
              ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
              newBody
            )

            let constFlags = ts.getCombinedModifierFlags(node)
            constFlags &= ~arrowFlags
            const constModifiers = ts.factory.createModifiersFromModifierFlags(constFlags)

            let newDeclaration: ts.Node = node
            if (ts.isMethodDeclaration(node)) {
              newDeclaration = ts.factory.createPropertyDeclaration(
                constModifiers,
                node.name!,
                undefined,
                undefined,
                arrowFunction
              )
            } else if (ts.isFunctionDeclaration(node)) {
              newDeclaration = ts.factory.createVariableStatement(
                constModifiers,
                ts.factory.createVariableDeclarationList(
                  [
                    ts.factory.createVariableDeclaration(
                      node.name!,
                      undefined,
                      undefined,
                      arrowFunction
                    )
                  ],
                  ts.NodeFlags.Const
                )
              )
            }
            changeTracker.replaceNode(sourceFile, node, newDeclaration)
          }
        })
      )
    )
})
