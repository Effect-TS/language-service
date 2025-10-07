import type ts from "typescript"
import * as LanguageServicePluginOptions from "./LanguageServicePluginOptions.js"
import * as Nano from "./Nano.js"
import * as TypeScriptApi from "./TypeScriptApi.js"
import * as TypeScriptUtils from "./TypeScriptUtils.js"

export type KeyBuilderKind = "service" | "error"

export interface KeyBuilder {
  createString(identifier: string, kind: KeyBuilderKind): string | undefined
}

export const makeKeyBuilder = Nano.fn("KeyBuilder")(
  function*(sourceFile: ts.SourceFile) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const program = yield* Nano.service(TypeScriptApi.TypeScriptProgram)
    const options = yield* Nano.service(LanguageServicePluginOptions.LanguageServicePluginOptions)

    // Get package info for this source file, skip validation if not available
    const packageInfo = tsUtils.resolveModuleWithPackageInfoFromSourceFile(program, sourceFile)

    function createString(classNameText: string, kind: KeyBuilderKind): string | undefined {
      if (!packageInfo) return

      for (const keyPattern of options.keyPatterns) {
        // ensure this pattern applies for this kind
        if (keyPattern.target !== kind) continue

        // simple package identifier + name
        if (keyPattern.pattern === "package-identifier") {
          return packageInfo.name + "/" + classNameText
        }
        // gets the dirname of the source file
        const dirPath = TypeScriptApi.getDirectoryPath(ts, sourceFile.fileName)
        if (!dirPath.startsWith(packageInfo.packageDirectory)) return
        let subDirectory = dirPath.slice(packageInfo.packageDirectory.length)
        if (subDirectory.startsWith("/")) subDirectory = subDirectory.slice(1)
        const lastIndex = sourceFile.fileName.lastIndexOf("/")
        let subModule = lastIndex === -1 ? "" : sourceFile.fileName.slice(lastIndex + 1)
        for (const extension of [".ts", ".tsx", ".js", ".jsx"]) {
          if (subModule.toLowerCase().endsWith(extension)) {
            subModule = subModule.slice(0, -extension.length)
            break
          }
        }
        if (subModule.toLowerCase().endsWith("/index")) subModule = subModule.slice(0, -6)
        if (subModule.startsWith("/")) subModule = subModule.slice(1)

        // remove the configured prefixes
        for (const prefix of keyPattern.skipLeadingPath) {
          if (subDirectory.startsWith(prefix)) {
            subDirectory = subDirectory.slice(prefix.length)
            break
          }
        }

        // construct the parts of the expected identifier
        const parts = [packageInfo.name, subDirectory, subModule].concat(
          subModule.toLowerCase() === classNameText.toLowerCase() ? [] : [classNameText]
        )

        return parts.filter((_) => String(_).trim().length > 0).join("/")
      }
    }

    return {
      createString
    }
  }
)

const keyBuilderCache = new Map<string, KeyBuilder>()

export const getOrMakeKeyBuilder = Nano.fn("getOrMakeKeyBuilder")(function*(
  sourceFile: ts.SourceFile
) {
  const keyBuilder = keyBuilderCache.get(sourceFile.fileName) ||
    (yield* makeKeyBuilder(sourceFile))
  keyBuilderCache.set(sourceFile.fileName, keyBuilder)
  return keyBuilder
})

export function createString(sourceFile: ts.SourceFile, identifier: string, kind: KeyBuilderKind) {
  return Nano.map(
    getOrMakeKeyBuilder(sourceFile),
    (identifierBuilder) => identifierBuilder.createString(identifier, kind)
  )
}
