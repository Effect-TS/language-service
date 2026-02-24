import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Encoding from "effect/Encoding"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import * as Predicate from "effect/Predicate"
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import * as ServiceMap from "effect/ServiceMap"
import type * as ts from "typescript"
import * as TypeScriptUtils from "../core/TypeScriptUtils"

const PackageJsonSchema = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
  scripts: Schema.optional(Schema.Record(Schema.String, Schema.String))
})

export class UnableToFindPackageJsonError extends Data.TaggedError("UnableToFindPackageError")<{
  packageJsonPath: string
  cause: unknown
}> {
  get message(): string {
    return `Unable to find and read typescript package.json at ${this.packageJsonPath}`
  }
}

export class MalformedPackageJsonError extends Data.TaggedError("MalformedPackageJsonError")<{
  packageJsonPath: string
  cause: unknown
}> {
  get message(): string {
    return `Malformed typescript package.json at ${this.packageJsonPath}`
  }
}

export class CorruptedPatchedSourceFileError extends Data.TaggedError("CorruptedPatchedSourceFileError")<{
  filePath: string
  cause: unknown
}> {
  get message(): string {
    return `Patched source file ${this.filePath} has corrupted patches`
  }
}

export class UnableToFindInstalledTypeScriptPackage extends Data.TaggedError("UnableToFindInstalledTypeScriptPackage")<{
  cause: unknown
}> {
  get message(): string {
    return `Unable to find an installed typescript package`
  }
}

export type TypeScriptApi = typeof ts

/**
 * File input structure used across CLI commands
 */
export interface FileInput {
  readonly fileName: string // full absolute path to the file
  readonly text: string // file contents
}

/**
 * TypeScript API context for CLI operations
 */
export class TypeScriptContext extends ServiceMap.Service<TypeScriptContext, TypeScriptApi>()("TypeScriptContext") {
  static live = (cwd: string) =>
    Layer.effect(
      TypeScriptContext,
      Effect.try({
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        try: () => require(require.resolve("typescript", { paths: [cwd] })) as typeof ts,
        catch: (cause) => new UnableToFindInstalledTypeScriptPackage({ cause })
      }).pipe(
        Effect.catch(() =>
          Effect.try({
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            try: () => require("typescript") as typeof ts,
            catch: (cause) => new UnableToFindInstalledTypeScriptPackage({ cause })
          })
        )
      )
    )
}

export const getPackageJsonData = Effect.fn("getPackageJsonData")(function*(packageDir: string) {
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem
  const packageJsonPath = path.resolve(packageDir, "package.json")
  const packageJsonContent = yield* fs.readFileString(packageJsonPath).pipe(
    Effect.mapError((cause) => new UnableToFindPackageJsonError({ packageJsonPath, cause }))
  )
  const packageJsonData = yield* Schema.decodeEffect(Schema.fromJsonString(PackageJsonSchema))(packageJsonContent).pipe(
    Effect.mapError((cause) => new MalformedPackageJsonError({ packageJsonPath, cause }))
  )
  return { ...packageJsonData }
})

export const getModuleFilePath = Effect.fn("getModuleFilePath")(
  function*(dirPath: string, moduleName: "tsc" | "typescript") {
    const path = yield* Path.Path
    const filePath = path.resolve(dirPath, "lib", moduleName === "tsc" ? "_tsc.js" : "typescript.js")
    return filePath
  }
)

export const getTypeScriptApisUtils = Effect.fn("getTypeScriptApisFile")(
  function*(dirPath: string) {
    const filePath = yield* getModuleFilePath(dirPath, "typescript")
    const sourceText = yield* getSourceFileText(filePath)
    const sourceFile = yield* getUnpatchedSourceFile(filePath, sourceText)
    const bodyWithoutBundlerComment = yield* omitBundlerSourceFileComment(
      sourceFile.text.split("\n").map((line) => `    ${line}`).join("\n")
    )
    const patchWithWrappingFunction = `
var _effectLspTypeScriptApis = undefined;
function effectLspTypeScriptApis(){
  if(!_effectLspTypeScriptApis){
    _effectLspTypeScriptApis = (function(module){\n${bodyWithoutBundlerComment}\nreturn ts\n})(effectLspTypeScriptApis);
  }
  return _effectLspTypeScriptApis;
}`
    return patchWithWrappingFunction
  }
)

export const getEffectLspPatchUtils = Effect.fn("getEffectLspPatchUtils")(function*() {
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem
  const effectLspPatchUtilsPath = path.resolve(__dirname, "effect-lsp-patch-utils.js")
  const effectLspPatchUtilsContent = yield* fs.readFileString(effectLspPatchUtilsPath)
  const bodyWithoutBundlerComment = yield* omitBundlerSourceFileComment(
    effectLspPatchUtilsContent.split("\n").map((line) => `    ${line}`).join("\n")
  )
  const patchWithWrappingFunction = `
var _effectLspPatchUtils = undefined;
function effectLspPatchUtils(){
  if(!_effectLspPatchUtils){
    _effectLspPatchUtils = (function(module){\n${bodyWithoutBundlerComment}\nreturn module\n})({});
  }
  return _effectLspPatchUtils.exports;
}`
  return patchWithWrappingFunction
})

const AppliedPatchMetadataStruct = Schema.Struct({
  version: Schema.String,
  replacedText: Schema.String,
  insertedPrefixLength: Schema.Int,
  insertedTextLength: Schema.Int
})

export type AppliedPatchMetadata = typeof AppliedPatchMetadataStruct.Type

/** Decode a base64-encoded JSON string into AppliedPatchMetadata */
const decodeAppliedPatchMetadata = (base64str: string): Effect.Effect<AppliedPatchMetadata, unknown> => {
  const decoded = Encoding.decodeBase64(base64str)
  if (Result.isFailure(decoded)) {
    return Effect.fail(decoded.failure)
  }
  const jsonStr = new TextDecoder().decode(decoded.success)
  return Schema.decodeEffect(Schema.fromJsonString(AppliedPatchMetadataStruct))(jsonStr)
}

/** Encode AppliedPatchMetadata into a base64-encoded JSON string */
const encodeAppliedPatchMetadata = (metadata: AppliedPatchMetadata): Effect.Effect<string, Schema.SchemaError> =>
  Schema.encodeEffect(Schema.fromJsonString(AppliedPatchMetadataStruct))(metadata).pipe(
    Effect.map((jsonStr) => Encoding.encodeBase64(jsonStr))
  )

export const makeEffectLspPatchChange = Effect.fn("makeEffectLspPatchChange")(
  function*(
    sourceText: string,
    pos: number,
    end: number,
    insertedText: string,
    insertedPrefix: string,
    version: string
  ) {
    const replacedText = sourceText.slice(pos, end)
    const metadata: AppliedPatchMetadata = {
      version,
      replacedText,
      insertedPrefixLength: insertedPrefix.length,
      insertedTextLength: insertedText.length
    }
    const encodedMetadata = yield* encodeAppliedPatchMetadata(metadata)
    const textChange: ts.TextChange = {
      span: { start: pos, length: end - pos },
      newText: insertedPrefix + "/* @effect-lsp-patch " + encodedMetadata + " */ " + insertedText
    }
    return textChange
  }
)

export const extractAppliedEffectLspPatches = Effect.fn("extractAppliedEffectLspPatches")(
  function*(sourceFile: ts.SourceFile) {
    const ts = yield* TypeScriptContext
    const tsUtils = TypeScriptUtils.makeTypeScriptUtils(ts)

    const regex = /@effect-lsp-patch(?:\s+)([a-zA-Z0-9+=/]+)/gm
    let match: RegExpExecArray | null
    const patches: Array<AppliedPatchMetadata> = []
    const revertChanges: Array<ts.TextChange> = []
    while ((match = regex.exec(sourceFile.text)) !== null) {
      const commentTextMetadata = match[1]
      const commentRange = tsUtils.getCommentAtPosition(sourceFile, match.index)
      if (!commentRange) continue
      const metadata = yield* decodeAppliedPatchMetadata(commentTextMetadata).pipe(
        Effect.mapError((cause) => new CorruptedPatchedSourceFileError({ filePath: sourceFile.fileName, cause }))
      )
      patches.push(metadata)
      revertChanges.push({
        span: {
          start: commentRange.pos - metadata.insertedPrefixLength,
          length: metadata.insertedPrefixLength + metadata.insertedTextLength + 1 + commentRange.end - commentRange.pos
        },
        newText: metadata.replacedText
      })
    }
    return { patches, revertChanges }
  }
)

export const applyTextChanges = Effect.fn("applyTextChanges")(
  function*(sourceText: string, patches: Array<ts.TextChange>) {
    // create a copy of the patches as they will be re-sorted and shifted
    const changes: Array<ts.TextChange> = patches.map((patch) => ({
      newText: patch.newText,
      span: { start: patch.span.start, length: patch.span.length }
    }))
    changes.sort((a, b) => a.span.start - b.span.start)
    let newSourceText = sourceText

    for (let i = 0; i < changes.length; i++) {
      const change = changes[i]!
      // replace the text
      newSourceText = newSourceText.slice(0, change.span.start) + change.newText +
        newSourceText.slice(change.span.start + change.span.length)

      // adjust the text delta for the next changes
      const changeDelta = change.newText.length - change.span.length
      for (let j = i + 1; j < changes.length; j++) {
        if (changes[j]!.span.start >= change.span.start) {
          changes[j]!.span.start += changeDelta
        }
      }
    }

    return newSourceText
  }
)

export const getSourceFileText = Effect.fn("getSourceFileText")(function*(filePath: string) {
  const fs = yield* FileSystem.FileSystem
  return yield* fs.readFileString(filePath)
})

export const getUnpatchedSourceFile = Effect.fn("getUnpatchedSourceFile")(
  function*(filePath: string, sourceText: string) {
    const ts = yield* TypeScriptContext

    const sourceFile = ts.createSourceFile(
      filePath,
      sourceText,
      ts.ScriptTarget.ES2022,
      true
    )
    const { revertChanges } = yield* extractAppliedEffectLspPatches(sourceFile)
    // if there are no revert changes, return the original source file
    if (revertChanges.length === 0) return sourceFile
    // create a new source file with the reverted changes
    const newSourceText = yield* applyTextChanges(sourceText, revertChanges)
    const newSourceFile = ts.createSourceFile(
      filePath,
      newSourceText,
      ts.ScriptTarget.ES2022,
      true
    )
    return newSourceFile
  }
)

export const omitBundlerSourceFileComment = Effect.fn("omitBundlerSourceFileComment")(
  function*(originalSourceText: string) {
    const ts = yield* TypeScriptContext

    const deleteChanges: Array<ts.TextChange> = []
    const sourceFile = ts.createSourceFile(
      "file.ts",
      originalSourceText,
      ts.ScriptTarget.ES2022,
      true
    )
    const lineStarts = sourceFile.getLineStarts()
    const regex = /^\s*\/\/\s*src\//gmid
    for (let i = 0; i < lineStarts.length; i++) {
      const pos = lineStarts[i]
      const end = i >= lineStarts.length ? sourceFile.text.length : lineStarts[i + 1]
      if (sourceFile.text.substring(pos, end).match(regex)) {
        deleteChanges.push({
          span: { start: pos, length: end - 1 - pos },
          newText: ""
        })
      }
    }
    return yield* applyTextChanges(sourceFile.text, deleteChanges)
  }
)

export const extractEffectLspOptions = (compilerOptions: ts.CompilerOptions) => {
  return (Predicate.hasProperty(compilerOptions, "plugins") && Array.isArray(compilerOptions.plugins)
    ? compilerOptions.plugins
    : []).find((_) => Predicate.hasProperty(_, "name") && _.name === "@effect/language-service")
}

export const getFileNamesInTsConfig = Effect.fn("getFileNamesInTsConfig")(function*(tsconfigPath: string) {
  const path = yield* Path.Path
  const tsInstance = yield* TypeScriptContext
  const filesToCheck = new Set<string>()
  let tsconfigToHandle = [tsconfigPath]
  while (tsconfigToHandle.length > 0) {
    const tsconfigPath = tsconfigToHandle.shift()!
    const tsconfigAbsolutePath = path.resolve(tsconfigPath)
    const configFile = tsInstance.readConfigFile(tsconfigAbsolutePath, tsInstance.sys.readFile)
    if (configFile.error) {
      if (!tsconfigAbsolutePath.endsWith("tsconfig.json")) {
        tsconfigToHandle = [...tsconfigToHandle, path.resolve(tsconfigPath, "tsconfig.json")]
      }
      continue
    }
    const parsedConfig = tsInstance.parseJsonConfigFileContent(
      configFile.config,
      tsInstance.sys,
      path.dirname(tsconfigAbsolutePath)
    )
    tsconfigToHandle = [...tsconfigToHandle, ...parsedConfig.projectReferences?.map((_) => _.path) ?? []]
    parsedConfig.fileNames.forEach((_) => filesToCheck.add(_))
  }
  return filesToCheck
})
