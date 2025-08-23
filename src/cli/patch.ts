import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as ts from "typescript"
import {
  applyTextChanges,
  getEffectLspPatchUtils,
  getModuleFilePath,
  getPackageJsonData,
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

const getPatchesForModule = Effect.fn("getPatchesForModule")(
  function*(moduleName: "tsc" | "typescript", dirPath: string, version: string, sourceFile: ts.SourceFile) {
    const patches: Array<ts.TextChange> = []
    let insertUtilsPosition = -1
    let insertCheckSourceFilePosition = -1
    let insertSkipPrecedingCommentDirectivePosition = -1

    // nodes where to start finding (optimization to avoid the entire file)
    const nodesToCheck: Array<ts.Node> = []
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
    if (!pushFunctionDeclarationNode("checkSourceFileWorker")) nodesToCheck.push(sourceFile)
    if (!pushFunctionDeclarationNode("markPrecedingCommentDirectiveLine")) nodesToCheck.push(sourceFile)

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
            insertCheckSourceFilePosition = block.statements[block.statements.length - 1].end
          }
        }
      } else if (ts.isFunctionDeclaration(node)) {
        if (
          node.name && ts.isIdentifier(node.name) && ts.idText(node.name) === "markPrecedingCommentDirectiveLine" &&
          node.body && node.body.statements.length > 0
        ) {
          insertSkipPrecedingCommentDirectivePosition = node.body.statements[0].pos
        }
      }

      ts.forEachChild(node, (child) => {
        nodesToCheck.push(child)
        return undefined
      })
    }

    // insert the utils
    insertUtilsPosition = 0
    if (insertUtilsPosition === -1) {
      return yield* Effect.fail(new UnableToFindPositionToPatchError({ positionToFind: "effect lsp utils insertion" }))
    }
    if (moduleName !== "typescript") {
      patches.push(
        yield* makeEffectLspPatchChange(
          sourceFile.text,
          insertUtilsPosition,
          insertUtilsPosition,
          "\n" + (yield* getTypeScriptApisUtils(dirPath)) + "\n",
          "",
          version
        )
      )
    }
    patches.push(
      yield* makeEffectLspPatchChange(
        sourceFile.text,
        insertUtilsPosition,
        insertUtilsPosition,
        "\n" + (yield* getEffectLspPatchUtils()) + "\n",
        "",
        version
      )
    )

    // insert the checkSourceFile call
    if (insertCheckSourceFilePosition === -1) {
      return yield* Effect.fail(new UnableToFindPositionToPatchError({ positionToFind: "checkSourceFileWorker" }))
    }
    patches.push(
      yield* makeEffectLspPatchChange(
        sourceFile.text,
        insertCheckSourceFilePosition,
        insertCheckSourceFilePosition,
        `effectLspPatchUtils.exports.checkSourceFileWorker(${
          moduleName === "typescript" ? "module.exports" : "effectLspTypeScriptApis"
        }, host, node, compilerOptions, diagnostics.add)\n`,
        "\n",
        version
      )
    )

    // insert the skip preceding comment directive
    if (insertSkipPrecedingCommentDirectivePosition === -1) {
      return yield* Effect.fail(
        new UnableToFindPositionToPatchError({ positionToFind: "skip preceding comment directive" })
      )
    }
    patches.push(
      yield* makeEffectLspPatchChange(
        sourceFile.text,
        insertSkipPrecedingCommentDirectivePosition,
        insertSkipPrecedingCommentDirectivePosition,
        "if(diagnostic && diagnostic.source === \"effect\"){ return -1; }\n",
        "\n",
        version
      )
    )
    return patches
  }
)

export const patch = Command.make(
  "patch",
  { dirPath, moduleNames },
  Effect.fn("patch")(function*({ dirPath, moduleNames }) {
    const fs = yield* FileSystem.FileSystem

    // search for typescript
    yield* Effect.logDebug(`Searching for typescript in ${dirPath}...`)
    const { version } = yield* getPackageJsonData(dirPath)
    yield* Effect.logDebug(`Found typescript version ${version}!`)

    const modulesToPatch = moduleNames.length === 0 ? ["tsc"] as const : moduleNames
    for (const moduleName of modulesToPatch) {
      // get the unpatched source file
      yield* Effect.logDebug(`Searching ${moduleName}...`)
      const filePath = yield* getModuleFilePath(dirPath, moduleName)

      yield* Effect.logDebug(`Reading ${moduleName} from ${filePath}...`)
      const sourceFile = yield* getUnpatchedSourceFile(filePath)

      // construct the patches to apply
      yield* Effect.logDebug(`Collecting patches for ${moduleName}...`)
      const patches = yield* getPatchesForModule(moduleName, dirPath, version, sourceFile)

      // then apply the patches
      const newSourceText = yield* applyTextChanges(sourceFile.text, patches)
      yield* fs.writeFileString(filePath, newSourceText)
      yield* Effect.logInfo(`${filePath} patched successfully.`)
    }
  })
)
