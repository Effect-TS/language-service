import * as Effect from "effect/Effect"
import * as Path from "effect/Path"
import { Command } from "effect/unstable/cli"
import packageJson from "../../package.json"
import * as Assessment from "./setup/assessment"
import * as Changes from "./setup/changes"
import { gatherTargetState } from "./setup/target-prompt"
import { selectTsConfigFile } from "./setup/tsconfig-prompt"

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

      const assessmentInput = yield* Assessment.createAssessmentInput(currentDir, tsconfigInput)

      // ========================================================================
      // Phase 3: Perform assessment
      // ========================================================================

      const assessmentState = yield* Assessment.assess(assessmentInput)

      // ========================================================================
      // Phase 4: Gather target state from user
      // ========================================================================
      const targetState = yield* gatherTargetState(assessmentState, {
        defaultLspVersion: `^${packageJson.version}`
      })

      // ========================================================================
      // Phase 5: Compute changes
      // ========================================================================
      const result = yield* Changes.computeChanges(assessmentState, targetState)

      // ========================================================================
      // Phase 6: Review changes
      // ========================================================================

      yield* Changes.reviewAndApplyChanges(result, assessmentState, {
        cancelMessage: "Setup cancelled. No changes were made."
      })
    })
).pipe(
  Command.withDescription("Setup the effect-language-service for the given project using an interactive cli.")
)
