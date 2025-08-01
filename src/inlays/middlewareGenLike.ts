import { pipe } from "effect/Function"
import type * as ts from "typescript"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

export const middlewareGenLike = Nano.fn("middlewareGenLike")(function*(
  sourceFile: ts.SourceFile,
  _span: ts.TextSpan,
  preferences: ts.UserPreferences | undefined,
  inlayHints: Array<ts.InlayHint>
) {
  // only if the user has enabled the inlay hints for function like return types
  if (!preferences) return inlayHints
  if (preferences.includeInlayFunctionLikeReturnTypeHints !== true) return inlayHints
  if (!inlayHints) return inlayHints

  const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
  const typeParser = yield* Nano.service(TypeParser.TypeParser)
  const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
  const result: Array<ts.InlayHint> = []

  // given a node, parses the type and eventual gen-like
  const parseType = (node: ts.Node) => {
    return pipe(
      Nano.map(typeParser.effectGen(node), (_) => {
        const type = typeChecker.getTypeAtLocation(_.node)
        const typeString = typeChecker.typeToString(type, _.generatorFunction, ts.TypeFormatFlags.NoTruncation)
        return { ..._, typeString }
      }),
      Nano.orElse(() =>
        Nano.map(pipe(typeParser.effectFnGen(node), Nano.orElse(() => typeParser.effectFnUntracedGen(node))), (_) => {
          const fnType = typeChecker.getTypeAtLocation(_.node)
          const types: Array<string> = []
          for (const callSig of fnType.getCallSignatures()) {
            types.push(
              typeChecker.typeToString(callSig.getReturnType(), _.generatorFunction, ts.TypeFormatFlags.NoTruncation)
            )
          }
          return { ..._, typeString: types.join(" | ") }
        })
      )
    )
  }

  // now we loop throgh them, and find the ones that refer to an Effect.gen like function
  for (const inlayHint of inlayHints) {
    let modifiedInlayHint = inlayHint
    if (inlayHint.kind === ts.InlayHintKind.Type) {
      const node = tsUtils.findNodeAtPositionIncludingTrivia(sourceFile, inlayHint.position - 1)
      if (node && node.parent) {
        const possiblyGen = node.parent
        yield* pipe(
          parseType(possiblyGen),
          Nano.map((_) => {
            const argsCloseParen = ts.findChildOfKind(_.generatorFunction, ts.SyntaxKind.CloseParenToken, sourceFile)
            if (
              argsCloseParen && _.body && inlayHint.position >= argsCloseParen.getEnd() &&
              inlayHint.position <= _.body.getStart(sourceFile)
            ) {
              const { displayParts: _displayParts, text: _text, ...toKeep } = inlayHint
              modifiedInlayHint = {
                ...toKeep,
                text: ": " + _.typeString
              }
            }
          }),
          Nano.ignore
        )
      }
    }
    result.push(modifiedInlayHint)
  }

  return result
})
