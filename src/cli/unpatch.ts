import * as Command from "@effect/cli/Command"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Effect from "effect/Effect"
import { applyTextChanges, extractAppliedPatches, getTsPackageInfo, getUnderscoreTscSourceFile } from "./utils"

export const unpatch = Command.make(
  "unpatch",
  {},
  Effect.fn("unpatch")(function*() {
    const fs = yield* FileSystem.FileSystem
    const { dir } = yield* getTsPackageInfo()
    const { filePath, sourceFile, sourceText } = yield* getUnderscoreTscSourceFile(dir)
    const { revertChanges } = yield* extractAppliedPatches(sourceFile)
    const newSourceText = yield* applyTextChanges(sourceText, revertChanges)
    yield* fs.writeFileString(filePath, newSourceText)
    yield* Effect.logInfo(`${filePath} unpatched successfully.`)
  }, Effect.tapError(Effect.logError))
)
