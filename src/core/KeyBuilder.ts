import type ts from "typescript"
import * as LanguageServicePluginOptions from "./LanguageServicePluginOptions.js"
import * as Nano from "./Nano.js"
import * as TypeScriptApi from "./TypeScriptApi.js"
import * as TypeScriptUtils from "./TypeScriptUtils.js"

export interface KeyBuilder {
  createString(identifier: string, kind: LanguageServicePluginOptions.KeyBuilderKind): string | undefined
}

export const makeKeyBuilder = Nano.fn("KeyBuilder")(
  function*(sourceFile: ts.SourceFile) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const program = yield* Nano.service(TypeScriptApi.TypeScriptProgram)
    const options = yield* Nano.service(LanguageServicePluginOptions.LanguageServicePluginOptions)

    // Get package info for this source file, skip validation if not available
    const packageInfo = tsUtils.resolveModuleWithPackageInfoFromSourceFile(program, sourceFile)

    function createString(
      classNameText: string,
      kind: LanguageServicePluginOptions.KeyBuilderKind
    ): string | undefined {
      if (!packageInfo) return

      for (const keyPattern of options.keyPatterns) {
        // ensure this pattern applies for this kind
        if (keyPattern.target !== kind) continue

        // constructs the only filename of the source file
        const lastIndex = sourceFile.fileName.lastIndexOf("/")
        let onlyFileName = lastIndex === -1 ? "" : sourceFile.fileName.slice(lastIndex + 1)
        const lastExtensionIndex = onlyFileName.lastIndexOf(".")
        if (lastExtensionIndex !== -1) onlyFileName = onlyFileName.slice(0, lastExtensionIndex)
        if (onlyFileName.toLowerCase().endsWith("/index")) onlyFileName = onlyFileName.slice(0, -6)
        if (onlyFileName.startsWith("/")) onlyFileName = onlyFileName.slice(1)

        // constructs the subdirectory of the source file
        let subDirectory = TypeScriptApi.getDirectoryPath(ts, sourceFile.fileName)
        if (!subDirectory.startsWith(packageInfo.packageDirectory)) continue
        subDirectory = subDirectory.slice(packageInfo.packageDirectory.length)
        if (!subDirectory.endsWith("/")) subDirectory = subDirectory + "/"
        if (subDirectory.startsWith("/")) subDirectory = subDirectory.slice(1)
        for (const prefix of keyPattern.skipLeadingPath) {
          if (subDirectory.startsWith(prefix)) {
            subDirectory = subDirectory.slice(prefix.length)
            break
          }
        }

        // construct the parts of the expected identifier
        let parts = [packageInfo.name, subDirectory, onlyFileName].concat(
          onlyFileName.toLowerCase() === classNameText.toLowerCase() ? [] : [classNameText]
        )
        if (keyPattern.pattern === "package-identifier") {
          parts = [packageInfo.name, onlyFileName].concat(
            onlyFileName.toLowerCase() === classNameText.toLowerCase() ? [] : [classNameText]
          )
        }

        // remove leading/trailing slashes
        parts = parts.map((part) => part.startsWith("/") ? part.slice(1) : part).map((part) =>
          part.endsWith("/") ? part.slice(0, -1) : part
        )

        // return them joined
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
  // NOTE: evict the oldest entry when the cache is full to avoid unbounded memory growth
  while (keyBuilderCache.size > 5) {
    const oldest = keyBuilderCache.keys().next().value
    if (oldest) keyBuilderCache.delete(oldest)
  }
  const keyBuilder = keyBuilderCache.get(sourceFile.fileName) ||
    (yield* makeKeyBuilder(sourceFile))
  keyBuilderCache.set(sourceFile.fileName, keyBuilder)
  return keyBuilder
})

export function createString(
  sourceFile: ts.SourceFile,
  identifier: string,
  kind: LanguageServicePluginOptions.KeyBuilderKind
) {
  return Nano.map(
    getOrMakeKeyBuilder(sourceFile),
    (identifierBuilder) => identifierBuilder.createString(identifier, kind)
  )
}
