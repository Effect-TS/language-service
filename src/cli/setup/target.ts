import * as Option from "effect/Option"
import type { DiagnosticSeverity } from "../../core/LanguageServicePluginOptions"

/**
 * Target namespace containing all target configuration types
 */
export namespace Target {
  /**
   * Target package.json configuration
   */
  export interface PackageJson {
    readonly shouldInstallLsp: boolean
    readonly shouldAddPrepareScript: boolean
  }

  /**
   * Target tsconfig.json configuration
   */
  export interface TsConfig {
    readonly path: string // Path to the tsconfig to configure
    readonly shouldAddLspPlugin: boolean
    readonly diagnosticSeverities: Record<string, DiagnosticSeverity | "off">
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
    readonly packageJson: Option.Option<PackageJson>
    readonly tsconfig: Option.Option<TsConfig>
    readonly vscodeSettings: Option.Option<VSCodeSettings>
  }
}
