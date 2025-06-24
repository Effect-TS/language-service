import type ts from "typescript"
import * as AST from "../core/AST"
import * as LanguageServicePluginOptions from "../core/LanguageServicePluginOptions"
import * as Nano from "../core/Nano"
import * as TypeScriptApi from "../core/TypeScriptApi"

interface ImportablePackagesMetadata {
  getImportNamespaceByFileName: (fileName: string) => string | undefined
  isExcludedFromNamespaceImport: (fileName: string, exportName: string) => boolean
  getUnbarreledModulePath: (fileName: string, exportName: string) => string | undefined
}

const importablePackagesMetadataCache = new Map<string, ImportablePackagesMetadata>()

const makeImportablePackagesMetadata = Nano.fn("makeImportablePackagesMetadata")(function*(sourceFile: ts.SourceFile) {
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
  const program = yield* Nano.service(TypeScriptApi.TypeScriptProgram)
  const languageServicePluginOptions = yield* Nano.service(LanguageServicePluginOptions.LanguageServicePluginOptions)
  const host: ts.ModuleResolutionHost = program as any
  const namespaceByFileName = new Map<string, string>()
  const excludedByFileName = new Map<string, Array<string>>()
  const unbarreledModulePathByFileName = new Map<string, Array<[exportName: string, unbarreledModulePath: string]>>()

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
                  existingUnbarreledModulePath.push([exportClause.name.text, unbarreledModulePath])
                  unbarreledModulePathByFileName.set(barrelSource.fileName, existingUnbarreledModulePath)
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
      unbarreledModulePathByFileName.get(fileName)?.find(([name]) => name === exportName)?.[1]
  } satisfies ImportablePackagesMetadata
})

export const appendEffectCompletionEntryData = Nano.fn("collectNamespaceImports")(
  function*(sourceFile: ts.SourceFile, applicableCompletions: ts.WithMetadata<ts.CompletionInfo> | undefined) {
    // exit if not enabled
    const languageServicePluginOptions = yield* Nano.service(LanguageServicePluginOptions.LanguageServicePluginOptions)
    if (languageServicePluginOptions.namespaceImportPackages.length === 0) return applicableCompletions

    // get or create the namespace cache info
    const packagesMetadata = importablePackagesMetadataCache.get(sourceFile.fileName) ||
      (yield* makeImportablePackagesMetadata(sourceFile))
    importablePackagesMetadataCache.set(sourceFile.fileName, packagesMetadata)

    // alter the entries to add the effect namespace name and the unbarreled module path
    if (applicableCompletions) {
      return {
        ...applicableCompletions,
        entries: applicableCompletions.entries.map((entry) => {
          if (
            entry.data && entry.data.fileName && !entry.insertText && !entry.filterText && entry.data.exportName &&
            entry.data.moduleSpecifier
          ) {
            // do not touch named exports like pipe etc...
            const isExcluded = packagesMetadata.isExcludedFromNamespaceImport(
              entry.data.fileName,
              entry.data.exportName
            )
            if (isExcluded) return entry
            // maybe this is an import from a barrel file?!?!
            const unbarreledModulePath = packagesMetadata.getUnbarreledModulePath(
              entry.data.fileName,
              entry.data.exportName
            )
            const namespaceName = packagesMetadata.getImportNamespaceByFileName(
              unbarreledModulePath || entry.data.fileName
            )
            if (namespaceName) {
              // ok touch the entry
              return {
                ...entry,
                // insertText: unbarreledModulePath ? namespaceName : namespaceName + "." + entry.name,
                // filterText: entry.name,
                data: {
                  ...entry.data,
                  effectNamespaceName: namespaceName,
                  effectUnbarreledModulePath: unbarreledModulePath || "",
                  effectReplaceSpan: entry.replacementSpan || applicableCompletions.optionalReplacementSpan
                }
              }
            }
          }
          return entry
        })
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

    // we rely on some internal typescript api to get the module specifier
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const program = yield* Nano.service(TypeScriptApi.TypeScriptProgram)
    const getModuleSpecifier = TypeScriptApi.makeGetModuleSpecifier(ts)
    if (!getModuleSpecifier) return applicableCompletionEntryDetails

    // if we have no applicable completion entry details, we return early
    if (!applicableCompletionEntryDetails) return applicableCompletionEntryDetails
    // if we have no data, we return early
    if (!data) return applicableCompletionEntryDetails
    // if we have no effect namespace name or unbarreled module path, we return early
    if (!("effectNamespaceName" in data && "effectUnbarreledModulePath" in data && "effectReplaceSpan" in data)) {
      return applicableCompletionEntryDetails
    }
    const effectReplaceSpan = data.effectReplaceSpan as ts.TextSpan
    const codeActions = applicableCompletionEntryDetails.codeActions
    if (codeActions && codeActions.length === 1) {
      const action = codeActions[0]
      if (action.changes.length === 1) {
        const fileTextChanges = action.changes[0]
        if (fileTextChanges.fileName === sourceFile.fileName && fileTextChanges.textChanges.length === 1) {
          const change = fileTextChanges.textChanges[0]
          let hasImportActions = false
          // could be either adding an entier import { X } from "module/Name"
          if (
            change.newText.trim().toLowerCase().startsWith("import") && change.newText.indexOf(data.exportName) > -1
          ) {
            hasImportActions = true
          }
          // or adding just "X" inside the import that already exists
          if (!hasImportActions && change.newText.indexOf(data.exportName) > -1) {
            const ancestorNodes = yield* AST.getAncestorNodesInRange(sourceFile, {
              pos: change.span.start,
              end: change.span.start
            })
            const importNodes = ancestorNodes.filter((node) => ts.isImportDeclaration(node))
            hasImportActions = importNodes.length > 0
          }
          if (!hasImportActions) return applicableCompletionEntryDetails

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
              // resolve the module
              const isBarrelRedirect = String(data.effectUnbarreledModulePath).length > 0
              const moduleSpecifier = isBarrelRedirect ?
                getModuleSpecifier(
                  program.getCompilerOptions(),
                  sourceFile,
                  sourceFile.fileName,
                  String(data.effectUnbarreledModulePath),
                  program
                ) :
                String(data.moduleSpecifier)
              // add the import
              ts.insertImports(
                changeTracker,
                sourceFile,
                ts.factory.createImportDeclaration(
                  undefined,
                  ts.factory.createImportClause(
                    false,
                    undefined,
                    ts.factory.createNamespaceImport(ts.factory.createIdentifier(String(data.effectNamespaceName)))
                  ),
                  ts.factory.createStringLiteral(moduleSpecifier)
                ),
                true,
                preferences || {}
              )
              // if this is a barrel redirect, we need to add the namespace import
              if (!isBarrelRedirect) {
                changeTracker.insertText(
                  sourceFile,
                  effectReplaceSpan.start,
                  String(data.effectNamespaceName) + "."
                )
              }
            }
          )

          return {
            ...applicableCompletionEntryDetails,
            codeActions: [
              {
                description: "Import * as " + data.effectNamespaceName + " from " + data.effectUnbarreledModulePath,
                changes
              }
            ]
          }
        }
      }
    }
    return applicableCompletionEntryDetails
  }
)
