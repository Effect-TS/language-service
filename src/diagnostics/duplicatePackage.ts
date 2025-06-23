import { hasProperty, isNumber } from "effect/Predicate"
import * as LanguageServicePluginOptions from "../core/LanguageServicePluginOptions.js"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

type ResolvedPackagesCache = Record<string, Record<string, any>>

const checkedPackagesCache = new Map<string, ResolvedPackagesCache>()
const programResolvedCacheSize = new Map<string, number>()

export const duplicatePackage = LSP.createDiagnostic({
  name: "duplicatePackage",
  code: 6,
  severity: "warning",
  apply: Nano.fn("duplicatePackage.apply")(function*(sourceFile, report) {
    const program = yield* Nano.service(TypeScriptApi.TypeScriptProgram)
    const options = yield* Nano.service(LanguageServicePluginOptions.LanguageServicePluginOptions)

    if (sourceFile.statements.length < 1) return

    // whenever we detect the resolution cache size has changed, try again the check
    // this should mitigate how frequently this rule is triggered
    let resolvedPackages: ResolvedPackagesCache = checkedPackagesCache.get(sourceFile.fileName) ||
      {}
    const newResolvedModuleSize =
      hasProperty(program, "resolvedModules") && hasProperty(program.resolvedModules, "size") &&
        isNumber(program.resolvedModules.size) ?
        program.resolvedModules.size :
        0
    const oldResolvedSize = programResolvedCacheSize.get(sourceFile.fileName) || -1
    if (newResolvedModuleSize !== oldResolvedSize) {
      const seenPackages = new Set<string>()
      resolvedPackages = {}
      program.getSourceFiles().map((_) => {
        const packageInfo = TypeScriptApi.parsePackageContentNameAndVersionFromScope(_)
        if (!packageInfo) return
        const packageNameAndVersion = packageInfo.name + "@" + packageInfo.version
        if (seenPackages.has(packageNameAndVersion)) return
        seenPackages.add(packageNameAndVersion)
        if (
          !(packageInfo.name === "effect" || packageInfo.hasEffectInPeerDependencies)
        ) return
        if (options.allowedDuplicatedPackages.indexOf(packageInfo.name) > -1) return
        resolvedPackages[packageInfo.name] = resolvedPackages[packageInfo.name] || {}
        resolvedPackages[packageInfo.name][packageInfo.version] = packageInfo.packageDirectory
      })
      checkedPackagesCache.set(sourceFile.fileName, resolvedPackages)
      programResolvedCacheSize.set(sourceFile.fileName, newResolvedModuleSize)
    }

    for (const packageName of Object.keys(resolvedPackages)) {
      if (Object.keys(resolvedPackages[packageName]).length > 1) {
        const versions = Object.keys(resolvedPackages[packageName])
        report({
          node: sourceFile.statements[0],
          messageText: `Package ${packageName} is referenced multiple times with different versions (${
            versions.join(", ")
          }) and may cause unexpected type errors.\nCleanup your dependencies and your package lockfile to avoid multiple instances of this package and reload the project.\nIf this is intended set the LSP config "allowedDuplicatedPackages" to ${
            JSON.stringify(options.allowedDuplicatedPackages.concat([packageName]))
          }.\n\n${
            versions.map((version) => `- found ${version} at ${resolvedPackages[packageName][version]}`).join("\n")
          }`,
          fixes: []
        })
      }
    }
  })
})
