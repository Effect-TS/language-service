import * as Command from "@effect/cli/Command"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as ts from "typescript"
import {
  applyTextChanges,
  extractAppliedPatches,
  getEffectLspPatchUtils,
  getTsPackageInfo,
  getTypeScriptApisUtils,
  getUnderscoreTscSourceFile,
  makeInsertPatch
} from "./utils"

export class UnableToFindPositionToPatchError extends Data.TaggedError("UnableToFindPositionToPatchError")<{
  positionToFind: string
}> {
  toString(): string {
    return `Unable to find position to patch ${this.positionToFind}`
  }
}

export const patch = Command.make(
  "patch",
  {},
  Effect.fn("patch")(function*() {
    const fs = yield* FileSystem.FileSystem
    const patches: Array<ts.TextChange> = []
    const { dir } = yield* getTsPackageInfo()
    const { filePath, sourceFile, sourceText } = yield* getUnderscoreTscSourceFile(dir)
    const { revertChanges } = yield* extractAppliedPatches(sourceFile)
    if (revertChanges.length > 0) return yield* Effect.logInfo(`${filePath} appears to be already patched.`)

    let insertUtilsPosition = -1
    let insertCheckSourceFilePosition = -1

    // then find the checkSourceFile function, and insert the call to checking the effect lsp diagnostics
    const nodesToCheck: Array<ts.Node> = [sourceFile]
    while (nodesToCheck.length > 0) {
      const node = nodesToCheck.shift()!

      if (ts.isExpressionStatement(node)) {
        const expression = node.expression
        if (ts.isConditionalExpression(expression)) {
          const whenTrue = expression.whenTrue
          const whenFalse = expression.whenFalse
          if (ts.isCallExpression(whenTrue) && ts.isCallExpression(whenFalse)) {
            if (ts.isIdentifier(whenFalse.expression) && whenFalse.expression.text === "checkSourceFileWorker") {
              insertCheckSourceFilePosition = node.end
            }
          }
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
    patches.push(
      yield* makeInsertPatch(
        sourceText,
        insertUtilsPosition,
        insertUtilsPosition,
        "\n" + (yield* getTypeScriptApisUtils(dir)) + "\n",
        ""
      )
    )
    patches.push(
      yield* makeInsertPatch(
        sourceText,
        insertUtilsPosition,
        insertUtilsPosition,
        "\n" + (yield* getEffectLspPatchUtils()) + "\n",
        ""
      )
    )

    // insert the checkSourceFile call
    if (insertCheckSourceFilePosition === -1) {
      return yield* Effect.fail(new UnableToFindPositionToPatchError({ positionToFind: "checkSourceFile" }))
    }
    patches.push(
      yield* makeInsertPatch(
        sourceText,
        insertCheckSourceFilePosition,
        insertCheckSourceFilePosition,
        "effectLspPatchUtils.exports.checkSourceFile(effectLspTypeScriptApis, host, node, diagnostics.add)\n",
        "\n"
      )
    )

    // then apply the patches
    const newSourceText = yield* applyTextChanges(sourceText, patches)
    yield* fs.writeFileString(filePath, newSourceText)
    yield* Effect.logInfo(`${filePath} patched successfully.`)
  }, Effect.tapError(Effect.logError))
)
