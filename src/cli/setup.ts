import * as Command from "@effect/cli/Command"
import * as Prompt from "@effect/cli/Prompt"
import type * as PlatformError from "@effect/platform/Error"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import packageJson from "../../package.json"
import { assess, type Assessment } from "./setup/assessment"
import { computeChanges } from "./setup/changes"
import { renderCodeActions } from "./setup/diff-renderer"
import { FileReadError, PackageJsonNotFoundError } from "./setup/errors"
import { gatherTargetState } from "./setup/target-prompt"
import { selectTsConfigFile } from "./setup/tsconfig-prompt"
import { type FileInput } from "./utils"

/**
 * Read files from file system and create assessment input
 */
const createAssessmentInput = (
  currentDir: string,
  tsconfigInput: FileInput
): Effect.Effect<
  Assessment.Input,
  PackageJsonNotFoundError | FileReadError | PlatformError.PlatformError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    // Check package.json
    const packageJsonPath = path.join(currentDir, "package.json")
    const packageJsonExists = yield* fs.exists(packageJsonPath)

    if (!packageJsonExists) {
      return yield* new PackageJsonNotFoundError({ path: packageJsonPath })
    }

    const packageJsonText = yield* fs.readFileString(packageJsonPath).pipe(
      Effect.mapError((cause) => new FileReadError({ path: packageJsonPath, cause }))
    )
    const packageJsonInput: FileInput = {
      fileName: packageJsonPath,
      text: packageJsonText
    }

    // Check .vscode/settings.json (optional)
    const vscodeSettingsPath = path.join(currentDir, ".vscode", "settings.json")
    const vscodeSettingsExists = yield* fs.exists(vscodeSettingsPath)

    let vscodeSettingsInput = Option.none<FileInput>()
    if (vscodeSettingsExists) {
      const vscodeSettingsText = yield* fs.readFileString(vscodeSettingsPath).pipe(
        Effect.mapError((cause) => new FileReadError({ path: vscodeSettingsPath, cause }))
      )
      vscodeSettingsInput = Option.some({
        fileName: vscodeSettingsPath,
        text: vscodeSettingsText
      })
    }

    return {
      packageJson: packageJsonInput,
      tsconfig: tsconfigInput,
      vscodeSettings: vscodeSettingsInput
    }
  })

/**
 * Main setup command
 */
export const setup = Command.make(
  "setup",
  {},
  () =>
    Effect.gen(function*() {
      const path = yield* Path.Path

      // ========================================================================
      // Phase 1: Select tsconfig file
      // ========================================================================
      const currentDir = path.resolve(process.cwd())
      const tsconfigInput = yield* selectTsConfigFile(currentDir)

      // ========================================================================
      // Phase 2: Read files and create assessment input
      // ========================================================================

      const assessmentInput = yield* createAssessmentInput(currentDir, tsconfigInput)

      // ========================================================================
      // Phase 3: Perform assessment
      // ========================================================================

      const assessmentState = yield* assess(assessmentInput)

      // ========================================================================
      // Phase 4: Gather target state from user
      // ========================================================================
      const targetState = yield* gatherTargetState(assessmentState, {
        defaultLspVersion: `^${packageJson.version}`
      })

      // ========================================================================
      // Phase 5: Compute changes
      // ========================================================================
      const result = yield* computeChanges(assessmentState, targetState)

      // ========================================================================
      // Phase 6: Review changes
      // ========================================================================
      yield* renderCodeActions(result, assessmentState)

      if (result.codeActions.length === 0) {
        return
      }

      const shouldProceed = yield* Prompt.confirm({
        message: "Apply all changes?",
        initial: true
      })

      if (!shouldProceed) {
        yield* Console.log("Setup cancelled. No changes were made.")
        return
      }

      // ========================================================================
      // Phase 7: Apply changes
      // ========================================================================
      yield* Console.log("")
      yield* Console.log("Applying changes...")

      const fs = yield* FileSystem.FileSystem

      // Apply each code action
      for (const codeAction of result.codeActions) {
        for (const fileChange of codeAction.changes) {
          const fileName = fileChange.fileName

          // Check if file exists or if this is a new file
          const fileExists = yield* fs.exists(fileName)

          if (!fileExists && fileChange.isNewFile) {
            // Create new file - ensure directory exists first
            const dirName = path.dirname(fileName)
            yield* fs.makeDirectory(dirName, { recursive: true }).pipe(
              Effect.ignore // Ignore error if directory already exists
            )

            // For new files, just write the newText from the first change
            // (assumption: new files have a single TextChange spanning the entire file)
            const newContent = fileChange.textChanges.length > 0
              ? fileChange.textChanges[0].newText
              : ""

            yield* fs.writeFileString(fileName, newContent)
          } else if (fileExists) {
            // Read existing file
            const existingContent = yield* fs.readFileString(fileName)

            // Apply all text changes to the file
            // Sort changes in reverse order by position to avoid offset issues
            const sortedChanges = [...fileChange.textChanges].sort((a, b) => b.span.start - a.span.start)

            let newContent = existingContent
            for (const textChange of sortedChanges) {
              const start = textChange.span.start
              const end = start + textChange.span.length

              newContent = newContent.slice(0, start) + textChange.newText + newContent.slice(end)
            }

            // Write the modified content back
            yield* fs.writeFileString(fileName, newContent)
          }
        }
      }

      yield* Console.log("Changes applied successfully!")
      yield* Console.log("")

      // Display any additional messages (e.g., editor setup instructions)
      for (const message of result.messages) {
        yield* Console.log(message)
      }
    })
).pipe(
  Command.withDescription("Setup the effect-language-service for the given project using an interactive cli.")
)
