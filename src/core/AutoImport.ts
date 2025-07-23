import * as Array from "effect/Array"
import * as Predicate from "effect/Predicate"
import type * as ts from "typescript"
import * as LanguageServicePluginOptions from "./LanguageServicePluginOptions"
import * as Nano from "./Nano"
import * as TypeScriptApi from "./TypeScriptApi"

interface ImportKindNamed {
  _tag: "NamedImport"
  moduleName: string | undefined
  fileName: string
  name: string
  introducedPrefix?: string
}

interface ImportKindNamespace {
  _tag: "NamespaceImport"
  moduleName: string | undefined
  fileName: string
  name: string
  introducedPrefix: string | undefined
}

export type ImportKind = ImportKindNamed | ImportKindNamespace

export interface AutoImportProvider {
  resolve(exportFileName: string, exportName: string): ImportKind | undefined
  sortText(exportFileName: string, exportName: string): string | undefined
}

export const makeAutoImportProvider: (
  fromSourceFile: ts.SourceFile
) => Nano.Nano<
  AutoImportProvider,
  never,
  | TypeScriptApi.TypeScriptApi
  | TypeScriptApi.TypeScriptProgram
  | LanguageServicePluginOptions.LanguageServicePluginOptions
> = Nano.fn("TypeScriptApi")(function*(
  fromSourceFile: ts.SourceFile
) {
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
  const program = yield* Nano.service(TypeScriptApi.TypeScriptProgram)
  const languageServicePluginOptions = yield* Nano.service(LanguageServicePluginOptions.LanguageServicePluginOptions)
  const host = program as any as ts.ProgramHost<ts.BuilderProgram>
  const getModuleSpecifier = TypeScriptApi.makeGetModuleSpecifier(ts)

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
      const info = TypeScriptApi.parsePackageContentNameAndVersionFromScope({ packageJsonScope: packageJsonInfo })
      if (!info) return { entrypoints, exportedKeys: [] }
      return { entrypoints, exportedKeys: info.exportsKeys }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      return undefined
    }
  }

  const mapFromBarrelToNamespace = new Map<string, Record<string, string>>() // barrelFile => Record<exportName, reexportedFile>
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
    function*(packagePatterns: Array<string>, kind: "namespace" | "barrel") {
      for (const packagePattern of packagePatterns) {
        const packageNames = yield* TypeScriptApi.resolveModulePattern(fromSourceFile, packagePattern)
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
                mapFilenameToExportExcludes.set(barrelSourceFile.fileName, [
                  ...(mapFilenameToExportExcludes.get(barrelSourceFile.fileName) || []),
                  namedExport.name
                ])
                break
              }
            }
          }
        }
      }
    }
  )

  yield* collectImportCache(languageServicePluginOptions.namespaceImportPackages, "namespace")
  yield* collectImportCache(languageServicePluginOptions.barrelImportPackages, "barrel")

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

  const resolve = (exportFileName: string, exportName: string): ImportKindNamed | ImportKindNamespace | undefined => {
    // case 0) excluded
    const excludedExports = mapFilenameToExportExcludes.get(exportFileName)
    if (excludedExports && excludedExports.includes(exportName)) return
    // case 1) namespace import { Effect } from "effect" we need to change both file and introduce alias name
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
            introducedPrefix: undefined
          })
        }
      }
    }
    // case 2) namespace import { intoDeferred } from "effect/Effect" filename is already ok, need to add "Effect."
    const introducedAlias = mapFilenameToModuleAlias.get(exportFileName)
    if (introducedAlias) {
      return ({
        _tag: "NamespaceImport",
        fileName: exportFileName,
        moduleName: resolveModuleName(exportFileName),
        name: introducedAlias,
        introducedPrefix: introducedAlias
      })
    }
    // case 3) barrel import { succeed } from "effect/Effect"
    const mapToBarrel = mapFromNamespaceToBarrel.get(exportFileName)
    if (mapToBarrel) {
      return ({
        _tag: "NamedImport",
        fileName: mapToBarrel.fileName,
        moduleName: resolveModuleName(mapToBarrel.fileName),
        name: mapToBarrel.alias,
        introducedPrefix: mapToBarrel.alias
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
