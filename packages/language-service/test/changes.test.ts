import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { describe, expect, it } from "vitest"
import { assess, type Assessment } from "../src/cli/setup/assessment"
import { computeChanges } from "../src/cli/setup/changes"
import type { Target } from "../src/cli/setup/target"
import { TypeScriptContext } from "../src/cli/utils"

function createAssessmentInput(tsconfig: Record<string, unknown>): Assessment.Input {
  return {
    packageJson: {
      fileName: "package.json",
      text: JSON.stringify({ name: "test-project", version: "1.0.0", dependencies: {} }, null, 2)
    },
    tsconfig: {
      fileName: "tsconfig.json",
      text: JSON.stringify(tsconfig, null, 2)
    },
    vscodeSettings: Option.none(),
    agentsMd: Option.none(),
    claudeMd: Option.none()
  }
}

function applyTextChanges(
  originalText: string,
  textChanges: ReadonlyArray<{ span: { start: number; length: number }; newText: string }>
): string {
  let result = originalText
  const sortedChanges = [...textChanges].sort((a, b) => b.span.start - a.span.start)
  for (const change of sortedChanges) {
    result = result.slice(0, change.span.start) +
      change.newText +
      result.slice(change.span.start + change.span.length)
  }
  return result
}

describe("computeChanges", () => {
  it("adds compilerOptions with plugin when tsconfig lacks compilerOptions", async () => {
    const assessmentInput = createAssessmentInput({})
    const assessmentState = await Effect.runPromise(
      assess(assessmentInput).pipe(Effect.provide(TypeScriptContext.live(".")))
    )

    const targetState: Target.State = {
      packageJson: {
        lspVersion: Option.some({ dependencyType: "devDependencies", version: "workspace:*" }),
        prepareScript: false
      },
      tsconfig: {
        diagnosticSeverities: Option.some({ floatingEffect: "warning" })
      },
      vscodeSettings: Option.none(),
      editors: []
    }

    const result = await Effect.runPromise(
      computeChanges(assessmentState, targetState).pipe(Effect.provide(TypeScriptContext.live(".")))
    )

    const tsconfigFileChange = result.codeActions
      .flatMap((action) => action.changes)
      .find((fc) => fc.fileName === "tsconfig.json")

    expect(tsconfigFileChange).toBeDefined()

    const finalTsconfig = applyTextChanges(assessmentInput.tsconfig.text, tsconfigFileChange!.textChanges)
    expect(JSON.parse(finalTsconfig)).toEqual({
      $schema: "https://raw.githubusercontent.com/Effect-TS/language-service/refs/heads/main/schema.json",
      compilerOptions: {
        plugins: [{
          name: "@effect/language-service",
          diagnosticSeverity: {
            floatingEffect: "warning"
          }
        }]
      }
    })
  })
})
