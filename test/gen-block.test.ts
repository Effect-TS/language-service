import { describe, expect, it } from "vitest"
import { findGenBlocks, hasGenBlocks, transformBlockContent, transformSource } from "../src/gen-block"

describe("gen-block scanner", () => {
  describe("hasGenBlocks", () => {
    it("returns true for source with gen blocks", () => {
      expect(hasGenBlocks("const x = gen { a <- foo() }")).toBe(true)
    })

    it("returns false for source without gen blocks", () => {
      expect(hasGenBlocks("const x = Effect.gen(function* () {})")).toBe(false)
    })

    it("returns false for 'gen' not followed by brace", () => {
      expect(hasGenBlocks("const gen = 1")).toBe(false)
    })
  })

  describe("findGenBlocks", () => {
    it("finds a simple gen block", () => {
      const source = "const x = gen { return 1 }"
      const blocks = findGenBlocks(source)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].content).toBe(" return 1 ")
    })

    it("finds multiple gen blocks", () => {
      const source = "const a = gen { return 1 }; const b = gen { return 2 }"
      const blocks = findGenBlocks(source)
      expect(blocks).toHaveLength(2)
    })

    it("handles nested braces", () => {
      const source = "const x = gen { const obj = { a: 1 }; return obj }"
      const blocks = findGenBlocks(source)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].content).toContain("{ a: 1 }")
    })

    it("ignores gen in strings", () => {
      const source = "const s = \"gen { not a block }\""
      const blocks = findGenBlocks(source)
      expect(blocks).toHaveLength(0)
    })

    it("ignores gen in comments", () => {
      const source = "// gen { not a block }\nconst x = 1"
      const blocks = findGenBlocks(source)
      expect(blocks).toHaveLength(0)
    })
  })

  describe("transformBlockContent", () => {
    it("transforms bind arrows to yield*", () => {
      const input = "  user <- getUser(id)"
      const output = transformBlockContent(input)
      expect(output).toBe("  const user = yield* getUser(id)")
    })

    it("preserves let declarations", () => {
      const input = "  let name = user.name"
      const output = transformBlockContent(input)
      expect(output).toBe("  let name = user.name")
    })

    it("preserves const declarations", () => {
      const input = "  const name = user.name"
      const output = transformBlockContent(input)
      expect(output).toBe("  const name = user.name")
    })

    it("handles multiple statements", () => {
      const input = `
  user <- getUser(id)
  let name = user.name
  return { user, name }
`
      const output = transformBlockContent(input)
      expect(output).toContain("const user = yield* getUser(id)")
      expect(output).toContain("let name = user.name")
      expect(output).toContain("return { user, name }")
    })

    it("preserves semicolons", () => {
      const input = "  user <- getUser(id);"
      const output = transformBlockContent(input)
      expect(output).toBe("  const user = yield* getUser(id);")
    })
  })

  describe("transformSource", () => {
    it("transforms a simple gen block", () => {
      const source = `const program = gen {
  user <- getUser(id)
  return user
}`
      const result = transformSource(source, "test.ts")
      expect(result.hasChanges).toBe(true)
      expect(result.code).toContain("Effect.gen(/* __EFFECT_SUGAR__ */ function* ()")
      expect(result.code).toContain("const user = yield* getUser(id)")
    })

    it("returns unchanged source when no gen blocks", () => {
      const source = "const x = 1"
      const result = transformSource(source, "test.ts")
      expect(result.hasChanges).toBe(false)
      expect(result.code).toBe(source)
    })

    it("generates source map when transforming", () => {
      const source = "const x = gen { return 1 }"
      const result = transformSource(source, "test.ts")
      expect(result.map).not.toBeNull()
      expect(result.map?.sources).toContain("test.ts")
    })

    it("preserves MagicString instance for position mapping", () => {
      const source = "const x = gen { return 1 }"
      const result = transformSource(source, "test.ts")
      expect(result.magicString).not.toBeNull()
    })
  })
})

describe("gen-block type-checker", () => {
  // Note: These tests would require TypeScript to be available
  // and are more integration-level tests

  it("creates a transforming compiler host", async () => {
    // This is a basic sanity check - full integration tests
    // would be in a separate test file with TypeScript setup
    const { createTransformingCompilerHost } = await import("../src/gen-block/type-checker.js")
    expect(typeof createTransformingCompilerHost).toBe("function")
  })

  it("exports checkProject function", async () => {
    const { checkProject } = await import("../src/gen-block/type-checker.js")
    expect(typeof checkProject).toBe("function")
  })

  it("exports checkFile function", async () => {
    const { checkFile } = await import("../src/gen-block/type-checker.js")
    expect(typeof checkFile).toBe("function")
  })
})
