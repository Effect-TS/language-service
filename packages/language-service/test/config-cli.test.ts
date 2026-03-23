import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { describe, expect, it } from "vitest"
import { assess, type Assessment } from "../src/cli/setup/assessment"
import { computeChanges } from "../src/cli/setup/changes"
import * as Target from "../src/cli/setup/target"
import { TypeScriptContext } from "../src/cli/utils"

function createAssessmentInput(
  packageJson: Record<string, unknown>,
  tsconfig: Record<string, unknown>,
  vscodeSettings?: Record<string, unknown>
): Assessment.Input {
  return {
    packageJson: {
      fileName: "package.json",
      text: JSON.stringify(packageJson, null, 2)
    },
    tsconfig: {
      fileName: "tsconfig.json",
      text: JSON.stringify(tsconfig, null, 2)
    },
    vscodeSettings: vscodeSettings
      ? Option.some({
        fileName: ".vscode/settings.json",
        text: JSON.stringify(vscodeSettings, null, 2)
      })
      : Option.none(),
    agentsMd: Option.none(),
    claudeMd: Option.none()
  }
}

describe("Config CLI", () => {
  it("only targets diagnostic severities", async () => {
    const assessmentInput = createAssessmentInput(
      {
        name: "test-project",
        version: "1.0.0",
        devDependencies: {
          "@effect/language-service": "^0.1.0"
        },
        scripts: {
          prepare: "effect-language-service patch"
        }
      },
      {
        compilerOptions: {
          strict: true,
          plugins: [{
            name: "@effect/language-service",
            diagnosticSeverity: {
              floatingeffect: "warning"
            }
          }]
        }
      },
      {
        "editor.formatOnSave": true
      }
    )

    const assessmentState = await Effect.runPromise(
      assess(assessmentInput).pipe(Effect.provide(TypeScriptContext.live(".")))
    )

    const targetState = Target.withDiagnosticSeverities(Target.fromAssessment(assessmentState), {
      floatingEffect: "error",
      globalFetch: "warning"
    })

    expect(targetState.packageJson.lspVersion).toEqual(assessmentState.packageJson.lspVersion)
    expect(targetState.packageJson.prepareScript).toBe(true)
    expect(targetState.editors).toEqual([])
    expect(targetState.vscodeSettings).toEqual(Option.map(assessmentState.vscodeSettings, (settings) => ({
      settings: settings.settings
    })))

    const result = await Effect.runPromise(
      computeChanges(assessmentState, targetState).pipe(Effect.provide(TypeScriptContext.live(".")))
    )

    expect(result.codeActions.some((action) => action.changes.some((change) => change.fileName === "tsconfig.json")))
      .toBe(true)
    expect(result.codeActions.some((action) => action.changes.some((change) => change.fileName === "package.json")))
      .toBe(false)
    expect(
      result.codeActions.some((action) => action.changes.some((change) => change.fileName === ".vscode/settings.json"))
    ).toBe(false)
  })
})
