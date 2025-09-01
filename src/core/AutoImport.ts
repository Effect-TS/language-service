import * as Array from "effect/Array"
import * as Predicate from "effect/Predicate"
import type * as ts from "typescript"
import * as LanguageServicePluginOptions from "./LanguageServicePluginOptions"
import * as Nano from "./Nano"
import * as TypeScriptApi from "./TypeScriptApi"
import * as TypeScriptUtils from "./TypeScriptUtils"

interface ImportKindNamed {
  _tag: "NamedImport"
  moduleName: string | undefined
  fileName: string
  name: string
  aliasName: string | undefined
  introducedPrefix: string | undefined
}

interface ImportKindNamespace {
  _tag: "NamespaceImport"
  moduleName: string | undefined
  fileName: string
  name: string
  aliasName: string | undefined
  introducedPrefix: string | undefined
}

export type ImportKind = ImportKindNamed | ImportKindNamespace

export interface AutoImportProvider {
  resolve(exportFileName: string, exportName: string): ImportKind | undefined
  sortText(exportFileName: string, exportName: string): string | undefined
}

export interface ParsedImportFromTextChange {
  moduleName: string
  exportName: string | undefined
}

export const makeAutoImportProvider: (
  fromSourceFile: ts.SourceFile
) => Nano.Nano<
  AutoImportProvider,
  never,
  | TypeScriptApi.TypeScriptApi
  | TypeScriptUtils.TypeScriptUtils
  | TypeScriptApi.TypeScriptProgram
  | LanguageServicePluginOptions.LanguageServicePluginOptions
> = Nano.fn("TypeScriptApi")(function*(
  fromSourceFile: ts.SourceFile
) {
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
  const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
  const program = yield* Nano.service(TypeScriptApi.TypeScriptProgram)
  const languageServicePluginOptions = yield* Nano.service(LanguageServicePluginOptions.LanguageServicePluginOptions)
  const host = program as any as ts.ProgramHost<ts.BuilderProgram>
  const getModuleSpecifier = tsUtils.makeGetModuleSpecifier()

  function collectSourceFileReexports(
    sourceFile: ts.SourceFile
  ) {
    const namespaceExports: Array<
      { exportClause: ts.NamespaceExport; moduleSpecifier: ts.StringLiteral; name: string }
    > = []
    const namedExports: Array<
      { exportClause: ts.NamedExports; moduleSpecifier: ts.StringLiteral; name: string; aliasName: string }
    > = []

    for (const statement of sourceFile.statements) {
      if (!ts.isExportDeclaration(statement)) continue
      if (!statement.exportClause) continue
      const moduleSpecifier = statement.moduleSpecifier
      if (!moduleSpecifier) continue
      if (!ts.isStringLiteral(moduleSpecifier)) continue
      const exportClause = statement.exportClause
      if (ts.isNamespaceExport(exportClause)) {
        if (!exportClause.name) continue
        if (!ts.isIdentifier(exportClause.name)) continue
        namespaceExports.push({
          moduleSpecifier,
          exportClause,
          name: exportClause.name.text
        })
      }
      if (ts.isNamedExports(exportClause)) {
        for (const exportSpecifier of exportClause.elements) {
          const exportName = exportSpecifier.propertyName || exportSpecifier.name
          if (!ts.isIdentifier(exportName)) continue
          if (!ts.isIdentifier(exportSpecifier.name)) continue
          namedExports.push({
            moduleSpecifier,
            exportClause,
            name: exportName.text,
            aliasName: exportSpecifier.name.text
          })
        }
      }
    }

    return { namespaceExports, namedExports }
  }

  function getPackageInfo(
    fromFileName: string,
    packageName: string
  ): { entrypoints: Array<string>; exportedKeys: Array<string> } | undefined {
    try {
      // then we resolve the package info
      const packageJsonInfo = (ts as any).resolvePackageNameToPackageJson(
        packageName,
        fromFileName,
        program.getCompilerOptions(),
        host
      )
      if (!packageJsonInfo) return
      // resolve the list of entrypoints
      const _entrypoints = (ts as any).getEntrypointsFromPackageJsonInfo(
        packageJsonInfo,
        program.getCompilerOptions(),
        host
      )
      // we expect string[] of fileNames
      if (!_entrypoints) return
      if (!Array.isArray(_entrypoints)) return
      if (!Array.every(Predicate.isString)) return
      const entrypoints = _entrypoints.map((_) => String(_))
      const info = tsUtils.parsePackageContentNameAndVersionFromScope({ packageJsonScope: packageJsonInfo })
      if (!info) return { entrypoints, exportedKeys: [] }
      return { entrypoints, exportedKeys: info.exportsKeys }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      return undefined
    }
  }

  const mapFromBarrelToNamespace = new Map<string, Record<string, string>>() // barrelFile => Record<exportName, reexportedFile>
  const mapFromBarrelToBarrel = new Map<string, Record<string, { fileName: string; exportName: string }>>() // barrelFile => Record<exportName, { fileName: reexportedFile, exportName: exportName }>
  const mapFromNamespaceToBarrel = new Map<string, { fileName: string; alias: string }>() // namespaceFile => { fileName: barrelFile, alias: exportName }
  const mapFilenameToModuleAlias = new Map<string, string>() // fileName => moduleAlias
  const mapFilenameToExportExcludes = new Map<string, Array<string>>() // fileName => Array<exportName>
  const mapFilenameToModuleName = new Map<string, string>() // fileName => moduleName

  const collectModuleNames = (packageName: string, exportedKey: string) => {
    const appendPart = exportedKey === "." ? "" : (exportedKey.startsWith("./") ? exportedKey.slice(1) : exportedKey)
    const absoluteName = packageName + appendPart
    const absoluteFileName = ts.resolveModuleName(
      absoluteName,
      fromSourceFile.fileName,
      program.getCompilerOptions(),
      host
    )
    if (!absoluteFileName) return
    if (!absoluteFileName.resolvedModule) return
    const realPath = host.realpath
      ? host.realpath(absoluteFileName.resolvedModule.resolvedFileName)
      : absoluteFileName.resolvedModule.resolvedFileName
    if (mapFilenameToModuleName.has(realPath)) return
    mapFilenameToModuleName.set(realPath, absoluteName)
  }

  const collectImportCache = Nano.fn("TypeScriptApi")(
    function*(
      packagePatterns: Array<string>,
      kind: "namespace" | "barrel",
      topLevelNamedReexports: "ignore" | "follow"
    ) {
      for (const packagePattern of packagePatterns) {
        const packageNames = tsUtils.resolveModulePattern(fromSourceFile, packagePattern)
        for (const packageName of packageNames) {
          const packageInfo = getPackageInfo(fromSourceFile.fileName, packageName)
          if (!packageInfo) continue
          for (const exportedKey of packageInfo.exportedKeys) {
            collectModuleNames(packageName, exportedKey)
          }
          for (const _fileName of packageInfo.entrypoints) {
            const realFileName = host.realpath ? host.realpath(_fileName) : _fileName
            const isPackageRoot = mapFilenameToModuleName.get(realFileName) === packageName
            const barrelSourceFile = program.getSourceFile(realFileName) ||
              ts.createSourceFile(realFileName, host.readFile(realFileName) || "", fromSourceFile.languageVersion, true)
            const reExports = collectSourceFileReexports(barrelSourceFile)
            if (!reExports) continue
            // heuristic: we want at least one namespace export for the file to be considered a barrel
            if (reExports.namespaceExports.length === 0) continue
            for (const namespaceReexport of reExports.namespaceExports) {
              const reexportedFile = ts.resolveModuleName(
                namespaceReexport.moduleSpecifier.text,
                barrelSourceFile.fileName,
                program.getCompilerOptions(),
                host
              )
              if (!reexportedFile) continue
              if (!reexportedFile.resolvedModule) continue
              switch (kind) {
                case "namespace": {
                  mapFromBarrelToNamespace.set(
                    barrelSourceFile.fileName,
                    {
                      ...(mapFromBarrelToNamespace.get(barrelSourceFile.fileName) || {}),
                      [namespaceReexport.name]: reexportedFile.resolvedModule.resolvedFileName
                    }
                  )
                  mapFilenameToModuleAlias.set(
                    reexportedFile.resolvedModule.resolvedFileName,
                    namespaceReexport.name
                  )
                  continue
                }
                case "barrel": {
                  mapFromNamespaceToBarrel.set(reexportedFile.resolvedModule.resolvedFileName, {
                    fileName: barrelSourceFile.fileName,
                    alias: namespaceReexport.name
                  })
                }
              }
            }
            if (isPackageRoot) {
              for (const namedExport of reExports.namedExports) {
                if (topLevelNamedReexports === "ignore") {
                  mapFilenameToExportExcludes.set(barrelSourceFile.fileName, [
                    ...(mapFilenameToExportExcludes.get(barrelSourceFile.fileName) || []),
                    namedExport.name
                  ])
                } else if (topLevelNamedReexports === "follow") {
                  const reexportedFile = ts.resolveModuleName(
                    namedExport.moduleSpecifier.text,
                    barrelSourceFile.fileName,
                    program.getCompilerOptions(),
                    host
                  )
                  if (!reexportedFile) continue
                  if (!reexportedFile.resolvedModule) continue
                  mapFromBarrelToBarrel.set(barrelSourceFile.fileName, {
                    ...(mapFromBarrelToBarrel.get(barrelSourceFile.fileName) || {}),
                    [namedExport.name]: {
                      fileName: reexportedFile.resolvedModule.resolvedFileName,
                      exportName: namedExport.name
                    }
                  })
                  mapFromBarrelToBarrel.set(reexportedFile.resolvedModule.resolvedFileName, {
                    ...(mapFromBarrelToBarrel.get(reexportedFile.resolvedModule.resolvedFileName) || {}),
                    [namedExport.name]: {
                      fileName: reexportedFile.resolvedModule.resolvedFileName,
                      exportName: namedExport.name
                    }
                  })
                }
              }
            }
          }
        }
      }
    }
  )

  yield* collectImportCache(
    languageServicePluginOptions.namespaceImportPackages,
    "namespace",
    languageServicePluginOptions.topLevelNamedReexports
  )
  yield* collectImportCache(languageServicePluginOptions.barrelImportPackages, "barrel", "ignore")

  const resolveModuleName = (fileName: string) => {
    const fixedModuleName = mapFilenameToModuleName.get(fileName)
    if (fixedModuleName) return fixedModuleName
    if (!getModuleSpecifier) return fileName
    const moduleSpecifier = getModuleSpecifier(
      program.getCompilerOptions(),
      fromSourceFile,
      fromSourceFile.fileName,
      fileName,
      host
    )
    if (!moduleSpecifier) return fileName
    return moduleSpecifier
  }

  const resolveAliasName = (chosenName: string) => {
    const aliasName = languageServicePluginOptions.importAliases[chosenName]
    if (aliasName) return aliasName
    return undefined
  }

  const resolve = (exportFileName: string, exportName: string): ImportKindNamed | ImportKindNamespace | undefined => {
    // case 0) excluded
    const excludedExports = mapFilenameToExportExcludes.get(exportFileName)
    if (excludedExports && excludedExports.includes(exportName)) return
    // case 1) need to rewrite the import as a barrel import from another module
    const mapToBarrelRewritten = mapFromBarrelToBarrel.get(exportFileName)
    if (mapToBarrelRewritten && exportName in mapToBarrelRewritten) {
      const reexportedFile = mapToBarrelRewritten[exportName]
      if (reexportedFile) {
        return ({
          _tag: "NamedImport",
          fileName: reexportedFile.fileName,
          moduleName: resolveModuleName(reexportedFile.fileName),
          name: exportName,
          aliasName: resolveAliasName(exportName),
          introducedPrefix: undefined
        })
      }
    }
    // case 2) namespace import { Effect } from "effect" we need to change both file and introduce alias name
    const mapToNamespace = mapFromBarrelToNamespace.get(exportFileName)
    if (mapToNamespace && exportName in mapToNamespace) {
      const namespacedFileName = mapToNamespace[exportName]!
      if (namespacedFileName) {
        const introducedAlias = mapFilenameToModuleAlias.get(namespacedFileName)
        if (introducedAlias) {
          return ({
            _tag: "NamespaceImport",
            fileName: namespacedFileName,
            moduleName: resolveModuleName(namespacedFileName),
            name: introducedAlias,
            aliasName: resolveAliasName(introducedAlias),
            introducedPrefix: undefined
          })
        }
      }
    }
    // case 3) namespace import { intoDeferred } from "effect/Effect" filename is already ok, need to add "Effect."
    const introducedAlias = mapFilenameToModuleAlias.get(exportFileName)
    if (introducedAlias) {
      return ({
        _tag: "NamespaceImport",
        fileName: exportFileName,
        moduleName: resolveModuleName(exportFileName),
        name: introducedAlias,
        aliasName: resolveAliasName(introducedAlias),
        introducedPrefix: resolveAliasName(introducedAlias) || introducedAlias
      })
    }
    // case 4) barrel import { succeed } from "effect/Effect"
    const mapToBarrel = mapFromNamespaceToBarrel.get(exportFileName)
    if (mapToBarrel) {
      return ({
        _tag: "NamedImport",
        fileName: mapToBarrel.fileName,
        moduleName: resolveModuleName(mapToBarrel.fileName),
        name: mapToBarrel.alias,
        aliasName: resolveAliasName(mapToBarrel.alias),
        introducedPrefix: resolveAliasName(mapToBarrel.alias) || mapToBarrel.alias
      })
    }
  }

  const sortText = (exportFileName: string, exportName: string) => {
    // case 0) excluded
    const excludedExports = mapFilenameToExportExcludes.get(exportFileName)
    if (excludedExports && excludedExports.includes(exportName)) return
    // case 1) namespace import { Effect } from "effect" we need to move it to the bottom
    const mapToNamespace = mapFromBarrelToNamespace.get(exportFileName)
    if (mapToNamespace && exportName in mapToNamespace) return "99"
  }

  return { resolve, sortText }
})

const importProvidersCache = new Map<string, AutoImportProvider>()

export const getOrMakeAutoImportProvider = Nano.fn("getOrMakeAutoImportProvider")(function*(
  sourceFile: ts.SourceFile
) {
  const autoImportProvider = importProvidersCache.get(sourceFile.fileName) ||
    (yield* makeAutoImportProvider(sourceFile))
  importProvidersCache.set(sourceFile.fileName, autoImportProvider)
  return autoImportProvider
})

export const parseImportOnlyChanges = Nano.fn("parseImportOnlyChanges")(function*(
  sourceFile: ts.SourceFile,
  changes: ReadonlyArray<ts.TextChange>
) {
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
  const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
  const deletions: Array<ts.TextChange> = []
  const imports: Array<ParsedImportFromTextChange> = []

  for (const change of changes) {
    // deletions are fine
    if (change.newText.length === 0) {
      deletions.push(change)
      continue
    }
    // is this an import? We try to parse it
    if (change.newText.trim().startsWith("import") && change.newText.trim().includes("from")) {
      try {
        const parsedImport = ts.createSourceFile("test.ts", change.newText, sourceFile.languageVersion, false)
        for (const statement of parsedImport.statements) {
          if (!ts.isImportDeclaration(statement)) return
          const moduleSpecifier = statement.moduleSpecifier
          if (!ts.isStringLiteral(moduleSpecifier)) return
          const moduleName = moduleSpecifier.text
          const importClause = statement.importClause
          if (!importClause) return
          const namedBindings = importClause.namedBindings
          if (!namedBindings) return
          if (ts.isNamedImports(namedBindings)) {
            for (const importSpecifier of namedBindings.elements) {
              if (!ts.isIdentifier(importSpecifier.name)) return
              const exportName = importSpecifier.name.text
              imports.push({ moduleName, exportName })
              continue
            }
          } else if (ts.isNamespaceImport(namedBindings)) {
            imports.push({ moduleName, exportName: undefined })
            continue
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_) {
        return
      }
    } else {
      // this may be an addition to an existing import
      const ancestorNodes = tsUtils.getAncestorNodesInRange(sourceFile, {
        pos: change.span.start,
        end: change.span.start
      })
      const importNodes = ancestorNodes.filter((node) => ts.isImportDeclaration(node))
      const importNode = importNodes[0]
      if (!importNode) return
      const moduleSpecifier = importNode.moduleSpecifier
      if (!ts.isStringLiteral(moduleSpecifier)) return
      const moduleName = moduleSpecifier.text
      const exportName = change.newText.replace(/,/ig, "").trim()
      if (exportName.length === 0) return
      imports.push({ moduleName, exportName })
    }
  }

  return { deletions, imports }
})

export const addImport = (
  ts: TypeScriptApi.TypeScriptApi,
  sourceFile: ts.SourceFile,
  changeTracker: ts.textChanges.ChangeTracker,
  preferences: ts.UserPreferences | undefined,
  effectAutoImport: ImportKind
) => {
  let description = ""

  // add the import based on the style
  switch (effectAutoImport._tag) {
    case "NamespaceImport": {
      const aliasName = effectAutoImport.aliasName || effectAutoImport.name
      const importModule = effectAutoImport.moduleName || effectAutoImport.fileName
      description = `Import * as ${aliasName} from "${importModule}"`
      ts.insertImports(
        changeTracker,
        sourceFile,
        ts.factory.createImportDeclaration(
          undefined,
          ts.factory.createImportClause(
            false,
            undefined,
            ts.factory.createNamespaceImport(ts.factory.createIdentifier(aliasName))
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
      if (effectAutoImport.aliasName) {
        description = `Import { ${effectAutoImport.name} as ${effectAutoImport.aliasName} } from "${importModule}"`
      } else {
        description = `Import { ${effectAutoImport.name} } from "${importModule}"`
      }
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
              const existingImportSpecifier = namedImports.elements.find((element) => {
                if (effectAutoImport.aliasName) {
                  return element.name.text === effectAutoImport.name &&
                    element.propertyName?.text === effectAutoImport.aliasName
                }
                return element.name.text === effectAutoImport.name
              })
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
                      effectAutoImport.aliasName ? ts.factory.createIdentifier(effectAutoImport.name) : undefined,
                      ts.factory.createIdentifier(effectAutoImport.aliasName || effectAutoImport.name)
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
                    effectAutoImport.aliasName ? ts.factory.createIdentifier(effectAutoImport.name) : undefined,
                    ts.factory.createIdentifier(effectAutoImport.aliasName || effectAutoImport.name)
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

  return { description }
}
