import type ts from "typescript"
import * as AST from "../core/AST"
import * as Nano from "../core/Nano"
import * as TypeScriptApi from "../core/TypeScriptApi"

export const appendEffectCompletionEntryData = Nano.fn("collectNamespaceImports")(
  function*(sourceFile: ts.SourceFile, applicableCompletions: ts.WithMetadata<ts.CompletionInfo> | undefined) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const program = yield* Nano.service(TypeScriptApi.TypeScriptProgram)
    const namespaceByFileName = new Map<string, { namespaceName: string }>()
    const excludedByFileName = new Map<string, Array<string>>()
    const host: ts.ModuleResolutionHost = program as any

    const barrelModule = ts.resolveModuleName("effect", sourceFile.fileName, program.getCompilerOptions(), host)
    if (barrelModule.resolvedModule) {
      const barrelPath = barrelModule.resolvedModule.resolvedFileName
      const barrelSource = program.getSourceFile(barrelPath) ||
        ts.createSourceFile(barrelPath, host.readFile(barrelPath) || "", sourceFile.languageVersion, true)
      if (barrelSource) {
        for (const statement of barrelSource.statements) {
          if (ts.isExportDeclaration(statement)) {
            const exportClause = statement.exportClause
            const moduleSpecifier = statement.moduleSpecifier
            if (moduleSpecifier && ts.isStringLiteral(moduleSpecifier)) {
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
                  namespaceByFileName.set(unbarreledModulePath, { namespaceName: exportClause.name.text })
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

    if (applicableCompletions) {
      return {
        ...applicableCompletions,
        entries: applicableCompletions.entries.map((entry) => {
          if (
            entry.data && entry.data.fileName && !entry.insertText && !entry.filterText && entry.data.exportName &&
            entry.data.moduleSpecifier
          ) {
            const namespaceInfo = namespaceByFileName.get(entry.data.fileName)
            if (namespaceInfo) {
              // do not touch named exports like pipe etc...
              const isExcluded = (excludedByFileName.get(entry.data.exportName) || []).includes(entry.data.fileName)
              if (isExcluded) return entry
              // ok touch the entry
              return {
                ...entry,
                insertText: namespaceInfo.namespaceName + "." + entry.name,
                filterText: entry.name,
                data: {
                  ...entry.data,
                  effectNamespaceName: namespaceInfo.namespaceName
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
    if (!applicableCompletionEntryDetails) return applicableCompletionEntryDetails
    if (!data) return applicableCompletionEntryDetails
    if (!("effectNamespaceName" in data)) return applicableCompletionEntryDetails
    const codeActions = applicableCompletionEntryDetails.codeActions
    if (codeActions && codeActions.length === 1) {
      const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
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
            (changeTracker) =>
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
                  ts.factory.createStringLiteral(String(data.moduleSpecifier))
                ),
                true,
                preferences || {}
              )
          )

          return {
            ...applicableCompletionEntryDetails,
            codeActions: [
              {
                description: "Import * as " + data.effectNamespaceName + " from " + data.moduleSpecifier,
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
