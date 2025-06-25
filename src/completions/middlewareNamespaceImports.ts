import type ts from "typescript"
import * as AST from "../core/AST"
import * as LanguageServicePluginOptions from "../core/LanguageServicePluginOptions"
import * as Nano from "../core/Nano"
import * as TypeScriptApi from "../core/TypeScriptApi"

interface ImportablePackagesMetadata {
  getImportNamespaceByFileName: (fileName: string) => string | undefined
  isExcludedFromNamespaceImport: (fileName: string, exportName: string) => boolean
  getUnbarreledModulePath: (fileName: string, exportName: string) => string | undefined
  getBarreledModulePath: (fileName: string) => { fileName: string; exportName: string } | undefined
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
  const barreledModulePathByFileName = new Map<string, { fileName: string; exportName: string }>()

  for (const packageName of languageServicePluginOptions.namespaceImportPackages) {
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
                  namespaceByFileName.set(unbarreledModulePath, exportClause.name.text)
                  const existingUnbarreledModulePath = unbarreledModulePathByFileName.get(barrelSource.fileName) || []
                  existingUnbarreledModulePath.push({
                    fileName: unbarreledModulePath,
                    exportName: exportClause.name.text
                  })
                  unbarreledModulePathByFileName.set(barrelSource.fileName, existingUnbarreledModulePath)
                  barreledModulePathByFileName.set(unbarreledModulePath, {
                    fileName: barrelSource.fileName,
                    exportName: exportClause.name.text
                  })
                }
                // add the excluded methods to the list
                if (exportClause && ts.isNamedExports(exportClause)) {
                  for (const element of exportClause.elements) {
                    if (!ts.isIdentifier(element.name)) continue
                    const methodName = element.name.text
                    const excludedMethods = excludedByFileName.get(methodName) || []
                    excludedMethods.push(unbarreledModulePath)
                    excludedByFileName.set(methodName, excludedMethods)
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
    getBarreledModulePath: (fileName: string) => barreledModulePathByFileName.get(fileName)
  } satisfies ImportablePackagesMetadata
})

export const appendEffectCompletionEntryData = Nano.fn("appendEffectCompletionEntryData")(
  function*(_sourceFile: ts.SourceFile, applicableCompletions: ts.WithMetadata<ts.CompletionInfo> | undefined) {
    // exit if not enabled
    const languageServicePluginOptions = yield* Nano.service(LanguageServicePluginOptions.LanguageServicePluginOptions)
    if (languageServicePluginOptions.namespaceImportPackages.length === 0) return applicableCompletions

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
    if (languageServicePluginOptions.namespaceImportPackages.length === 0) return applicableCompletionEntryDetails

    const isAutoImportOnlyCodeActions = Nano.fn("isAutoImportOnlyCodeActions")(
      function*(codeActions: Array<ts.CodeAction> | undefined, exportName: string) {
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
    const result = yield* isAutoImportOnlyCodeActions(applicableCompletionEntryDetails.codeActions, exportName)
    if (!result) return applicableCompletionEntryDetails

    // get or create the namespace cache info
    const packagesMetadata = importablePackagesMetadataCache.get(sourceFile.fileName) ||
      (yield* makeImportablePackagesMetadata(sourceFile))
    importablePackagesMetadataCache.set(sourceFile.fileName, packagesMetadata)

    // ok we have proven that the code actions are auto-import actions.
    const formatContext = ts.formatting.getFormatContext(
      formatOptions || {},
      languageServiceHost
    )
    // do not touch named exports like pipe etc...
    const isExcluded = packagesMetadata.isExcludedFromNamespaceImport(
      fileName,
      exportName
    )
    if (isExcluded) return applicableCompletionEntryDetails
    // maybe this is an import from a barrel file?!?!
    const effectUnbarreledModulePath = packagesMetadata.getUnbarreledModulePath(
      fileName,
      exportName
    )

    const effectNamespaceName = packagesMetadata.getImportNamespaceByFileName(
      effectUnbarreledModulePath || fileName
    )
    if (!effectNamespaceName) return applicableCompletionEntryDetails

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

    return {
      ...applicableCompletionEntryDetails,
      codeActions: [
        {
          description: "Import * as " + effectNamespaceName + " from " + newModuleSpecifier,
          changes
        }
      ]
    }
  }
)
