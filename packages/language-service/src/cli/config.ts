import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Path from "effect/Path"
import { Command } from "effect/unstable/cli"
import * as Assessment from "./setup/assessment"
import * as Changes from "./setup/changes"
import { getAllDiagnostics } from "./setup/diagnostic-info"
import { createDiagnosticPrompt } from "./setup/diagnostic-prompt"
import * as Target from "./setup/target"
import { selectTsConfigFile } from "./setup/tsconfig-prompt"

export const config = Command.make(
  "config",
  {},
  () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const currentDir = path.resolve(process.cwd())
      const tsconfigInput = yield* selectTsConfigFile(currentDir)
      const assessmentInput = yield* Assessment.createAssessmentInput(currentDir, tsconfigInput)
      const assessmentState = yield* Assessment.assess(assessmentInput)

      const allDiagnostics = getAllDiagnostics()
      const currentDiagnosticSeverities = Option.match(assessmentState.tsconfig.currentOptions, {
        onNone: () => ({}),
        onSome: (options) => options.diagnosticSeverity
      })

      const diagnosticSeverities = yield* createDiagnosticPrompt(allDiagnostics, currentDiagnosticSeverities)
      const targetState = Target.withDiagnosticSeverities(Target.fromAssessment(assessmentState), diagnosticSeverities)
      const result = yield* Changes.computeChanges(assessmentState, targetState)

      yield* Changes.reviewAndApplyChanges(result, assessmentState, {
        confirmMessage: "Apply diagnostic configuration changes?",
        cancelMessage: "Configuration cancelled. No changes were made."
      })
    })
).pipe(
  Command.withDescription("Configure diagnostic severities for an existing tsconfig using the interactive rule picker.")
)
