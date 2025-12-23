import * as Command from "@effect/cli/Command"
import * as Prompt from "@effect/cli/Prompt"
import type * as PlatformError from "@effect/platform/Error"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { assess, type Assessment } from "./setup/assessment"
import { computeChanges } from "./setup/changes"
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
      return yield* Effect.fail(
        new PackageJsonNotFoundError({ path: packageJsonPath })
      )
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
      const currentDir = path.resolve(".")
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
      const targetState = yield* gatherTargetState(assessmentState)

      // ========================================================================
      // Phase 5: Compute changes
      // ========================================================================
      const changes = yield* computeChanges(assessmentState, targetState)

      // ========================================================================
      // Phase 6: Review changes
      // ========================================================================
      yield* Console.log("📋 Review Changes")
      yield* Console.log("=================")
      yield* Console.log("")

      if (changes.length === 0) {
        yield* Console.log("✅ No changes needed - your configuration is already up to date!")
        return
      }

      // Display changes by file
      for (const change of changes) {
        yield* Console.log(`📄 ${change.filePath}`)
        yield* Console.log(`  ${change.description}`)
        yield* Console.log("")
      }

      yield* Console.log(`Total: ${changes.length} file(s) will be modified`)
      yield* Console.log("")

      const shouldProceed = yield* Prompt.confirm({
        message: "Apply all changes?",
        initial: true
      })

      if (!shouldProceed) {
        yield* Console.log("Setup cancelled. No changes were made.")
        return
      }

      // ========================================================================
      // Phase 7: Apply changes (Placeholder - to be implemented)
      // ========================================================================
      yield* Console.log("")
      yield* Console.log("⚠️  Application phase not yet implemented")
      yield* Console.log(`Would apply changes to ${changes.length} file(s)`)
    })
)
