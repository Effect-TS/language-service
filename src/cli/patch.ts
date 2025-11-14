import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import type * as ts from "typescript"
import {
  applyTextChanges,
  getEffectLspPatchUtils,
  getModuleFilePath,
  getPackageJsonData,
  getSourceFileText,
  getTypeScript,
  getTypeScriptApisUtils,
  getUnpatchedSourceFile,
  makeEffectLspPatchChange
} from "./utils"

export class UnableToFindPositionToPatchError extends Data.TaggedError("UnableToFindPositionToPatchError")<{
  positionToFind: string
}> {
  get message(): string {
    return `Unable to find position to patch ${this.positionToFind}`
  }
}

const LOCAL_TYPESCRIPT_DIR = "./node_modules/typescript"

const dirPath = Options.directory("dir").pipe(
  Options.withDefault(LOCAL_TYPESCRIPT_DIR),
  Options.withDescription("The directory of the typescript package to patch.")
)

const moduleNames = Options.choice("module", [
  "tsc",
  "typescript"
]).pipe(
  Options.repeated,
  Options.withDescription("The name of the module to patch.")
)

const force = Options.boolean("force").pipe(
  Options.withDefault(false),
  Options.withDescription("Force patch even if already patched.")
)

const getPatchedMarker = (version: string) => {
  return `"use effect-lsp-patch-version ${version}";`
}

const getPatchesForModule = Effect.fn("getPatchesForModule")(
  function*(moduleName: "tsc" | "typescript", dirPath: string, version: string, sourceFile: ts.SourceFile) {
    const ts = yield* getTypeScript

    const patches: Array<ts.TextChange> = []
    let insertClearSourceFileEffectMetadataPosition: Option.Option<{ position: number }> = Option.none()
    let insertCheckSourceFilePosition: Option.Option<{ position: number }> = Option.none()
    let insertSkipPrecedingCommentDirectivePosition: Option.Option<{ position: number }> = Option.none()
    let insertAppendMetadataRelationErrorPosition: Option.Option<
      { position: number; sourceIdentifier: string; targetIdentifier: string }
    > = Option.none()

    // nodes where to start finding (optimization to avoid the entire file)
    let nodesToCheck: Array<ts.Node> = []
    function findNodeAtPositionIncludingTrivia(
      sourceFile: ts.SourceFile,
      position: number
    ) {
      function find(node: ts.Node): ts.Node | undefined {
        if (position >= node.pos && position < node.end) {
          // If the position is within this node, keep traversing its children
          return ts.forEachChild(node, find) || node
        }
        return undefined
      }

      return find(sourceFile)
    }

    function pushFunctionDeclarationNode(text: string) {
      const regex = new RegExp(text, "ig")
      let pushed = false

      let match
      while ((match = regex.exec(sourceFile.text)) !== null) {
        const node = findNodeAtPositionIncludingTrivia(sourceFile, match.index)
        if (node) {
          const functionDeclaration = ts.findAncestor(node, ts.isFunctionDeclaration)
          nodesToCheck.push(functionDeclaration || node)
          pushed = true
        }
      }
      return pushed
    }

    // the two positions we care about
    let requiresFullScan = false
    if (!pushFunctionDeclarationNode("checkSourceFileWorker")) requiresFullScan = true
    if (!pushFunctionDeclarationNode("markPrecedingCommentDirectiveLine")) requiresFullScan = true
    if (!pushFunctionDeclarationNode("reportRelationError")) requiresFullScan = true
    if (requiresFullScan) nodesToCheck = [sourceFile]

    // then find the checkSourceFile function, and insert the call to checking the effect lsp diagnostics
    while (nodesToCheck.length > 0) {
      const node = nodesToCheck.shift()
      if (!node) continue

      if (ts.isExpressionStatement(node)) {
        const expression = node.expression
        if (ts.isCallExpression(expression)) {
          const identifier = expression.expression
          if (
            ts.isIdentifier(identifier) && ts.idText(identifier) === "checkGrammarSourceFile" &&
            ts.isBlock(node.parent) && node.parent.statements.length > 0
          ) {
            const block = node.parent
            const parentFunctionDeclaration = ts.findAncestor(node, ts.isFunctionDeclaration)
            if (
              parentFunctionDeclaration && parentFunctionDeclaration.name &&
              ts.isIdentifier(parentFunctionDeclaration.name) &&
              ts.idText(parentFunctionDeclaration.name) === "checkSourceFileWorker"
            ) {
              // should be inside the function declaration
              insertClearSourceFileEffectMetadataPosition = Option.some({ position: node.pos })
              insertCheckSourceFilePosition = Option.some({
                position: block.statements[block.statements.length - 1].end
              })
            }
          }
        }
      } else if (ts.isFunctionDeclaration(node)) {
        if (
          node.name && ts.isIdentifier(node.name) && ts.idText(node.name) === "markPrecedingCommentDirectiveLine" &&
          node.body && node.body.statements.length > 0
        ) {
          insertSkipPrecedingCommentDirectivePosition = Option.some({ position: node.body.statements[0].pos })
        }

        if (
          node.name && ts.isIdentifier(node.name) && ts.idText(node.name) === "reportRelationError" &&
          node.body && node.body.statements.length > 0 && node.parameters.length >= 3
        ) {
          const sourceIdentifier =
            node.parameters[1] && ts.isParameter(node.parameters[1]) && ts.isIdentifier(node.parameters[1].name)
              ? ts.idText(node.parameters[1].name)
              : undefined
          const targetIdentifier =
            node.parameters[2] && ts.isParameter(node.parameters[2]) && ts.isIdentifier(node.parameters[2].name)
              ? ts.idText(node.parameters[2].name)
              : undefined
          if (sourceIdentifier && targetIdentifier) {
            insertAppendMetadataRelationErrorPosition = Option.some({
              position: node.body.statements[0].pos,
              sourceIdentifier,
              targetIdentifier
            })
          }
        }
      }

      ts.forEachChild(node, (child) => {
        nodesToCheck.push(child)
        return undefined
      })
    }

    // insert the clearSourceFileMetadata call
    if (Option.isNone(insertClearSourceFileEffectMetadataPosition)) {
      return yield* Effect.fail(
        new UnableToFindPositionToPatchError({ positionToFind: "clearSourceFileEffectMetadata" })
      )
    }
    patches.push(
      yield* makeEffectLspPatchChange(
        sourceFile.text,
        insertClearSourceFileEffectMetadataPosition.value.position,
        insertClearSourceFileEffectMetadataPosition.value.position,
        `effectLspPatchUtils().clearSourceFileEffectMetadata(node)\n`,
        "\n",
        version
      )
    )

    // insert the checkSourceFile call
    if (Option.isNone(insertCheckSourceFilePosition)) {
      return yield* Effect.fail(new UnableToFindPositionToPatchError({ positionToFind: "checkSourceFileWorker" }))
    }
    patches.push(
      yield* makeEffectLspPatchChange(
        sourceFile.text,
        insertCheckSourceFilePosition.value.position,
        insertCheckSourceFilePosition.value.position,
        `effectLspPatchUtils().checkSourceFileWorker(${
          moduleName === "typescript" ? "module.exports" : "effectLspTypeScriptApis()"
        }, host, node, compilerOptions, diagnostics.add, "${moduleName}")\n`,
        "\n",
        version
      )
    )

    // insert the appendMetadataRelationError call
    if (Option.isNone(insertAppendMetadataRelationErrorPosition)) {
      return yield* Effect.fail(
        new UnableToFindPositionToPatchError({ positionToFind: "appendMetadataRelationError" })
      )
    }
    const { sourceIdentifier, targetIdentifier } = insertAppendMetadataRelationErrorPosition.value
    patches.push(
      yield* makeEffectLspPatchChange(
        sourceFile.text,
        insertAppendMetadataRelationErrorPosition.value.position,
        insertAppendMetadataRelationErrorPosition.value.position,
        `effectLspPatchUtils().appendMetadataRelationError(${
          moduleName === "typescript" ? "module.exports" : "effectLspTypeScriptApis()"
        }, errorNode, ${sourceIdentifier}, ${targetIdentifier})\n`,
        "\n",
        version
      )
    )

    // insert the skip preceding comment directive
    if (Option.isNone(insertSkipPrecedingCommentDirectivePosition)) {
      return yield* Effect.fail(
        new UnableToFindPositionToPatchError({ positionToFind: "skip preceding comment directive" })
      )
    }
    patches.push(
      yield* makeEffectLspPatchChange(
        sourceFile.text,
        insertSkipPrecedingCommentDirectivePosition.value.position,
        insertSkipPrecedingCommentDirectivePosition.value.position,
        "if(diagnostic && diagnostic.source === \"effect\"){ return -1; }\n",
        "\n",
        version
      )
    )

    // NOTE: we add fake file markers so that ts-patch is fine with it's concept of
    // "source" sectors
    let eofPos = sourceFile.text.lastIndexOf("// src/") - 1
    if (eofPos < 0) eofPos = sourceFile.text.length
    if (moduleName !== "typescript") {
      patches.push(
        yield* makeEffectLspPatchChange(
          sourceFile.text,
          eofPos,
          eofPos,
          yield* getTypeScriptApisUtils(dirPath),
          "\n\n// src/@effect/language-service/effect-lsp-patch-utils.ts\n",
          version
        )
      )
    }
    patches.push(
      yield* makeEffectLspPatchChange(
        sourceFile.text,
        eofPos,
        eofPos,
        yield* getEffectLspPatchUtils(),
        "\n\n// src/@effect/language-service/embedded-typescript-copy.ts\n",
        version
      )
    )

    // append a comment with the current version of the effect language service patch applied
    patches.push(
      yield* makeEffectLspPatchChange(
        sourceFile.text,
        insertCheckSourceFilePosition.value.position,
        insertCheckSourceFilePosition.value.position,
        getPatchedMarker(version) + "\n",
        "\n",
        version
      )
    )

    return patches
  }
)

export const printRememberDeleteTsbuildinfo = Effect.fn("printRememberDeleteTsbuildinfo")(function*() {
  yield* Effect.logInfo(
    `If your project uses incremental builds, delete the .tsbuildinfo files and perform a full build.`
  )
})

export const printRememberPrepareScript = Effect.fn("printRememberPrepareScript")(function*() {
  const packageJson = yield* getPackageJsonData(".")
  if (packageJson.scripts && "prepare" in packageJson.scripts) {
    const prepareScript = packageJson.scripts.prepare
    if (prepareScript.toLocaleLowerCase().includes("effect-language-service")) return
  }
  yield* Effect.logInfo(
    `No prepare script found in package.json; to make the patch persistent across package installations and updates, add the following to your package.json scripts:
  "scripts": {
          "prepare": "effect-language-service patch"
  }`
  )
}, Effect.ignore)

export const patch = Command.make(
  "patch",
  { dirPath, moduleNames, force },
  Effect.fn("patch")(function*({ dirPath, force, moduleNames }) {
    const fs = yield* FileSystem.FileSystem

    // read my data
    const { version: effectLspVersion } = yield* getPackageJsonData(__dirname)

    // search for typescript
    yield* Effect.logDebug(`Searching for typescript in ${dirPath}...`)
    const { version: typescriptVersion } = yield* getPackageJsonData(dirPath)
    yield* Effect.logDebug(`Found typescript version ${typescriptVersion}!`)

    const modulesToPatch = moduleNames.length === 0 ? ["typescript", "tsc"] as const : moduleNames
    for (const moduleName of modulesToPatch) {
      // get the unpatched source file
      yield* Effect.logDebug(`Searching ${moduleName}...`)
      const filePath = yield* getModuleFilePath(dirPath, moduleName)

      yield* Effect.logDebug(`Reading ${moduleName} from ${filePath}...`)
      const sourceText = yield* getSourceFileText(filePath)

      // skip if already patched
      yield* Effect.logDebug(
        `Checking if ${filePath} is already patched with marker ${getPatchedMarker(effectLspVersion)}...`
      )
      if (!force && sourceText.indexOf(getPatchedMarker(effectLspVersion)) !== -1) {
        yield* Effect.logInfo(`${filePath} is already patched with version ${effectLspVersion}, skipped.`)
        continue
      }

      // parse the source file
      yield* Effect.logDebug(`Parsing ${moduleName}...`)
      const sourceFile = yield* getUnpatchedSourceFile(filePath, sourceText)

      // construct the patches to apply
      yield* Effect.logDebug(`Collecting patches for ${moduleName}...`)
      const patches = yield* getPatchesForModule(moduleName, dirPath, effectLspVersion, sourceFile)

      // then apply the patches
      const newSourceText = yield* applyTextChanges(sourceFile.text, patches)
      yield* fs.writeFileString(filePath, newSourceText)
      yield* Effect.logInfo(`${filePath} patched successfully.`)
    }

    // remember
    yield* printRememberDeleteTsbuildinfo()
    yield* printRememberPrepareScript()
  })
)
