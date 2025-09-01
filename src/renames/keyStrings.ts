import { pipe } from "effect"
import * as Option from "effect/Option"
import type * as ts from "typescript"
import * as Nano from "../core/Nano"
import * as TypeParser from "../core/TypeParser"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"

export const renameKeyStrings = (
  sourceFile: ts.SourceFile,
  position: number,
  _findInStrings: boolean,
  _findInComments: boolean,
  _preferences: ts.UserPreferences,
  renameLocations: ReadonlyArray<ts.RenameLocation> | undefined
) =>
  Nano.gen(function*() {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const additionalPositions: Array<ts.RenameLocation> = []

    const node = tsUtils.findNodeAtPositionIncludingTrivia(sourceFile, position)
    if (node && ts.isIdentifier(node)) {
      const textToReplace = ts.idText(node)
      const parentClass = node.parent
      if (ts.isClassDeclaration(parentClass) && parentClass.name === node) {
        const baseIdentifier = yield* pipe(
          Nano.map(typeParser.extendsContextTag(parentClass), (_) => [_.keyStringLiteral]),
          Nano.orElse(() => Nano.map(typeParser.extendsEffectService(parentClass), (_) => [_.keyStringLiteral])),
          Nano.orElse(() =>
            Nano.map(typeParser.extendsSchemaTaggedClass(parentClass), (_) => [_.keyStringLiteral, _.tagStringLiteral])
          ),
          Nano.orElse(() =>
            Nano.map(typeParser.extendsSchemaTaggedError(parentClass), (_) => [_.keyStringLiteral, _.tagStringLiteral])
          ),
          Nano.orElse(() => Nano.map(typeParser.extendsDataTaggedError(parentClass), (_) => [_.keyStringLiteral])),
          Nano.orElse(() => Nano.map(typeParser.extendsDataTaggedClass(parentClass), (_) => [_.keyStringLiteral])),
          Nano.orElse(() =>
            Nano.map(
              typeParser.extendsSchemaTaggedRequest(parentClass),
              (_) => [_.keyStringLiteral, _.tagStringLiteral]
            )
          ),
          Nano.option
        )
        if (Option.isSome(baseIdentifier)) {
          for (const keyStringLiteral of baseIdentifier.value) {
            if (!keyStringLiteral) continue
            const baseText = sourceFile.text.slice(keyStringLiteral.pos, keyStringLiteral.end)
            const lastIndex = baseText.lastIndexOf(textToReplace)
            if (lastIndex !== -1) {
              additionalPositions.push({
                fileName: sourceFile.fileName,
                textSpan: {
                  start: keyStringLiteral.pos + lastIndex,
                  length: textToReplace.length
                }
              })
            }
          }
        }
      }
    }
    return additionalPositions.length === 0 ? renameLocations : additionalPositions.concat(renameLocations || [])
  })
