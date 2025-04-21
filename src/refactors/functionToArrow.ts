import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import { createRefactor, RefactorNotApplicableError } from "../definition.js"
import * as AST from "../utils/AST.js"
import * as Nano from "../utils/Nano.js"
import * as TypeScriptApi from "../utils/TypeScriptApi.js"

export const functionToArrow = createRefactor({
  name: "effect/functionToArrow",
  description: "Convert to arrow",
  apply: (sourceFile, textRange) =>
    Nano.gen(function*() {
      const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

      const maybeNode = pipe(
        AST.getAncestorNodesInRange(ts)(sourceFile, textRange),
        ReadonlyArray.filter((_) => ts.isFunctionDeclaration(_) || ts.isMethodDeclaration(_)),
        ReadonlyArray.filter((_) => !!_.body),
        ReadonlyArray.filter((_) => !!_.name && AST.isNodeInRange(textRange)(_.name)),
        ReadonlyArray.head
      )

      if (Option.isNone(maybeNode)) return yield* Nano.fail(new RefactorNotApplicableError())
      const node = maybeNode.value

      return ({
        kind: "refactor.rewrite.effect.functionToArrow",
        description: "Convert to arrow",
        apply: Nano.gen(function*() {
          const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

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

          const newDeclaration: ts.Node = AST.tryPreserveDeclarationSemantics(ts)(
            node,
            arrowFunction
          )
          changeTracker.replaceNode(sourceFile, node, newDeclaration, {
            leadingTriviaOption: ts.textChanges.LeadingTriviaOption.IncludeAll,
            trailingTriviaOption: ts.textChanges.TrailingTriviaOption.Exclude
          })
        })
      })
    })
})
