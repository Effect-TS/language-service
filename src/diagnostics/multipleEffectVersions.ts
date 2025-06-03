import { hasProperty, isNumber, isObject, isString } from "effect/Predicate"
import * as LanguageServicePluginOptions from "../core/LanguageServicePluginOptions.js"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

type ResolvedPackagesCache = Record<string, Record<string, any>>

const checkedPackagesCache = new Map<string, ResolvedPackagesCache>()
const programResolvedCacheSize = new Map<string, number>()

export const multipleEffectVersions = LSP.createDiagnostic({
  name: "multipleEffectVersions",
  code: 6,
  apply: Nano.fn("multipleEffectVersions.apply")(function*(sourceFile) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const program = yield* Nano.service(TypeScriptApi.TypeScriptProgram)
    const options = yield* Nano.service(LanguageServicePluginOptions.LanguageServicePluginOptions)
    const effectDiagnostics: Array<LSP.ApplicableDiagnosticDefinition> = []

    if (!options.multipleEffectCheck) return []
    if (sourceFile.statements.length < 1) return []

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
        if (!hasProperty(_, "packageJsonScope")) return
        if (!_.packageJsonScope) return
        const packageJsonScope = _.packageJsonScope
        if (!hasProperty(packageJsonScope, "contents")) return
        if (!hasProperty(packageJsonScope.contents, "packageJsonContent")) return
        const packageJsonContent = packageJsonScope.contents.packageJsonContent
        if (!hasProperty(packageJsonContent, "name")) return
        if (!hasProperty(packageJsonContent, "version")) return
        const { name, version } = packageJsonContent
        if (!isString(name)) return
        if (!isString(version)) return
        if (seenPackages.has(name + "@" + version)) return
        seenPackages.add(name + "@" + version)
        const hasEffectInPeerDependencies = hasProperty(packageJsonContent, "peerDependencies") &&
          isObject(packageJsonContent.peerDependencies) &&
          hasProperty(packageJsonContent.peerDependencies, "effect")
        if (
          !(name === "effect" || hasEffectInPeerDependencies)
        ) return
        resolvedPackages[name] = resolvedPackages[name] || {}
        resolvedPackages[name][version] = packageJsonScope.contents.packageJsonContent
      })
      checkedPackagesCache.set(sourceFile.fileName, resolvedPackages)
      programResolvedCacheSize.set(sourceFile.fileName, newResolvedModuleSize)
    }

    for (const packageName of Object.keys(resolvedPackages)) {
      if (Object.keys(resolvedPackages[packageName]).length > 1) {
        const versions = Object.keys(resolvedPackages[packageName])
        effectDiagnostics.push({
          node: sourceFile.statements[0],
          category: ts.DiagnosticCategory.Warning,
          messageText: `Package ${packageName} is referenced multiple times with different versions (${
            versions.join(", ")
          }).\nThis may cause unexpected type errors or runtime behaviours.\n\nCleanup your dependencies and your package lockfile to avoid multiple instances of this package and reload the project, or set the LSP config "multipleEffectCheck" to false.`,
          fixes: []
        })
      }
    }

    return effectDiagnostics
  })
})
