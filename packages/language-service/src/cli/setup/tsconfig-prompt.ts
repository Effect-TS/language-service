import * as Array from "effect/Array"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import type * as PlatformError from "effect/PlatformError"
import * as Prompt from "effect/unstable/cli/Prompt"
import { FileReadError, TsConfigNotFoundError } from "./errors"

/**
 * Find tsconfig files in a directory
 */
const isTsConfigFile = (file: string) => {
  const fileName = file.toLowerCase()
  return fileName.endsWith(".json") || fileName.endsWith(".jsonc")
}

const findTsConfigFiles = (
  currentDir: string
): Effect.Effect<ReadonlyArray<string>, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const files = yield* fs.readDirectory(currentDir)
    const tsconfigFiles = Array.filter(files, isTsConfigFile).map((file) => path.join(currentDir, file))

    return tsconfigFiles
  })

const promptForTsConfigPath = (currentDir: string) =>
  Prompt.file({
    type: "file",
    message: "Select tsconfig to configure",
    startingPath: currentDir,
    filter: (file) => file === ".." || !file.includes(".") || isTsConfigFile(file)
  })

/**
 * Prompt user to select a tsconfig file and read its contents
 */
export const selectTsConfigFile = (
  currentDir: string
) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const tsconfigFiles = yield* findTsConfigFiles(currentDir)

    let selectedTsconfigPath: string

    if (tsconfigFiles.length === 0) {
      // No tsconfig files found - go directly to file picker
      selectedTsconfigPath = yield* promptForTsConfigPath(currentDir)
    } else {
      // Show selection menu with found files + manual option
      const choices = [
        ...tsconfigFiles.map((file) => ({
          title: file,
          value: file
        })),
        {
          title: "Enter path manually",
          value: "__manual__"
        }
      ]

      const selected = yield* Prompt.select({
        message: "Select tsconfig to configure",
        choices
      })

      if (selected === "__manual__") {
        selectedTsconfigPath = yield* promptForTsConfigPath(currentDir)
      } else {
        selectedTsconfigPath = selected
      }
    }
    selectedTsconfigPath = path.resolve(selectedTsconfigPath)

    // Check if the selected tsconfig file exists
    const tsconfigExists = yield* fs.exists(selectedTsconfigPath)
    if (!tsconfigExists) {
      return yield* new TsConfigNotFoundError({ path: selectedTsconfigPath })
    }

    // Read the tsconfig file
    const tsconfigText = yield* fs.readFileString(selectedTsconfigPath).pipe(
      Effect.mapError((cause) => new FileReadError({ path: selectedTsconfigPath, cause }))
    )

    return {
      fileName: selectedTsconfigPath,
      text: tsconfigText
    }
  })
