import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeParser from "../core/TypeParser"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"

export const schemaBrand = LSP.createCompletion({
  name: "schemaBrand",
  apply: Nano.fn("schemaBrand")(function*(sourceFile, position) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    if (typeParser.supportedEffect() === "v4") return []

    const maybeInfos = tsUtils.parseAccessedExpressionForCompletion(sourceFile, position)
    if (!maybeInfos) return []
    const { accessedObject } = maybeInfos

    if (!ts.isIdentifier(accessedObject)) return []

    const schemaName = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
      sourceFile,
      "effect",
      "Schema"
    ) || "Schema"

    if (schemaName !== ts.idText(accessedObject)) return []

    const span = ts.createTextSpan(
      accessedObject.end + 1,
      Math.max(0, position - accessedObject.end - 1)
    )

    return pipe(
      tsUtils.getAncestorNodesInRange(sourceFile, tsUtils.toTextRange(accessedObject.pos)),
      Array.filter(ts.isVariableDeclaration),
      Array.map((_) => _.name && ts.isIdentifier(_.name) ? ts.idText(_.name) : ""),
      Array.filter((_) => _.length > 0),
      Array.head,
      Option.map((name) => [
        {
          name: `brand("${name}")`,
          kind: ts.ScriptElementKind.constElement,
          insertText: `brand("${name}")`,
          replacementSpan: span,
          isSnippet: true as const
        }
      ]),
      Option.getOrElse(() => [])
    )
  })
})
