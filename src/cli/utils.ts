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
  version: Schema.String
})

export class UnableToFindTsPackageError extends Data.TaggedError("UnableToFindTsPackageError")<{
  packageJsonPath: string
  cause: unknown
}> {
  toString(): string {
    return `Unable to find and read typescript package.json at ${this.packageJsonPath}`
  }
}

export class MalformedPackageJsonError extends Data.TaggedError("MalformedPackageJsonError")<{
  packageJsonPath: string
  cause: unknown
}> {
  toString(): string {
    return `Malformed typescript package.json at ${this.packageJsonPath}`
  }
}

export const getTsPackageInfo = Effect.fn("getTsPackageInfo")(function*() {
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem
  const packageJsonPath = path.resolve("node_modules", "typescript", "package.json")
  const packageJsonContent = yield* fs.readFileString(packageJsonPath).pipe(
    Effect.mapError((cause) => new UnableToFindTsPackageError({ packageJsonPath, cause }))
  )
  const packageJsonData = yield* Schema.decode(Schema.parseJson(PackageJsonSchema))(packageJsonContent).pipe(
    Effect.mapError((cause) => new MalformedPackageJsonError({ packageJsonPath, cause }))
  )
  const dir = path.dirname(packageJsonPath)
  return { ...packageJsonData, dir }
})

export const getTypeScriptApisUtils = Effect.fn("getTypeScriptApisFile")(function*(dir) {
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem
  const filePath = path.resolve(dir, "lib", "typescript.js")
  const sourceText = yield* fs.readFileString(filePath)
  const patchWithWrappingFunction =
    `var effectLspTypeScriptApis = (function(module){\n${sourceText}\nreturn ts\n})(effectLspTypeScriptApis);`
  return patchWithWrappingFunction
})

export const getEffectLspPatchUtils = Effect.fn("getEffectLspPatchUtils")(function*() {
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem
  const effectLspPatchUtilsPath = path.resolve(__dirname, "effect-lsp-patch-utils.js")
  const effectLspPatchUtilsContent = yield* fs.readFileString(effectLspPatchUtilsPath)
  const patchWithWrappingFunction =
    `var effectLspPatchUtils = (function(module){\n${effectLspPatchUtilsContent}\nreturn module\n})(effectLspPatchUtils || {});`
  return patchWithWrappingFunction
})

export const getUnderscoreTscSourceFile = Effect.fn("getUnderscoreTscSourceFile")(function*(dir: string) {
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem
  const filePath = path.resolve(dir, "lib", "_tsc.js")
  const sourceText = yield* fs.readFileString(filePath)
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.ES2022,
    true
  )
  return { sourceFile, filePath, sourceText }
})

const AppliedPatchMetadata = Schema.compose(
  Schema.StringFromBase64,
  Schema.parseJson(Schema.Struct({
    version: Schema.Number,
    replacedText: Schema.String,
    insertedPrefixLength: Schema.Int,
    insertedTextLength: Schema.Int
  }))
)
export type AppliedPatchMetadata = Schema.Schema.Type<typeof AppliedPatchMetadata>

export const extractAppliedPatches = Effect.fn("extractAppliedPatches")(function*(sourceFile: ts.SourceFile) {
  const regex = /@effect-lsp-patch(?:\s+)([a-zA-Z0-9+=/]+)/gm
  let match: RegExpExecArray | null
  const patches: Array<AppliedPatchMetadata> = []
  const revertChanges: Array<ts.TextChange> = []
  while ((match = regex.exec(sourceFile.text)) !== null) {
    const commentTextMetadata = match[1]
    const commentRange = tsUtils.getCommentAtPosition(sourceFile, match.index)
    if (!commentRange) continue
    const metadata = yield* Schema.decode(AppliedPatchMetadata)(commentTextMetadata)
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
})

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

export const makeInsertPatch = Effect.fn("makeInsertPatch")(
  function*(sourceText: string, pos: number, end: number, insertedText: string, insertedPrefix: string) {
    const replacedText = sourceText.slice(pos, end)
    const metadata: AppliedPatchMetadata = {
      version: 1,
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
