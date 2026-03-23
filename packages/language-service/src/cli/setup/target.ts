import * as Option from "effect/Option"
import type { DiagnosticSeverity } from "../../core/LanguageServicePluginOptions"
import type * as Assesment from "./assessment"

/**
 * Supported editor types
 */
export type Editor = "vscode" | "nvim" | "emacs"

/**
 * Target namespace containing all target configuration types
 */
export namespace Target {
  /**
   * Target package.json configuration
   */
  export interface PackageJson {
    readonly lspVersion: Option.Option<{
      readonly dependencyType: "dependencies" | "devDependencies"
      readonly version: string
    }> // None = not installed
    readonly prepareScript: boolean
  }

  /**
   * Target tsconfig.json configuration
   */
  export interface TsConfig {
    readonly diagnosticSeverities: Option.Option<Record<string, DiagnosticSeverity | "off">>
  }

  /**
   * Target .vscode/settings.json configuration
   */
  export interface VSCodeSettings {
    readonly settings: Record<string, unknown> // Desired settings
  }

  /**
   * Complete target state defining what configuration should be achieved
   */
  export interface State {
    readonly packageJson: PackageJson
    readonly tsconfig: TsConfig
    readonly vscodeSettings: Option.Option<VSCodeSettings>
    readonly editors: ReadonlyArray<Editor>
  }
}

export const fromAssessment = (inputState: Assesment.Assessment.State): Target.State => ({
  packageJson: {
    lspVersion: inputState.packageJson.lspVersion,
    prepareScript: Option.map(inputState.packageJson.prepareScript, (_) => _.hasPatch).pipe(
      Option.getOrElse(() => false)
    )
  },
  tsconfig: {
    diagnosticSeverities: Option.map(inputState.tsconfig.currentOptions, (_) => _.diagnosticSeverity)
  },
  vscodeSettings: Option.map(inputState.vscodeSettings, (settings) => ({
    settings: settings.settings
  })),
  editors: []
})

export const withDiagnosticSeverities = (
  state: Target.State,
  diagnosticSeverities: Record<string, DiagnosticSeverity | "off">
): Target.State => ({
  ...state,
  tsconfig: {
    ...state.tsconfig,
    diagnosticSeverities: Option.some(diagnosticSeverities)
  }
})
