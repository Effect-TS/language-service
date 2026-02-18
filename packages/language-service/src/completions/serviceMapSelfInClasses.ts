import { pipe } from "effect"
import * as Option from "effect/Option"
import * as KeyBuilder from "../core/KeyBuilder.js"
import * as LSP from "../core/LSP"
import * as Nano from "../core/Nano"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi"
import * as TypeScriptUtils from "../core/TypeScriptUtils"

export const serviceMapSelfInClasses = LSP.createCompletion({
  name: "serviceMapSelfInClasses",
  apply: Nano.fn("serviceMapSelfInClasses")(function*(sourceFile, position) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    if (typeParser.supportedEffect() === "v3") return []

    const maybeInfos = tsUtils.parseDataForExtendsClassCompletion(sourceFile, position)
    if (!maybeInfos) return []
    const { accessedObject, className, replacementSpan } = maybeInfos

    // first, given the position, we go back
    const serviceMapIdentifier = tsUtils.findImportedModuleIdentifierByPackageAndNameOrBarrel(
      sourceFile,
      "effect",
      "ServiceMap"
    ) || "ServiceMap"

    // Check if this is a fully qualified name (e.g., Effect.Service)
    const isFullyQualified = serviceMapIdentifier === ts.idText(accessedObject)

    const name = ts.idText(className)

    // create the expected identifier
    const tagKey = (yield* KeyBuilder.createString(sourceFile, name, "service")) || name

    // Build completions based on what the user is extending
    const completions: Array<LSP.CompletionEntryDefinition> = []

    // If extending ServiceMap.Service (either ServiceMap.Service or direct import ServiceMap.Service)
    const hasServiceCompletion = isFullyQualified || Option.isSome(
      yield* pipe(
        typeParser.isNodeReferenceToServiceMapModuleApi("Service")(accessedObject),
        Nano.option
      )
    )
    if (hasServiceCompletion) {
      completions.push({
        name: `Service<${name}, {}>`,
        kind: ts.ScriptElementKind.constElement,
        insertText: isFullyQualified
          ? `${serviceMapIdentifier}.Service<${name}, {${"${0}"}}>()("${tagKey}"){}`
          : `Service<${name}, {${"${0}"}}>()("${tagKey}"){}`,
        replacementSpan,
        isSnippet: true
      })
      completions.push({
        name: `Service<${name}>({ make })`,
        kind: ts.ScriptElementKind.constElement,
        insertText: isFullyQualified
          ? `${serviceMapIdentifier}.Service<${name}>()("${tagKey}", { make: ${"${0}"} }){}`
          : `Service<${name}>()("${tagKey}", { make: ${"${0}"} }){}`,
        replacementSpan,
        isSnippet: true
      })
    }

    return completions
  })
})
