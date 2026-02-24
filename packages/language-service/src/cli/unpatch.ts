import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import { Command, Flag } from "effect/unstable/cli"
import { getModuleFilePath, getSourceFileText, getUnpatchedSourceFile } from "./utils"

const LOCAL_TYPESCRIPT_DIR = "./node_modules/typescript"

const dirPath = Flag.directory("dir").pipe(
  Flag.withDefault(LOCAL_TYPESCRIPT_DIR),
  Flag.withDescription("The directory of the typescript package to patch.")
)

const moduleNames = Flag.choice("module", [
  "tsc",
  "typescript"
]).pipe(
  Flag.atLeast(0),
  Flag.withDescription("The name of the module to patch.")
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

      yield* Effect.logDebug(`Reading ${moduleName} from ${filePath}...`)
      const sourceText = yield* getSourceFileText(filePath)

      yield* Effect.logDebug(`Unpatching ${filePath}...`)
      const sourceFile = yield* getUnpatchedSourceFile(filePath, sourceText)

      yield* Effect.logDebug(`Writing ${filePath}...`)
      yield* fs.writeFileString(filePath, sourceFile.text)

      yield* Effect.logInfo(`${filePath} unpatched successfully.`)
    }
  })
).pipe(
  Command.withDescription("Unpatches the typescript package from the effect-language-service.")
)
