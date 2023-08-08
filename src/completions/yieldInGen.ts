import { createApplicableCompletionDefinition, createCompletion } from "@effect/language-service/completions/definition"
import * as AST from "@effect/language-service/utils/AST"
import { pipe } from "@effect/language-service/utils/Function"
import * as O from "@effect/language-service/utils/Option"
import * as Ch from "@effect/language-service/utils/ReadonlyArray"

export default createCompletion({
  name: "effect/yieldInGen",
  description: "Suggest yielding inside generators",
  apply: (ts) =>
    (sourceFile, textRange) => {
      function isGeneratorDeclaration(node: ts.Node): node is ts.FunctionDeclaration {
        return ts.isFunctionExpression(node) && !!node.asteriskToken
      }

      function isEffectGeneneratorDeclarationLike(node: ts.Node): O.Option<ts.Identifier> {
        if (!isGeneratorDeclaration(node)) return O.none
        // only 1 parameter (required)
        const parameters = node.parameters
        if (parameters.length !== 1) return O.none
        // with no strange bindings
        const parameterName = parameters[0].name
        if (!ts.isIdentifier(parameterName)) return O.none
        return O.some(parameterName)
      }

      const outerNodes = pipe(
        AST.getNodesContainingRange(ts)(sourceFile, textRange),
        Ch.filter((node) => node.kind !== ts.SyntaxKind.CloseParenToken)
      )

      return pipe(
        outerNodes,
        Ch.head,
        O.flatMap((currentKeyword) => {
          return pipe(
            outerNodes,
            // find innermost Yield or Generator
            Ch.reduce(O.none as O.Option<ts.YieldExpression | ts.Identifier>, (best, node) => {
              if (O.isSome(best)) return best
              if (ts.isYieldExpression(node)) return O.some(node)
              return isEffectGeneneratorDeclarationLike(node)
            }),
            // if it is a yield we are in, we cannot double-yield
            O.flatMap((node) => ts.isYieldExpression(node) ? O.none : O.some(node)),
            // create the completion item
            O.map((adapterIdentifier) => {
              const keywordText = currentKeyword.getText(sourceFile)
              const insertText = "yield* " + adapterIdentifier.text + "(" + keywordText + ")"
              const name = "yield* " + adapterIdentifier.text + "(" +
                AST.getHumanReadableName(sourceFile, currentKeyword) + ")"
              return createApplicableCompletionDefinition({
                name,
                sortText: insertText,
                insertText,
                isRecommended: true,
                replacementSpan: { start: currentKeyword.pos, length: textRange.pos - currentKeyword.pos }
              })
            })
          )
        })
      )
    }
})
