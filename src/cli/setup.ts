import * as Command from "@effect/cli/Command"
import * as Prompt from "@effect/cli/Prompt"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { analyzeTsConfig, assessPackageJson, assessVSCodeSettings, findTsConfigFiles } from "./setup/assessment"
import { getAllDiagnostics } from "./setup/diagnostic-info"
import { createDiagnosticPrompt } from "./setup/diagnostic-prompt"

/**
 * Main setup command
 */
export const setup = Command.make(
  "setup",
  {},
  () =>
    Effect.gen(function*() {
      // Phase 1: Assessment
      yield* Console.log("🔍 Analyzing your project...")
      yield* Console.log("")

      // Check package.json
      const packageJsonInfo = yield* assessPackageJson

      if (Option.isNone(packageJsonInfo)) {
        return yield* Effect.fail(
          new Error("No package.json found in current directory. Please run this command in the root of your project.")
        )
      }

      yield* Console.log("✓ Found package.json")

      // Find tsconfig files
      const tsconfigFiles = yield* findTsConfigFiles
      yield* Console.log(`✓ Found ${tsconfigFiles.length} tsconfig file(s)`)

      // Check .vscode/settings.json
      const vscodeSettings = yield* assessVSCodeSettings
      if (Option.isSome(vscodeSettings)) {
        yield* Console.log("✓ Found .vscode/settings.json")
      }

      yield* Console.log("")

      // Phase 2: Configuration

      // === Package.json Configuration ===
      yield* Console.log("📦 Package Configuration")
      yield* Console.log("========================")

      const pkgJson = packageJsonInfo.value

      let shouldInstallLsp = false
      if (Option.isNone(pkgJson.lspVersion)) {
        yield* Console.log("❌ @effect/language-service is not installed")
        shouldInstallLsp = yield* Prompt.confirm({
          message: "Would you like to add @effect/language-service to devDependencies?",
          initial: true
        })
      } else {
        const lspInfo = pkgJson.lspVersion.value
        yield* Console.log(`✅ @effect/language-service is installed in ${lspInfo.dependencyType} (version: ${lspInfo.version})`)
      }

      let shouldAddPrepareScript = false
      if (Option.isNone(pkgJson.prepareScript)) {
        yield* Console.log("ℹ️  No prepare script found")
        shouldAddPrepareScript = yield* Prompt.confirm({
          message: "Add prepare script to run patch on install?",
          initial: true
        })
      } else if (!pkgJson.prepareScript.value.hasPatch) {
        yield* Console.log("⚠️  prepare script exists but doesn't include patch command")
        shouldAddPrepareScript = yield* Prompt.confirm({
          message: "Add prepare script to run patch on install?",
          initial: true
        })
      } else {
        yield* Console.log("✅ prepare script already includes patch command")
      }

      yield* Console.log("")

      // === TypeScript Configuration ===
      yield* Console.log("📝 TypeScript Configuration")
      yield* Console.log("============================")

      // Let user select tsconfig file
      let selectedTsconfig: string

      if (tsconfigFiles.length === 0) {
        yield* Console.log("❌ No tsconfig files found")
        selectedTsconfig = yield* Prompt.text({
          message: "Enter path to your tsconfig.json file"
        })
      } else if (tsconfigFiles.length === 1) {
        yield* Console.log(`Found: ${tsconfigFiles[0]}`)
        const useThis = yield* Prompt.confirm({
          message: "Use this tsconfig file?",
          initial: true
        })
        if (useThis) {
          selectedTsconfig = tsconfigFiles[0]
        } else {
          selectedTsconfig = yield* Prompt.text({
            message: "Enter path to your tsconfig.json file"
          })
        }
      } else {
        // Multiple tsconfig files
        const choices = [
          ...tsconfigFiles.map((file) => ({
            title: file,
            value: file
          })),
          {
            title: "Enter path manually",
            value: "__manual__"
          }
        ]

        const selected = yield* Prompt.select({
          message: "Select tsconfig to configure",
          choices
        })

        if (selected === "__manual__") {
          selectedTsconfig = yield* Prompt.text({
            message: "Enter path to your tsconfig.json file"
          })
        } else {
          selectedTsconfig = selected
        }
      }

      // Analyze selected tsconfig
      const tsconfigInfo = yield* analyzeTsConfig(selectedTsconfig)

      let shouldAddLspPlugin = false
      if (Option.isNone(tsconfigInfo.currentOptions)) {
        if (tsconfigInfo.hasPlugins) {
          yield* Console.log("⚠️  Plugins section exists but @effect/language-service not configured")
        } else {
          yield* Console.log("❌ No plugins section in tsconfig.json")
        }
        shouldAddLspPlugin = yield* Prompt.confirm({
          message: "Add @effect/language-service plugin?",
          initial: true
        })
      } else {
        yield* Console.log("✅ @effect/language-service plugin is configured")
      }

      yield* Console.log("")

      // === Diagnostic Severity Configuration ===
      const allDiagnostics = getAllDiagnostics()
      // Use current severities if plugin is configured, otherwise use defaults
      const initialSeverities = Option.match(tsconfigInfo.currentOptions, {
        onNone: () => ({}),
        onSome: (options) => options.diagnosticSeverity
      })
      const configuredSeverities = yield* createDiagnosticPrompt(
        allDiagnostics,
        initialSeverities
      )

      yield* Console.log("")

      // Phase 3: Review (Simplified for now)
      yield* Console.log("📋 Review Changes")
      yield* Console.log("=================")
      yield* Console.log("")

      if (shouldInstallLsp || shouldAddPrepareScript) {
        yield* Console.log("📦 package.json")
        if (shouldInstallLsp) {
          yield* Console.log("  ✓ Add @effect/language-service to devDependencies")
        }
        if (shouldAddPrepareScript) {
          yield* Console.log("  ✓ Add prepare script: \"effect-language-service patch\"")
        }
        yield* Console.log("")
      }

      yield* Console.log(`📝 ${selectedTsconfig}`)
      if (shouldAddLspPlugin) {
        yield* Console.log("  ✓ Configure @effect/language-service plugin")
      }

      // Count changed severities
      const changedSeverities = Object.entries(configuredSeverities).filter(([name, severity]) => {
        const diagnostic = allDiagnostics.find((d) => d.name === name)
        return diagnostic && severity !== diagnostic.defaultSeverity
      })

      if (changedSeverities.length > 0) {
        yield* Console.log(`  ✓ Set diagnostic severities (${changedSeverities.length} changed from defaults)`)
        for (const [name, severity] of changedSeverities) {
          yield* Console.log(`    - ${name}: ${severity}`)
        }
      }

      yield* Console.log("")

      const shouldProceed = yield* Prompt.confirm({
        message: "Apply all changes?",
        initial: true
      })

      if (!shouldProceed) {
        yield* Console.log("Setup cancelled. No changes were made.")
        return
      }

      // Phase 4: Application (Placeholder - would implement JSON modification here)
      yield* Console.log("")
      yield* Console.log("⚠️  Application phase not yet implemented")
      yield* Console.log("In a full implementation, this would modify:")
      if (shouldInstallLsp || shouldAddPrepareScript) {
        yield* Console.log(`  - ${pkgJson.path}`)
      }
      yield* Console.log(`  - ${selectedTsconfig}`)
      yield* Console.log("")
      yield* Console.log("📝 Configuration captured:")
      yield* Console.log(`  - Install LSP: ${shouldInstallLsp}`)
      yield* Console.log(`  - Add prepare script: ${shouldAddPrepareScript}`)
      yield* Console.log(`  - Add LSP plugin to tsconfig: ${shouldAddLspPlugin}`)
      yield* Console.log(`  - Diagnostic severities: ${Object.keys(configuredSeverities).length} configured`)
    })
)
