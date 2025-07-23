import type ts from "typescript"
import * as AutoImport from "../core/AutoImport"
import * as LanguageServicePluginOptions from "../core/LanguageServicePluginOptions"
import * as Nano from "../core/Nano"
import * as TypeScriptApi from "../core/TypeScriptApi"

export const appendEffectCompletionEntryData = Nano.fn("appendEffectCompletionEntryData")(
  function*(_sourceFile: ts.SourceFile, applicableCompletions: ts.WithMetadata<ts.CompletionInfo> | undefined) {
    // exit if not enabled
    const languageServicePluginOptions = yield* Nano.service(LanguageServicePluginOptions.LanguageServicePluginOptions)
    if (
      languageServicePluginOptions.namespaceImportPackages.length === 0 &&
      languageServicePluginOptions.barrelImportPackages.length === 0
    ) return applicableCompletions

    // we basically just add the effectReplaceSpan to the data that will be used in the postprocessCompletionEntryDetails
    if (applicableCompletions) {
      return {
        ...applicableCompletions,
        entries: applicableCompletions.entries.map((entry) =>
          entry.data ?
            ({
              ...entry,
              data: {
                ...entry.data,
                effectReplaceSpan: entry.replacementSpan || applicableCompletions.optionalReplacementSpan
              }
            }) :
            entry
        )
      }
    }

    return applicableCompletions
  }
)

const isAutoImportOnlyCodeActions = Nano.fn("isAutoImportOnlyCodeActions")(
  function*(sourceFile: ts.SourceFile, codeActions: Array<ts.CodeAction> | undefined, exportName: string) {
    // we should have existing code actions
    if (!codeActions) return
    // we expect a single entry, either add the entire import, or a single name
    if (codeActions.length !== 1) return
    const action = codeActions[0]
    const changes = action.changes
    if (changes.length !== 1) return
    const fileTextChanges = action.changes[0]
    if (fileTextChanges.fileName !== sourceFile.fileName) return
    const textChanges = fileTextChanges.textChanges
    const parsedImportChanges = yield* AutoImport.parseImportOnlyChanges(sourceFile, textChanges)
    if (!parsedImportChanges) return
    if (parsedImportChanges.deletions.length !== 0) return
    if (parsedImportChanges.imports.length !== 1) return
    if (parsedImportChanges.imports[0].exportName !== exportName) return
    return parsedImportChanges.imports[0]
  }
)

const addImportCodeAction = Nano.fn("getImportFromNamespaceCodeActions")(function*(
  formatOptions: ts.FormatCodeSettings | ts.FormatCodeOptions | undefined,
  preferences: ts.UserPreferences | undefined,
  languageServiceHost: ts.LanguageServiceHost,
  sourceFile: ts.SourceFile,
  effectReplaceSpan: ts.TextSpan,
  effectAutoImport: AutoImport.ImportKind
) {
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
  let description = "auto-import"

  // ok we have proven that the code actions are auto-import actions.
  const formatContext = ts.formatting.getFormatContext(
    formatOptions || {},
    languageServiceHost
  )

  const changes = ts.textChanges.ChangeTracker.with(
    {
      formatContext,
      host: languageServiceHost,
      preferences: preferences || {}
    },
    (changeTracker) => {
      // add the introduced prefix if necessary
      if (effectAutoImport.introducedPrefix) {
        changeTracker.insertText(
          sourceFile,
          effectReplaceSpan.start,
          effectAutoImport.introducedPrefix + "."
        )
      }

      // add the import statement
      description = AutoImport.addImport(
        ts,
        sourceFile,
        changeTracker,
        preferences,
        effectAutoImport
      ).description
    }
  )

  return [
    {
      description,
      changes
    }
  ] satisfies Array<ts.CodeAction>
})

export const postprocessCompletionEntryDetails = Nano.fn("postprocessCompletionEntryDetails")(
  function*(
    sourceFile: ts.SourceFile,
    data: undefined | ts.CompletionEntryData,
    applicableCompletionEntryDetails: ts.CompletionEntryDetails | undefined,
    formatOptions: ts.FormatCodeSettings | ts.FormatCodeOptions | undefined,
    preferences: ts.UserPreferences | undefined,
    languageServiceHost: ts.LanguageServiceHost
  ) {
    // exit if not enabled
    const languageServicePluginOptions = yield* Nano.service(LanguageServicePluginOptions.LanguageServicePluginOptions)
    if (
      languageServicePluginOptions.namespaceImportPackages.length === 0 &&
      languageServicePluginOptions.barrelImportPackages.length === 0
    ) return applicableCompletionEntryDetails

    // if we have no applicable completion entry details, we return early
    if (!applicableCompletionEntryDetails) return applicableCompletionEntryDetails
    // if we have no data, we return early
    if (!data) return applicableCompletionEntryDetails
    // we need fileName and exportName and moduleSpecifier
    const { exportName, fileName, moduleSpecifier } = data
    if (!fileName) return applicableCompletionEntryDetails
    if (!exportName) return applicableCompletionEntryDetails
    if (!moduleSpecifier) return applicableCompletionEntryDetails
    // if we have no effect replace span, we return early
    if (!("effectReplaceSpan" in data)) return applicableCompletionEntryDetails
    const effectReplaceSpan = data.effectReplaceSpan as ts.TextSpan
    // we only intervene if we have auto-import only code actions
    const result = yield* isAutoImportOnlyCodeActions(
      sourceFile,
      applicableCompletionEntryDetails.codeActions,
      exportName
    )
    if (!result) return applicableCompletionEntryDetails

    // get or create the namespace cache info
    const autoImportProvider = yield* AutoImport.getOrMakeAutoImportProvider(sourceFile)

    // get the expected auto-import
    const effectAutoImport = autoImportProvider.resolve(fileName, exportName)
    if (!effectAutoImport) return applicableCompletionEntryDetails

    // create the code action
    const codeActions = yield* addImportCodeAction(
      formatOptions,
      preferences,
      languageServiceHost,
      sourceFile,
      effectReplaceSpan,
      effectAutoImport
    )

    return {
      ...applicableCompletionEntryDetails,
      codeActions
    }
  }
)
