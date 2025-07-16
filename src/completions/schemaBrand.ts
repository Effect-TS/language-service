import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as AST from "../core/AST"
import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeScriptApi from "../core/TypeScriptApi"

export const schemaBrand = LSP.createCompletion({
  name: "schemaBrand",
  apply: Nano.fn("schemaBrand")(function*(sourceFile, position) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

    const maybeInfos = yield* Nano.option(
      AST.parseAccessedExpressionForCompletion(sourceFile, position)
    )
    if (Option.isNone(maybeInfos)) return []
    const { accessedObject } = maybeInfos.value

    if (!ts.isIdentifier(accessedObject)) return []

    const schemaName = Option.match(
      yield* Nano.option(
        AST.findImportedModuleIdentifierByPackageAndNameOrBarrel(
          sourceFile,
          "effect",
          "Schema"
        )
      ),
      {
        onNone: () => "Schema",
        onSome: (_) => _.text
      }
    )

    if (schemaName !== accessedObject.text) return []

    const span = ts.createTextSpan(
      accessedObject.end + 1,
      Math.max(0, position - accessedObject.end - 1)
    )

    return pipe(
      yield* AST.getAncestorNodesInRange(sourceFile, AST.toTextRange(accessedObject.pos)),
      Array.filter(ts.isVariableDeclaration),
      Array.map((_) => _.name && ts.isIdentifier(_.name) ? _.name.text : ""),
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
