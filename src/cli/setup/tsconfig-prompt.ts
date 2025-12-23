import * as Prompt from "@effect/cli/Prompt"
import type * as PlatformError from "@effect/platform/Error"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import type { QuitException, Terminal } from "@effect/platform/Terminal"
import * as Array from "effect/Array"
import * as Effect from "effect/Effect"
import type { FileInput } from "../utils"
import { FileReadError, TsConfigNotFoundError } from "./errors"

/**
 * Find tsconfig files in a directory
 */
const findTsConfigFiles = (
  currentDir: string
): Effect.Effect<ReadonlyArray<string>, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const files = yield* fs.readDirectory(currentDir)
    const tsconfigFiles = Array.filter(files, (file) => {
      const fileName = file.toLowerCase()
      return (fileName.startsWith("tsconfig") && (fileName.endsWith(".json") || fileName.endsWith(".jsonc")))
    }).map((file) => path.join(currentDir, file))

    return tsconfigFiles
  })

/**
 * Prompt user to select a tsconfig file and read its contents
 */
export const selectTsConfigFile = (
  currentDir: string
): Effect.Effect<
  FileInput,
  PlatformError.PlatformError | QuitException | TsConfigNotFoundError | FileReadError,
  FileSystem.FileSystem | Path.Path | Terminal
> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem

    const tsconfigFiles = yield* findTsConfigFiles(currentDir)

    let selectedTsconfigPath: string

    if (tsconfigFiles.length === 0) {
      // No tsconfig files found - go directly to manual entry
      selectedTsconfigPath = yield* Prompt.text({
        message: "Enter path to your tsconfig.json file"
      })
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
        selectedTsconfigPath = yield* Prompt.text({
          message: "Enter path to your tsconfig.json file"
        })
      } else {
        selectedTsconfigPath = selected
      }
    }

    // Check if the selected tsconfig file exists
    const tsconfigExists = yield* fs.exists(selectedTsconfigPath)
    if (!tsconfigExists) {
      return yield* Effect.fail(
        new TsConfigNotFoundError({ path: selectedTsconfigPath })
      )
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
