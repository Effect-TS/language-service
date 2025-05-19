import * as Option from "effect/Option"
import * as AST from "../core/AST"
import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeCheckerApi from "../core/TypeCheckerApi"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeParser from "../utils/TypeParser"

export const pipeNonPipeables = LSP.createCompletion({
  name: "effect/pipeNonPipeables",
  apply: Nano.fn("pipeNonPipeables")(function*(sourceFile, position) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)

    // first we find the preceding identifier/property access
    const maybeNode = yield* Nano.option(AST.findOuterPipeableExpressionAtPosition(
      sourceFile,
      position
    ))
    if (Option.isNone(maybeNode)) return []
    const { accessedExpression } = maybeNode.value

    const type = typeChecker.getTypeAtLocation(accessedExpression)
    const isPipeable = yield* Nano.option(TypeParser.pipeableType(type, accessedExpression))
    if (Option.isSome(isPipeable)) return []

    const source = accessedExpression.getFullText(sourceFile)
    const replacementSpan = ts.createTextSpan(
      accessedExpression.pos,
      accessedExpression.end - accessedExpression.pos
    )

    return [{
      name: `pipe(${source}, ...)`,
      kind: ts.ScriptElementKind.constElement,
      insertText: `pipe(${source}, ${"${0}"})`,
      filterText: accessedExpression.getFullText(sourceFile) + ".pipe",
      replacementSpan,
      isSnippet: true,
      commitCharacters: []
    }] satisfies Array<LSP.CompletionEntryDefinition>
  })
})
