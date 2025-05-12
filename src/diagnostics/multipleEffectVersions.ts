import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

type ResolvedEffectVersions = Record<string, { resolvedFileName: string }>

const effectVersionsCache = new Map<string, ResolvedEffectVersions>()
const programResolvedCacheSize = new Map<string, number>()

export const multipleEffectVersions = LSP.createDiagnostic({
  name: "effect/multipleEffectVersions",
  code: 6,
  apply: Nano.fn("multipleEffectVersions.apply")(function*(sourceFile) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const program = yield* Nano.service(TypeScriptApi.TypeScriptProgram)
    const options = yield* Nano.service(LSP.PluginOptions)
    const effectDiagnostics: Array<LSP.ApplicableDiagnosticDefinition> = []

    if (!options.multipleEffectCheck) return []
    if (sourceFile.statements.length < 1) return []

    // whenever we detect the resolution cache size has changed, try again the check
    // this should mitigate how frequently this rule is triggered
    const effectVersions: ResolvedEffectVersions = effectVersionsCache.get(sourceFile.fileName) ||
      {}
    const newResolvedModuleSize =
      "resolvedModules" in program && typeof program.resolvedModules === "object" &&
        "size" in (program as any).resolvedModules ?
        (program.resolvedModules as any).size :
        0
    const oldResolvedSize = programResolvedCacheSize.get(sourceFile.fileName) || 0
    if (newResolvedModuleSize !== oldResolvedSize) {
      if (
        "forEachResolvedModule" in program && typeof program.forEachResolvedModule === "function"
      ) {
        program.forEachResolvedModule((_: any) => {
          if (
            _ &&
            _.resolvedModule && _.resolvedModule.packageId &&
            _.resolvedModule.packageId.name === "effect" &&
            !(_.resolvedModule.packageId.version in effectVersions)
          ) {
            effectVersions[_.resolvedModule.packageId.version] = {
              resolvedFileName: _.resolvedModule.resolvedFileName
            }
          }
        })
      }
      effectVersionsCache.set(sourceFile.fileName, effectVersions)
      programResolvedCacheSize.set(sourceFile.fileName, newResolvedModuleSize)
    }

    if (Object.keys(effectVersions).length > 1) {
      const versions = Object.keys(effectVersions).map((version) => `version ${version}`)
      effectDiagnostics.push({
        node: sourceFile.statements[0],
        category: ts.DiagnosticCategory.Warning,
        messageText: `Seems like in this project there are multiple effect versions loaded (${
          versions.join(", ")
        }). This may cause unexpected type errors and runtime behaviours. If you are ok with that, you can disable this warning by adding "multipleEffectCheck": false to the Effect LSP options inside your tsconfig.json`,
        fixes: []
      })
    }

    return effectDiagnostics
  })
})
