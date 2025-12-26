import type * as Option from "effect/Option"
import type { DiagnosticSeverity } from "../../core/LanguageServicePluginOptions"

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
