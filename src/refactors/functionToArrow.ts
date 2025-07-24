import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

export const functionToArrow = LSP.createRefactor({
  name: "functionToArrow",
  description: "Convert to arrow",
  apply: Nano.fn("functionToArrow.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)

    const maybeNode = pipe(
      tsUtils.getAncestorNodesInRange(sourceFile, textRange),
      Array.filter((_) => ts.isFunctionDeclaration(_) || ts.isMethodDeclaration(_)),
      Array.filter((_) => !!_.body),
      Array.filter((_) => !!_.name && tsUtils.isNodeInRange(textRange)(_.name)),
      Array.head
    )

    if (Option.isNone(maybeNode)) return yield* Nano.fail(new LSP.RefactorNotApplicableError())
    const node = maybeNode.value

    return ({
      kind: "refactor.rewrite.effect.functionToArrow",
      description: "Convert to arrow",
      apply: pipe(
        Nano.gen(function*() {
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

          const newDeclaration: ts.Node = tsUtils.tryPreserveDeclarationSemantics(
            node,
            arrowFunction
          )
          changeTracker.replaceNode(sourceFile, node, newDeclaration, {
            leadingTriviaOption: ts.textChanges.LeadingTriviaOption.IncludeAll,
            trailingTriviaOption: ts.textChanges.TrailingTriviaOption.Exclude
          })
        }),
        Nano.provideService(TypeScriptApi.TypeScriptApi, ts)
      )
    })
  })
})
