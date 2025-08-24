import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Effect from "effect/Effect"
import { getModuleFilePath, getUnpatchedSourceFile } from "./utils"

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

export const unpatch = Command.make(
  "unpatch",
  { dirPath, moduleNames },
  Effect.fn("unpatch")(function*({ dirPath, moduleNames }) {
    const fs = yield* FileSystem.FileSystem

    const modulesToUnpatch = moduleNames.length === 0 ? ["typescript", "tsc"] as const : moduleNames
    for (const moduleName of modulesToUnpatch) {
      yield* Effect.logDebug(`Resolving ${moduleName}...`)
      const filePath = yield* getModuleFilePath(dirPath, moduleName)

      yield* Effect.logDebug(`Unpatching ${filePath}...`)
      const sourceFile = yield* getUnpatchedSourceFile(filePath)

      yield* Effect.logDebug(`Writing ${filePath}...`)
      yield* fs.writeFileString(filePath, sourceFile.text)

      yield* Effect.logInfo(`${filePath} unpatched successfully.`)
    }
  })
)
