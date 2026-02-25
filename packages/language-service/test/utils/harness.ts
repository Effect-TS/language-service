import * as fs from "fs"
import * as path from "path"

/**
 * Gets the harness version from the EFFECT_HARNESS_VERSION environment variable.
 * Defaults to "v3" if not set.
 */
export function getHarnessVersion(): "v3" | "v4" {
  const version = process.env.EFFECT_HARNESS_VERSION
  if (version === "v3" || version === "v4") {
    return version
  }
  return "v3"
}

export function getHarnessDirForVersion(version: "v3" | "v4"): string {
  return path.join(__dirname, "..", "..", "..", `harness-effect-${version}`)
}

/**
 * Gets the root directory for the current harness package.
 * Returns the absolute path to packages/harness-effect-{version}/
 */
export function getHarnessDir(): string {
  return getHarnessDirForVersion(getHarnessVersion())
}

export function getExamplesDirForVersion(version: "v3" | "v4"): string {
  return path.join(getHarnessDirForVersion(version), "examples")
}

/**
 * Gets the examples directory for the current harness.
 * Returns the absolute path to packages/harness-effect-{version}/examples/
 */
export function getExamplesDir(): string {
  return getExamplesDirForVersion(getHarnessVersion())
}

/**
 * Gets a specific examples subdirectory for the current harness.
 * Example: getExamplesSubdir("diagnostics") -> packages/harness-effect-{version}/examples/diagnostics/
 */
export function getExamplesSubdir(subdir: string): string {
  return path.join(getExamplesDir(), subdir)
}

/**
 * Gets the __snapshots__ directory for the current harness.
 * Returns the absolute path to packages/harness-effect-{version}/__snapshots__/
 */
export function getSnapshotsDir(): string {
  return path.join(getHarnessDir(), "__snapshots__")
}

/**
 * Gets a specific snapshots subdirectory for the current harness.
 * Example: getSnapshotsSubdir("diagnostics") -> packages/harness-effect-{version}/__snapshots__/diagnostics/
 */
export function getSnapshotsSubdir(subdir: string): string {
  return path.join(getSnapshotsDir(), subdir)
}

/**
 * Safely reads a directory, returning an empty array if it doesn't exist.
 * This allows tests to skip gracefully when a harness directory is missing.
 * Filters out placeholder files like .gitkeep.
 */
export function safeReaddirSync(dir: string): Array<string> {
  try {
    return fs.readdirSync(dir).filter((file) => !file.startsWith("."))
  } catch {
    return []
  }
}
