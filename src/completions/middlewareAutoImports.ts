import type ts from "typescript"
import * as AST from "../core/AST"
import * as AutoImport from "../core/AutoImport"
import * as LanguageServicePluginOptions from "../core/LanguageServicePluginOptions"
import * as Nano from "../core/Nano"
import * as TypeScriptApi from "../core/TypeScriptApi"

const importProvidersCache = new Map<string, AutoImport.AutoImportProvider>()

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
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
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
    if (textChanges.length !== 1) return
    const change = textChanges[0]
    // could be either adding an entire import { X } from "module/Name"
    if (
      change.newText.trim().toLowerCase().startsWith("import") && change.newText.indexOf(exportName) > -1
    ) {
      return {
        type: "create" as const
      }
    }
    // or adding just "X" inside the import that already exists
    if (change.newText.indexOf(exportName) > -1) {
      const ancestorNodes = yield* AST.getAncestorNodesInRange(sourceFile, {
        pos: change.span.start,
        end: change.span.start
      })
      const importNodes = ancestorNodes.filter((node) => ts.isImportDeclaration(node))
      if (importNodes.length > 0) {
        return {
          type: "update" as const
        }
      }
    }
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

      // add the import based on the style
      switch (effectAutoImport._tag) {
        case "NamespaceImport": {
          const importModule = effectAutoImport.moduleName || effectAutoImport.fileName
          description = `Import * as ${effectAutoImport.name} from "${importModule}"`
          ts.insertImports(
            changeTracker,
            sourceFile,
            ts.factory.createImportDeclaration(
              undefined,
              ts.factory.createImportClause(
                false,
                undefined,
                ts.factory.createNamespaceImport(ts.factory.createIdentifier(effectAutoImport.name))
              ),
              ts.factory.createStringLiteral(importModule)
            ),
            true,
            preferences || {}
          )
          break
        }
        case "NamedImport": {
          const importModule = effectAutoImport.moduleName || effectAutoImport.fileName
          description = `Import { ${effectAutoImport.name} } from "${importModule}"`
          // loop through the import declarations of the source file
          // and see if we can find the import declaration that is importing the barrel file
          let foundImportDeclaration = false
          for (const statement of sourceFile.statements) {
            if (ts.isImportDeclaration(statement)) {
              const moduleSpecifier = statement.moduleSpecifier
              if (
                moduleSpecifier && ts.isStringLiteral(moduleSpecifier) && moduleSpecifier.text === importModule
              ) {
                // we have found the import declaration that is importing the barrel file
                const importClause = statement.importClause
                if (importClause && importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
                  const namedImports = importClause.namedBindings
                  const existingImportSpecifier = namedImports.elements.find((element) =>
                    element.name.text === effectAutoImport.name
                  )
                  // the import already exists, we can exit
                  if (existingImportSpecifier) {
                    foundImportDeclaration = true
                    break
                  }
                  // we have found the import declaration that is importing the barrel file
                  changeTracker.replaceNode(
                    sourceFile,
                    namedImports,
                    ts.factory.createNamedImports(
                      namedImports.elements.concat([
                        ts.factory.createImportSpecifier(
                          false,
                          undefined,
                          ts.factory.createIdentifier(effectAutoImport.name)
                        )
                      ])
                    )
                  )
                  foundImportDeclaration = true
                  break
                }
              }
            }
          }
          if (!foundImportDeclaration) {
            ts.insertImports(
              changeTracker,
              sourceFile,
              ts.factory.createImportDeclaration(
                undefined,
                ts.factory.createImportClause(
                  false,
                  undefined,
                  ts.factory.createNamedImports(
                    [
                      ts.factory.createImportSpecifier(
                        false,
                        undefined,
                        ts.factory.createIdentifier(effectAutoImport.name)
                      )
                    ]
                  )
                ),
                ts.factory.createStringLiteral(importModule)
              ),
              true,
              preferences || {}
            )
          }
          break
        }
      }
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
    const packagesMetadata = importProvidersCache.get(sourceFile.fileName) ||
      (yield* AutoImport.makeAutoImportProvider(sourceFile))
    importProvidersCache.set(sourceFile.fileName, packagesMetadata)

    // get the expected auto-import
    const effectAutoImport = packagesMetadata(fileName, exportName)
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
