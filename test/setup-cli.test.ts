import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { describe, expect, it } from "vitest"
import { assess, type Assessment } from "../src/cli/setup/assessment"
import { computeChanges } from "../src/cli/setup/changes"
import type { Target } from "../src/cli/setup/target"
import { TypeScriptContext } from "../src/cli/utils"

/**
 * Create a test assessment input from plain objects
 */
function createTestAssessmentInput(
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
      : Option.none()
  }
}

/**
 * Apply text changes to original text and return the result
 */
function applyTextChanges(
  originalText: string,
  textChanges: ReadonlyArray<{ span: { start: number; length: number }; newText: string }>
): string {
  let result = originalText
  // Apply changes in reverse order to maintain correct positions
  const sortedChanges = [...textChanges].sort((a, b) => b.span.start - a.span.start)
  for (const change of sortedChanges) {
    const before = result.substring(0, change.span.start)
    const after = result.substring(change.span.start + change.span.length)
    result = before + change.newText + after
  }
  return result
}

/**
 * Helper to test setup changes and generate snapshots
 */
export async function expectSetupChanges(
  assessmentInput: Assessment.Input,
  targetState: Target.State
) {
  // Run assessment
  const assessmentState = await Effect.runPromise(
    assess(assessmentInput).pipe(Effect.provide(TypeScriptContext.live))
  )

  // Compute changes
  const changes = await Effect.runPromise(
    computeChanges(assessmentState, targetState).pipe(Effect.provide(TypeScriptContext.live))
  )

  // 1. Snapshot of change summary (file + description)
  const changeSummary = changes.map((change) => ({
    file: change.filePath,
    description: change.description
  }))
  expect(changeSummary).toMatchSnapshot("change summary")

  // 2. Snapshot of final package.json and validate it's valid JSON
  const packageJsonChange = changes.find((c) => c.filePath === "package.json")
  if (packageJsonChange) {
    const finalPackageJson = applyTextChanges(assessmentInput.packageJson.text, packageJsonChange.textChanges)
    expect(finalPackageJson).toMatchSnapshot("package.json")

    // Assert that the final package.json is valid JSON
    expect(() => {
      JSON.parse(finalPackageJson)
    }).not.toThrow()
  }

  // 3. Snapshot of final tsconfig.json and validate it's valid JSON
  const tsconfigChange = changes.find((c) => c.filePath === "tsconfig.json")
  if (tsconfigChange) {
    const finalTsconfig = applyTextChanges(assessmentInput.tsconfig.text, tsconfigChange.textChanges)
    expect(finalTsconfig).toMatchSnapshot("tsconfig.json")

    // Assert that the final tsconfig.json is valid JSON
    expect(() => {
      JSON.parse(finalTsconfig)
    }).not.toThrow()
  }
}

describe("Setup CLI", () => {
  it("should generate changes for adding LSP with defaults", async () => {
    const assessmentInput = createTestAssessmentInput(
      {
        name: "test-project",
        version: "1.0.0",
        dependencies: {}
      },
      {
        compilerOptions: {
          strict: true,
          target: "ES2022"
        }
      }
    )

    const targetState: Target.State = {
      packageJson: {
        lspVersion: Option.some({ dependencyType: "devDependencies" as const, version: "workspace:*" }),
        prepareScript: false
      },
      tsconfig: {
        diagnosticSeverities: Option.none()
      },
      vscodeSettings: Option.none()
    }

    await expectSetupChanges(assessmentInput, targetState)
  })

  it("should generate changes for removing LSP when already installed", async () => {
    const assessmentInput = createTestAssessmentInput(
      {
        name: "test-project",
        version: "1.0.0",
        dependencies: {},
        devDependencies: {
          "@effect/language-service": "^0.1.0",
          typescript: "^5.0.0"
        }
      },
      {
        compilerOptions: {
          strict: true,
          target: "ES2022",
          plugins: [
            {
              name: "@effect/language-service"
            }
          ]
        }
      }
    )

    const targetState: Target.State = {
      packageJson: {
        lspVersion: Option.none(),
        prepareScript: false
      },
      tsconfig: {
        diagnosticSeverities: Option.none()
      },
      vscodeSettings: Option.none()
    }

    await expectSetupChanges(assessmentInput, targetState)
  })

  it("should generate changes for adding LSP with custom diagnostic severities", async () => {
    const assessmentInput = createTestAssessmentInput(
      {
        name: "test-project",
        version: "1.0.0",
        dependencies: {}
      },
      {
        compilerOptions: {
          strict: true,
          target: "ES2022"
        }
      }
    )

    const targetState: Target.State = {
      packageJson: {
        lspVersion: Option.some({ dependencyType: "devDependencies" as const, version: "workspace:*" }),
        prepareScript: false
      },
      tsconfig: {
        diagnosticSeverities: Option.some({
          "effect/floatingEffect": "error",
          "effect/anyUnknownInErrorContext": "warning"
        })
      },
      vscodeSettings: Option.none()
    }

    await expectSetupChanges(assessmentInput, targetState)
  })

  it("should generate changes for updating existing LSP with new diagnostic severities", async () => {
    const assessmentInput = createTestAssessmentInput(
      {
        name: "test-project",
        version: "1.0.0",
        devDependencies: {
          "@effect/language-service": "^0.1.0"
        }
      },
      {
        compilerOptions: {
          strict: true,
          target: "ES2022",
          plugins: [
            {
              name: "@effect/language-service"
            }
          ]
        }
      }
    )

    const targetState: Target.State = {
      packageJson: {
        lspVersion: Option.some({ dependencyType: "devDependencies" as const, version: "^0.1.0" }),
        prepareScript: false
      },
      tsconfig: {
        diagnosticSeverities: Option.some({
          "effect/floatingEffect": "error",
          "effect/catchUnfailableEffect": "off"
        })
      },
      vscodeSettings: Option.none()
    }

    await expectSetupChanges(assessmentInput, targetState)
  })

  it("should generate changes for adding LSP with prepare script", async () => {
    const assessmentInput = createTestAssessmentInput(
      {
        name: "test-project",
        version: "1.0.0",
        dependencies: {}
      },
      {
        compilerOptions: {
          strict: true,
          target: "ES2022"
        }
      }
    )

    const targetState: Target.State = {
      packageJson: {
        lspVersion: Option.some({ dependencyType: "devDependencies" as const, version: "workspace:*" }),
        prepareScript: true
      },
      tsconfig: {
        diagnosticSeverities: Option.none()
      },
      vscodeSettings: Option.none()
    }

    await expectSetupChanges(assessmentInput, targetState)
  })

  it("should generate changes for removing LSP and prepare script", async () => {
    const assessmentInput = createTestAssessmentInput(
      {
        name: "test-project",
        version: "1.0.0",
        devDependencies: {
          "@effect/language-service": "^0.1.0",
          typescript: "^5.0.0"
        },
        scripts: {
          prepare: "effect-language-service patch"
        }
      },
      {
        compilerOptions: {
          strict: true,
          target: "ES2022",
          plugins: [
            {
              name: "@effect/language-service"
            }
          ]
        }
      }
    )

    const targetState: Target.State = {
      packageJson: {
        lspVersion: Option.none(),
        prepareScript: false
      },
      tsconfig: {
        diagnosticSeverities: Option.none()
      },
      vscodeSettings: Option.none()
    }

    await expectSetupChanges(assessmentInput, targetState)
  })

  it("should not override existing plugins when adding LSP plugin", async () => {
    const assessmentInput = createTestAssessmentInput(
      {
        name: "test-project",
        version: "1.0.0",
        dependencies: {}
      },
      {
        compilerOptions: {
          strict: true,
          target: "ES2022",
          plugins: [
            {
              name: "typescript-plugin-css-modules",
              options: {
                classnameTransform: "camelCase"
              }
            },
            {
              name: "another-typescript-plugin"
            }
          ]
        }
      }
    )

    const targetState: Target.State = {
      packageJson: {
        lspVersion: Option.some({ dependencyType: "devDependencies" as const, version: "workspace:*" }),
        prepareScript: false
      },
      tsconfig: {
        diagnosticSeverities: Option.some({
          "effect/floatingEffect": "error"
        })
      },
      vscodeSettings: Option.none()
    }

    await expectSetupChanges(assessmentInput, targetState)
  })

  it("should add LSP plugin alongside existing plugins", async () => {
    const assessmentInput = createTestAssessmentInput(
      {
        name: "test-project",
        version: "1.0.0",
        dependencies: {}
      },
      {
        compilerOptions: {
          strict: true,
          target: "ES2022",
          plugins: [
            {
              name: "typescript-plugin-css-modules"
            }
          ]
        }
      }
    )

    const targetState: Target.State = {
      packageJson: {
        lspVersion: Option.some({ dependencyType: "devDependencies" as const, version: "workspace:*" }),
        prepareScript: false
      },
      tsconfig: {
        diagnosticSeverities: Option.none()
      },
      vscodeSettings: Option.none()
    }

    await expectSetupChanges(assessmentInput, targetState)
  })

  it("should remove only LSP plugin while preserving other plugins", async () => {
    const assessmentInput = createTestAssessmentInput(
      {
        name: "test-project",
        version: "1.0.0",
        dependencies: {},
        devDependencies: {
          "@effect/language-service": "^0.1.0",
          typescript: "^5.0.0"
        }
      },
      {
        compilerOptions: {
          strict: true,
          target: "ES2022",
          plugins: [
            {
              name: "typescript-plugin-css-modules"
            },
            {
              name: "@effect/language-service"
            }
          ]
        }
      }
    )

    const targetState: Target.State = {
      packageJson: {
        lspVersion: Option.none(),
        prepareScript: false
      },
      tsconfig: {
        diagnosticSeverities: Option.none()
      },
      vscodeSettings: Option.none()
    }

    await expectSetupChanges(assessmentInput, targetState)
  })

  it("should update LSP version when already installed with older version", async () => {
    const assessmentInput = createTestAssessmentInput(
      {
        name: "test-project",
        version: "1.0.0",
        dependencies: {},
        devDependencies: {
          "@effect/language-service": "^0.1.0",
          typescript: "^5.0.0"
        }
      },
      {
        compilerOptions: {
          strict: true,
          target: "ES2022",
          plugins: [
            {
              name: "@effect/language-service"
            }
          ]
        }
      }
    )

    const targetState: Target.State = {
      packageJson: {
        lspVersion: Option.some({ dependencyType: "devDependencies" as const, version: "^0.2.0" }),
        prepareScript: false
      },
      tsconfig: {
        diagnosticSeverities: Option.none()
      },
      vscodeSettings: Option.none()
    }

    await expectSetupChanges(assessmentInput, targetState)
  })
})
