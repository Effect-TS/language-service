import type ts from "typescript"
import * as AST from "../core/AST"
import * as LanguageServicePluginOptions from "../core/LanguageServicePluginOptions"
import * as Nano from "../core/Nano"
import * as TypeScriptApi from "../core/TypeScriptApi"

interface ImportablePackagesMetadata {
  getImportNamespaceByFileName: (fileName: string) => string | undefined
  isExcludedFromNamespaceImport: (fileName: string, exportName: string) => boolean
  getUnbarreledModulePath: (fileName: string, exportName: string) => string | undefined

  getBarreledFunctionPath: (
    fileName: string,
    exportName: string
  ) => { fileName: string; exportName: string; packageName: string } | undefined
  getBarreledModulePath: (fileName: string) => { fileName: string; exportName: string; packageName: string } | undefined
}

const importablePackagesMetadataCache = new Map<string, ImportablePackagesMetadata>()

const makeImportablePackagesMetadata = Nano.fn("makeImportablePackagesMetadata")(function*(sourceFile: ts.SourceFile) {
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
  const program = yield* Nano.service(TypeScriptApi.TypeScriptProgram)
  const languageServicePluginOptions = yield* Nano.service(LanguageServicePluginOptions.LanguageServicePluginOptions)
  const host: ts.ModuleResolutionHost = program as any
  const namespaceByFileName = new Map<string, string>()
  const excludedByFileName = new Map<string, Array<string>>()
  const unbarreledModulePathByFileName = new Map<string, Array<{ fileName: string; exportName: string }>>()
  const barreledModulePathByFileName = new Map<string, { fileName: string; exportName: string; packageName: string }>()
  const barreledFunctionPathByFileName = new Map<
    string,
    Array<{ fileName: string; exportName: string; packageName: string }>
  >()

  const packages = [
    ...languageServicePluginOptions.namespaceImportPackages.map((packageName) => ({
      packageName,
      kind: "namespace" as const
    })),
    ...languageServicePluginOptions.barrelImportPackages.map((packageName) => ({
      packageName,
      kind: "barrel" as const
    }))
  ]

  for (const { kind, packageName } of packages) {
    // resolve to the index of the package
    const barrelModule = ts.resolveModuleName(packageName, sourceFile.fileName, program.getCompilerOptions(), host)
    if (barrelModule.resolvedModule) {
      const barrelPath = barrelModule.resolvedModule.resolvedFileName
      // get the index barrel source file
      const barrelSource = program.getSourceFile(barrelPath) ||
        ts.createSourceFile(barrelPath, host.readFile(barrelPath) || "", sourceFile.languageVersion, true)
      if (barrelSource) {
        // loop through the export declarations
        for (const statement of barrelSource.statements) {
          if (ts.isExportDeclaration(statement)) {
            const exportClause = statement.exportClause
            const moduleSpecifier = statement.moduleSpecifier
            // we handle only string literal package names
            if (moduleSpecifier && ts.isStringLiteral(moduleSpecifier)) {
              // now we attempt to resolve the re-exported filename
              const unbarreledModulePathResolved = ts.resolveModuleName(
                moduleSpecifier.text,
                barrelSource.fileName,
                program.getCompilerOptions(),
                host
              )
              if (unbarreledModulePathResolved.resolvedModule) {
                const unbarreledModulePath = unbarreledModulePathResolved.resolvedModule.resolvedFileName
                // add the unbarreled module to the list
                if (exportClause && ts.isNamespaceExport(exportClause) && ts.isIdentifier(exportClause.name)) {
                  if (kind === "namespace") {
                    namespaceByFileName.set(unbarreledModulePath, exportClause.name.text)
                    const existingUnbarreledModulePath = unbarreledModulePathByFileName.get(barrelSource.fileName) || []
                    existingUnbarreledModulePath.push({
                      fileName: unbarreledModulePath,
                      exportName: exportClause.name.text
                    })
                    unbarreledModulePathByFileName.set(barrelSource.fileName, existingUnbarreledModulePath)
                  }
                  if (kind === "barrel") {
                    barreledModulePathByFileName.set(unbarreledModulePath, {
                      fileName: barrelSource.fileName,
                      exportName: exportClause.name.text,
                      packageName
                    })
                  }
                }
                // add the excluded methods to the list
                if (exportClause && ts.isNamedExports(exportClause)) {
                  for (const element of exportClause.elements) {
                    if (!ts.isIdentifier(element.name)) continue
                    const methodName = element.name.text
                    if (kind === "namespace") {
                      const excludedMethods = excludedByFileName.get(methodName) || []
                      excludedMethods.push(unbarreledModulePath)
                      excludedByFileName.set(methodName, excludedMethods)
                    }
                    if (kind === "barrel") {
                      const previousBarreledFunctionPath = barreledFunctionPathByFileName.get(unbarreledModulePath) ||
                        []
                      previousBarreledFunctionPath.push({
                        fileName: barrelSource.fileName,
                        exportName: methodName,
                        packageName
                      })
                      barreledFunctionPathByFileName.set(unbarreledModulePath, previousBarreledFunctionPath)
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return {
    getImportNamespaceByFileName: (fileName: string) => namespaceByFileName.get(fileName),
    isExcludedFromNamespaceImport: (fileName: string, exportName: string) =>
      (excludedByFileName.get(exportName) || []).includes(fileName),
    getUnbarreledModulePath: (fileName: string, exportName: string) =>
      unbarreledModulePathByFileName.get(fileName)?.find((_) => _.exportName === exportName)?.fileName,
    getBarreledModulePath: (fileName: string) => barreledModulePathByFileName.get(fileName),
    getBarreledFunctionPath: (fileName: string, exportName: string) =>
      barreledFunctionPathByFileName.get(fileName)?.find((_) => _.exportName === exportName)
  } satisfies ImportablePackagesMetadata
})

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

const getImportFromNamespaceCodeActions = Nano.fn("getImportFromNamespaceCodeActions")(function*(
  formatOptions: ts.FormatCodeSettings | ts.FormatCodeOptions | undefined,
  preferences: ts.UserPreferences | undefined,
  languageServiceHost: ts.LanguageServiceHost,
  sourceFile: ts.SourceFile,
  effectReplaceSpan: ts.TextSpan,
  effectNamespaceName: string,
  effectUnbarreledModulePath: string | undefined,
  newModuleSpecifier: string
) {
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

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
      // add the import
      ts.insertImports(
        changeTracker,
        sourceFile,
        ts.factory.createImportDeclaration(
          undefined,
          ts.factory.createImportClause(
            false,
            undefined,
            ts.factory.createNamespaceImport(ts.factory.createIdentifier(effectNamespaceName))
          ),
          ts.factory.createStringLiteral(newModuleSpecifier)
        ),
        true,
        preferences || {}
      )
      // if this is a barrel redirect, we need to add the namespace import
      if (!effectUnbarreledModulePath) {
        changeTracker.insertText(
          sourceFile,
          effectReplaceSpan.start,
          effectNamespaceName + "."
        )
      }
    }
  )

  return [
    {
      description: "Import * as " + effectNamespaceName + " from " + newModuleSpecifier,
      changes
    }
  ] satisfies Array<ts.CodeAction>
})

const getImportFromBarrelCodeActions = Nano.fn("getImportFromBarrelCodeActions")(function*(
  formatOptions: ts.FormatCodeSettings | ts.FormatCodeOptions | undefined,
  preferences: ts.UserPreferences | undefined,
  languageServiceHost: ts.LanguageServiceHost,
  sourceFile: ts.SourceFile,
  effectReplaceSpan: ts.TextSpan,
  newModuleSpecifier: string,
  barrelExportName: string,
  shouldPrependExportName: boolean
) {
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

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
      // loop through the import declarations of the source file
      // and see if we can find the import declaration that is importing the barrel file
      let foundImportDeclaration = false
      for (const statement of sourceFile.statements) {
        if (ts.isImportDeclaration(statement)) {
          const moduleSpecifier = statement.moduleSpecifier
          if (moduleSpecifier && ts.isStringLiteral(moduleSpecifier) && moduleSpecifier.text === newModuleSpecifier) {
            // we have found the import declaration that is importing the barrel file
            const importClause = statement.importClause
            if (importClause && importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
              const namedImports = importClause.namedBindings
              const existingImportSpecifier = namedImports.elements.find((element) =>
                element.name.text.toLowerCase() === barrelExportName.toLowerCase()
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
                    ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(barrelExportName))
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
        // add the import
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
                  ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(barrelExportName))
                ]
              )
            ),
            ts.factory.createStringLiteral(newModuleSpecifier)
          ),
          true,
          preferences || {}
        )
      }

      // since this is a barrel redirect, we need to prefix with the name from the barrel file
      if (shouldPrependExportName) {
        changeTracker.insertText(
          sourceFile,
          effectReplaceSpan.start,
          barrelExportName + "."
        )
      }
    }
  )

  return [
    {
      description: "Import { " + barrelExportName + " } from " + newModuleSpecifier,
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

    // we rely on some internal typescript api to get the module specifier
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const program = yield* Nano.service(TypeScriptApi.TypeScriptProgram)
    const getModuleSpecifier = TypeScriptApi.makeGetModuleSpecifier(ts)
    if (!getModuleSpecifier) return applicableCompletionEntryDetails

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
    const packagesMetadata = importablePackagesMetadataCache.get(sourceFile.fileName) ||
      (yield* makeImportablePackagesMetadata(sourceFile))
    importablePackagesMetadataCache.set(sourceFile.fileName, packagesMetadata)

    // do not touch named exports like pipe etc...
    const isExcluded = packagesMetadata.isExcludedFromNamespaceImport(
      fileName,
      exportName
    )
    if (isExcluded) return applicableCompletionEntryDetails

    // pipe function and friends that are re-exported directly from barrel
    const asBarrelFunctionImport = packagesMetadata.getBarreledFunctionPath(fileName, exportName)
    if (asBarrelFunctionImport) {
      const codeActions = yield* getImportFromBarrelCodeActions(
        formatOptions,
        preferences,
        languageServiceHost,
        sourceFile,
        effectReplaceSpan,
        asBarrelFunctionImport.packageName,
        asBarrelFunctionImport.exportName,
        false
      )
      return {
        ...applicableCompletionEntryDetails,
        codeActions
      }
    }

    // get the corresponding barrel module path and export name (only present if the package is set from a barrel file)
    const asBarrelModuleImport = packagesMetadata.getBarreledModulePath(fileName)
    if (asBarrelModuleImport) {
      const codeActions = yield* getImportFromBarrelCodeActions(
        formatOptions,
        preferences,
        languageServiceHost,
        sourceFile,
        effectReplaceSpan,
        asBarrelModuleImport.packageName,
        asBarrelModuleImport.exportName,
        true
      )
      return {
        ...applicableCompletionEntryDetails,
        codeActions
      }
    }

    // maybe this is an import from a barrel file?
    const effectUnbarreledModulePath = packagesMetadata.getUnbarreledModulePath(
      fileName,
      exportName
    )

    // do we want to namespace import instead?
    const asNamespaceImport = packagesMetadata.getImportNamespaceByFileName(
      effectUnbarreledModulePath || fileName
    )
    if (asNamespaceImport) {
      // resolve the module
      const newModuleSpecifier = effectUnbarreledModulePath ?
        getModuleSpecifier(
          program.getCompilerOptions(),
          sourceFile,
          sourceFile.fileName,
          String(effectUnbarreledModulePath || fileName),
          program
        ) :
        moduleSpecifier

      const codeActions = yield* getImportFromNamespaceCodeActions(
        formatOptions,
        preferences,
        languageServiceHost,
        sourceFile,
        effectReplaceSpan,
        asNamespaceImport,
        effectUnbarreledModulePath,
        newModuleSpecifier
      )
      return {
        ...applicableCompletionEntryDetails,
        codeActions
      }
    }

    return applicableCompletionEntryDetails
  }
)
