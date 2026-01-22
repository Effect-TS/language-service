import * as path from "path"
import { defineConfig } from "vitest/config"

function getHarnessVersion(): "v3" | "v4" {
  const version = process.env.EFFECT_HARNESS_VERSION
  if (version === "v3" || version === "v4") {
    return version
  }
  return "v3"
}

export default defineConfig({
  test: {
    include: ["test/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    resolveSnapshotPath: (testPath, snapshotExtension) => {
      const version = getHarnessVersion()
      const testFileName = path.basename(testPath)
      return path.join(
        __dirname,
        "..",
        `harness-effect-${version}`,
        "__snapshots__",
        testFileName + snapshotExtension
      )
    },
    testTimeout: 10000
  },
  resolve: {
    alias: {
      "@effect/language-service/test": path.join(__dirname, "test"),
      "@effect/language-service": path.join(__dirname, "src")
    }
  }
})
