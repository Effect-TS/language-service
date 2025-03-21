/**
 * @since 1.0.0
 */
import * as ReadonlyArray from "effect/Array"
import * as Eq from "effect/Equivalence"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as AST from "./utils/AST.js"
import type { TypeScriptApi } from "./utils/TSAPI.js"
import * as TypeParser from "./utils/TypeParser.js"

const SymbolDisplayPartEq = Eq.make<ts.SymbolDisplayPart>((fa, fb) =>
  fa.kind === fb.kind && fa.text === fb.text
)

const JSDocTagInfoEq = Eq.make<ts.JSDocTagInfo>((fa, fb) =>
  fa.name === fb.name && typeof fa.text === typeof fb.text &&
  (typeof fa.text !== "undefined" ? Eq.array(SymbolDisplayPartEq)(fa.text!, fb.text!) : true)
)

/**
 * @since 1.0.0
 */
export function dedupeJsDocTags(quickInfo: ts.QuickInfo): ts.QuickInfo {
  if (quickInfo.tags) {
    return {
      ...quickInfo,
      tags: ReadonlyArray.dedupeWith(quickInfo.tags, JSDocTagInfoEq)
    }
  }
  return quickInfo
}

function formatTypeForQuickInfo(
  ts: TypeScriptApi,
  typeChecker: ts.TypeChecker
) {
  return (channelType: ts.Type, channelName: string) => {
    const stringRepresentation = typeChecker.typeToString(
      channelType,
      undefined,
      ts.TypeFormatFlags.NoTruncation
    )
    return `type ${channelName} = ${stringRepresentation}`
  }
}

export function prependEffectTypeArguments(ts: TypeScriptApi, program: ts.Program) {
  return (sourceFileName: string, position: number, quickInfo: ts.QuickInfo): ts.QuickInfo => {
    const sourceFile = program.getSourceFile(sourceFileName)
    if (!sourceFile) return quickInfo

    const hasTruncationHappened =
      ts.displayPartsToString(quickInfo.displayParts).indexOf("...") > -1
    if (!hasTruncationHappened) return quickInfo

    const typeChecker = program.getTypeChecker()

    const effectTypeArgsDocumentation = pipe(
      AST.getNodesContainingRange(ts)(sourceFile, AST.toTextRange(position)),
      ReadonlyArray.head,
      Option.flatMap((_) =>
        TypeParser.effectType(ts, typeChecker)(typeChecker.getTypeAtLocation(_), _)
      ),
      Option.map((_) => [{
        kind: "text",
        text: (
          "```ts\n" +
          "/* Effect Type Parameters */\n" +
          formatTypeForQuickInfo(ts, typeChecker)(_.A, "Success") +
          "\n" +
          formatTypeForQuickInfo(ts, typeChecker)(_.E, "Failure") +
          "\n" +
          formatTypeForQuickInfo(ts, typeChecker)(_.R, "Requirements") +
          "\n```\n"
        )
      }]),
      Option.getOrElse(() => [] as Array<ts.SymbolDisplayPart>)
    )

    if (quickInfo.documentation) {
      return {
        ...quickInfo,
        documentation: effectTypeArgsDocumentation.concat(quickInfo.documentation)
      }
    }

    return {
      ...quickInfo,
      documentation: effectTypeArgsDocumentation
    }
  }
}
