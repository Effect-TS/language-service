import * as path from "node:path"
import { describe, expect, it } from "vitest"
import { checkFile } from "../src/gen-block"

// Get TypeScript for testing
const getTypeScript = async () => {
  const ts = await import("typescript")
  return ts.default
}

describe("gen-block integration tests", () => {
  const examplesDir = path.resolve(__dirname, "../examples/gen-block")

  describe("basic.ts", () => {
    it("type-checks successfully with no errors", async () => {
      const ts = await getTypeScript()
      const result = checkFile(ts, path.join(examplesDir, "basic.ts"))

      // Filter out "Cannot find module" errors for now (effect not installed in examples)
      const realErrors = result.diagnostics.filter((d) => d.code !== 2307 && d.category === "error")

      expect(realErrors).toHaveLength(0)
      expect(result.genBlockFilesCount).toBe(1)
    })

    it("identifies file as gen-block file", async () => {
      const ts = await getTypeScript()
      const result = checkFile(ts, path.join(examplesDir, "basic.ts"))

      expect(result.genBlockFilesCount).toBe(1)
    })
  })

  describe("advanced.ts", () => {
    it("handles nested gen-blocks", async () => {
      const ts = await getTypeScript()
      const result = checkFile(ts, path.join(examplesDir, "advanced.ts"))

      // Filter out "Cannot find module" errors
      const realErrors = result.diagnostics.filter((d) => d.code !== 2307 && d.category === "error")

      expect(realErrors).toHaveLength(0)
      expect(result.genBlockFilesCount).toBe(1)
    })
  })

  describe("errors.ts", () => {
    it("detects type errors in gen-block code", async () => {
      const ts = await getTypeScript()
      const result = checkFile(ts, path.join(examplesDir, "errors.ts"))

      // Filter out "Cannot find module" errors
      const realErrors = result.diagnostics.filter((d) => d.code !== 2307 && d.category === "error")

      // Should have multiple type errors
      expect(realErrors.length).toBeGreaterThan(0)
    })

    it("reports errors with isGenBlockFile flag", async () => {
      const ts = await getTypeScript()
      const result = checkFile(ts, path.join(examplesDir, "errors.ts"))

      // All diagnostics from this file should be marked as gen-block
      for (const diagnostic of result.diagnostics) {
        expect(diagnostic.isGenBlockFile).toBe(true)
      }
    })

    it("includes TS2345 error for wrong argument type", async () => {
      const ts = await getTypeScript()
      const result = checkFile(ts, path.join(examplesDir, "errors.ts"))

      // Should have TS2345: Argument of type 'number' is not assignable
      const ts2345 = result.diagnostics.find((d) => d.code === 2345)
      expect(ts2345).toBeDefined()
      expect(ts2345?.message).toContain("not assignable")
    })
  })

  describe("transformer", () => {
    it("transforms gen-block to Effect.gen", async () => {
      const { transformSource } = await import("../src/gen-block/index.js")

      const source = `const x = gen { a <- foo(); return a }`
      const result = transformSource(source, "test.ts")

      expect(result.hasChanges).toBe(true)
      expect(result.code).toContain("Effect.gen")
      expect(result.code).toContain("function* ()")
      expect(result.code).toContain("yield*")
    })

    it("preserves source map for position tracking", async () => {
      const { transformSource } = await import("../src/gen-block/index.js")

      const source = `const x = gen { return 1 }`
      const result = transformSource(source, "test.ts")

      expect(result.map).not.toBeNull()
      expect(result.magicString).not.toBeNull()
    })
  })
})
