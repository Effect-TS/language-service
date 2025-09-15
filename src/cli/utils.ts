/* eslint-disable @typescript-eslint/no-restricted-imports */
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as ts from "typescript"
import * as TypeScriptUtils from "../core/TypeScriptUtils"

const tsUtils = TypeScriptUtils.makeTypeScriptUtils(ts)

const PackageJsonSchema = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
  scripts: Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.String
  }))
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

export const getPackageJsonData = Effect.fn("getPackageJsonData")(function*(packageDir: string) {
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem
  const packageJsonPath = path.resolve(packageDir, "package.json")
  const packageJsonContent = yield* fs.readFileString(packageJsonPath).pipe(
    Effect.mapError((cause) => new UnableToFindPackageJsonError({ packageJsonPath, cause }))
  )
  const packageJsonData = yield* Schema.decode(Schema.parseJson(PackageJsonSchema))(packageJsonContent).pipe(
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
    const sourceFile = yield* getUnpatchedSourceFile(filePath)
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

export const AppliedPatchMetadata = Schema.compose(
  Schema.StringFromBase64,
  Schema.parseJson(Schema.Struct({
    version: Schema.String,
    replacedText: Schema.String,
    insertedPrefixLength: Schema.Int,
    insertedTextLength: Schema.Int
  }))
)
export type AppliedPatchMetadata = Schema.Schema.Type<typeof AppliedPatchMetadata>

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
    const encodedMetadata = yield* Schema.encode(AppliedPatchMetadata)(metadata)
    const textChange: ts.TextChange = {
      span: { start: pos, length: end - pos },
      newText: insertedPrefix + "/* @effect-lsp-patch " + encodedMetadata + " */ " + insertedText
    }
    return textChange
  }
)

export const extractAppliedEffectLspPatches = Effect.fn("extractAppliedEffectLspPatches")(
  function*(sourceFile: ts.SourceFile) {
    const regex = /@effect-lsp-patch(?:\s+)([a-zA-Z0-9+=/]+)/gm
    let match: RegExpExecArray | null
    const patches: Array<AppliedPatchMetadata> = []
    const revertChanges: Array<ts.TextChange> = []
    while ((match = regex.exec(sourceFile.text)) !== null) {
      const commentTextMetadata = match[1]
      const commentRange = tsUtils.getCommentAtPosition(sourceFile, match.index)
      if (!commentRange) continue
      const metadata = yield* Schema.decode(AppliedPatchMetadata)(commentTextMetadata).pipe(
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

export const getUnpatchedSourceFile = Effect.fn("getUnpatchedSourceFile")(function*(filePath: string) {
  const fs = yield* FileSystem.FileSystem
  const sourceText = yield* fs.readFileString(filePath)
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
})

export const omitBundlerSourceFileComment = Effect.fn("omitBundlerSourceFileComment")(
  function*(originalSourceText: string) {
    return originalSourceText.split("\n").filter((line) => line.match(/^\s*\/\/\s*src\//gm) === null).join(
      "\n"
    )
  }
)
