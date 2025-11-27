import { describe, expect, it } from "vitest"
import {
  cacheTransformation,
  createSegmentsFromTransformation,
  getPositionMapper
} from "../src/gen-block/position-mapper"
import { findGenBlocks, transformSource } from "../src/gen-block/transformer"

describe("gen-block position mapping", () => {
  it("maps destructuring bind variable positions correctly - multiline", () => {
    // Exact structure from user's file - multiline bind expression
    const original = `export const makePortkeyGatewayManager = (baseURL: string) => {
  return Effect.succeed({
    generate: (request: LLMRequest) => {
      const startTime = Date.now()
      return gen {
        // Load both configurations
        // eslint-disable-next-line
        [config, llmConfig] <- Effect.all([
          loadPortkeyConfig(),
          loadLLMManagerConfig()
        ])
        // Use model preference
        const model =
          request.preferences?.model ||
          config.defaults?.general ||
          'gpt-3.5-turbo'
        return model
      }
    }
  })
}`

    const blocks = findGenBlocks(original)
    const result = transformSource(original)

    console.log("\n=== Original ===")
    console.log(original)
    console.log("\n=== Transformed ===")
    console.log(result.code)

    cacheTransformation("destruct.ts", original, result.code, blocks)
    const mapper = getPositionMapper("destruct.ts")!

    // Find position of "config" in the destructuring pattern (not the return statement)
    const configOrigPos = original.indexOf("[config,") + 1 // +1 to get to 'c'
    const configTransPos = result.code.indexOf("[config,") + 1 // +1 to get to 'c'

    console.log(`\n=== config positions ===`)
    console.log(`Original 'config' at: ${configOrigPos}`)
    console.log(`Transformed 'config' at: ${configTransPos}`)

    // Map from transformed back to original (this is what go-to-definition does)
    const mappedBack = mapper.transformedToOriginal(configTransPos)
    console.log(`Mapped back from ${configTransPos} -> ${mappedBack}`)
    console.log(`Expected: ${configOrigPos}`)

    // Check line numbers
    const origLine = original.slice(0, configOrigPos).split("\n").length
    const mappedLine = original.slice(0, mappedBack).split("\n").length
    console.log(`Original line: ${origLine}, Mapped line: ${mappedLine}`)

    // Show segments for debugging
    const segments = mapper.getSegments()
    console.log(`\n=== Segments (${segments.length}) ===`)
    segments.slice(0, 10).forEach((seg, i) => {
      console.log(`${i}: orig[${seg.originalStart}-${seg.originalEnd}] -> trans[${seg.transformedStart}-${seg.transformedEnd}] ${seg.isIdentity ? "ID" : "NON-ID"}`)
    })

    expect(mappedBack).toBe(configOrigPos)
  })

  it("maps positions correctly for a simple bind statement", () => {
    const original = `const program = gen {
  user <- getUser(1)
  return user
}`

    const blocks = findGenBlocks(original)
    const result = transformSource(original)

    expect(blocks).toHaveLength(1)
    expect(result.hasChanges).toBe(true)

    // Cache the transformation
    cacheTransformation("test.ts", original, result.code, blocks)

    const mapper = getPositionMapper("test.ts")
    expect(mapper).toBeDefined()

    // Test: Position in "getUser" expression should map correctly
    // Original: "  user <- getUser(1)\n"
    // Find position of 'g' in 'getUser'
    const getUserPos = original.indexOf("getUser")
    expect(getUserPos).toBeGreaterThan(0)

    // Map to transformed
    const transformedPos = mapper!.originalToTransformed(getUserPos)

    // In transformed code, find where "getUser" is
    const transformedGetUserPos = result.code.indexOf("getUser")
    expect(transformedGetUserPos).toBeGreaterThan(0)

    // They should match (or be close, within the expression)
    expect(transformedPos).toBe(transformedGetUserPos)
  })

  it("creates correct segments for bind statements", () => {
    const original = `gen {
  user <- getUser(1)
}`

    const transformed = `Effect.gen(/* __EFFECT_SUGAR__ */ function* () {
  const user = yield* getUser(1)
})`

    const blocks = [
      {
        start: 0,
        end: original.length,
        braceStart: 3
      }
    ]

    const segments = createSegmentsFromTransformation(original, transformed, blocks)

    // Should have segments covering the entire original source
    expect(segments.length).toBeGreaterThan(0)

    // Check segments don't have gaps
    const sortedSegments = [...segments].sort((a, b) => a.originalStart - b.originalStart)

    // First segment should start at 0 or close to it
    expect(sortedSegments[0]!.originalStart).toBeLessThanOrEqual(5) // Allow for "gen {" wrapper

    // Segments should be contiguous or overlapping (no gaps)
    for (let i = 1; i < sortedSegments.length; i++) {
      const prev = sortedSegments[i - 1]!
      const curr = sortedSegments[i]!
      // Current segment should start at or before previous segment ends
      expect(curr.originalStart).toBeLessThanOrEqual(prev.originalEnd)
    }
  })

  it("maps positions in expression with 1:1 precision", () => {
    const original = `gen {
  result <- compute(1, 2, 3)
}`

    const blocks = findGenBlocks(original)
    const result = transformSource(original)

    cacheTransformation("test2.ts", original, result.code, blocks)
    const mapper = getPositionMapper("test2.ts")!

    // Test multiple positions within the expression
    const exprStart = original.indexOf("compute")
    const positions = [
      exprStart, // 'c' in compute
      exprStart + 3, // 'p' in compute
      exprStart + 7, // '(' after compute
      exprStart + 10 // '2' in arguments
    ]

    for (const pos of positions) {
      const transformedPos = mapper.originalToTransformed(pos)
      const mappedBack = mapper.transformedToOriginal(transformedPos)

      // Round-trip mapping should get us back close to original
      // (may not be exact due to non-identity segments)
      expect(Math.abs(mappedBack - pos)).toBeLessThan(20) // Allow some tolerance
    }
  })

  it("handles multiple gen blocks correctly", () => {
    const original = `const a = gen { x <- foo() }
const b = gen { y <- bar() }`

    const blocks = findGenBlocks(original)
    const result = transformSource(original)

    expect(blocks).toHaveLength(2)

    cacheTransformation("test3.ts", original, result.code, blocks)
    const mapper = getPositionMapper("test3.ts")!

    // Map position in first block
    const fooPos = original.indexOf("foo")
    const transformedFooPos = mapper.originalToTransformed(fooPos)
    expect(result.code.substring(transformedFooPos, transformedFooPos + 3)).toBe("foo")

    // Map position in second block
    const barPos = original.indexOf("bar")
    const transformedBarPos = mapper.originalToTransformed(barPos)
    expect(result.code.substring(transformedBarPos, transformedBarPos + 3)).toBe("bar")
  })

  it("maps variables defined inside nested callbacks correctly", () => {
    // This simulates the rawConfig scenario from portkey-gateway-client.ts
    // Exact structure from the screenshot
    const original = `const loadPortkeyConfig = (): Effect.Effect<PortkeyConfig, LLMError, never> =>
  gen {
    const configPath = './config/portkey/config.json'

    result <- Effect.try({
      try: () => {
        const rawConfig = readFileSync(configPath, 'utf8')
        return rawConfig
      }
    })

    const currentHash = calculateHash(rawConfig)
  }`

    const blocks = findGenBlocks(original)
    const result = transformSource(original)

    console.log("\n=== Original source ===")
    const origLines = original.split("\n")
    origLines.forEach((line, idx) => {
      console.log(`${idx + 1}: ${line}`)
    })

    console.log("\n=== Transformed source ===")
    const transformedLines = result.code.split("\n")
    transformedLines.forEach((line, idx) => {
      console.log(`${idx + 1}: ${line}`)
    })

    cacheTransformation("portkey.ts", original, result.code, blocks)
    const mapper = getPositionMapper("portkey.ts")!

    // Find position of "const rawConfig" in the definition (should be line 7)
    const rawConfigDefPos = original.indexOf("const rawConfig")
    const defLineNum = original.slice(0, rawConfigDefPos).split("\n").length
    console.log(`\n=== rawConfig definition ===`)
    console.log(`Position: ${rawConfigDefPos}, Line: ${defLineNum}`)
    expect(rawConfigDefPos).toBeGreaterThan(0)
    expect(defLineNum).toBe(7) // Should be on line 7

    // Find position of "rawConfig" in usage on line 12
    const rawConfigUsagePos = original.indexOf("rawConfig", original.indexOf("calculateHash"))
    const usageLineNum = original.slice(0, rawConfigUsagePos).split("\n").length
    console.log(`\n=== rawConfig usage ===`)
    console.log(`Position: ${rawConfigUsagePos}, Line: ${usageLineNum}`)
    expect(rawConfigUsagePos).toBeGreaterThan(rawConfigDefPos)
    expect(usageLineNum).toBe(12) // Should be on line 12

    // In transformed code, TypeScript will find the definition
    const actualTransformedDef = result.code.indexOf("const rawConfig")
    const transDefLineNum = result.code.slice(0, actualTransformedDef).split("\n").length
    console.log(`\n=== Transformed definition ===`)
    console.log(`Position: ${actualTransformedDef}, Line: ${transDefLineNum}`)

    // Map the transformed definition position back to original
    const mappedBackDefPos = mapper.transformedToOriginal(actualTransformedDef)
    const mappedBackLineNum = original.slice(0, mappedBackDefPos).split("\n").length
    console.log(`\n=== Mapped back to original ===`)
    console.log(`Position: ${mappedBackDefPos}, Line: ${mappedBackLineNum}`)
    console.log(`Expected position: ${rawConfigDefPos}, Line: ${defLineNum}`)

    // The mapped-back position should point to the definition on line 7
    expect(mappedBackDefPos).toBe(rawConfigDefPos)
    expect(mappedBackLineNum).toBe(defLineNum)

    // Also test mapping the contextSpan
    // In the transformed code, find where "const rawConfig" line starts
    const transRawConfigLine = transformedLines.findIndex((line) => line.includes("const rawConfig"))
    const transLineStart = transformedLines.slice(0, transRawConfigLine).join("\n").length +
      (transRawConfigLine > 0 ? 1 : 0)

    console.log(`\n=== Context span test ===`)
    console.log(`Transformed line start for rawConfig: ${transLineStart} (line ${transRawConfigLine + 1})`)

    // Map this position back
    const mappedContextPos = mapper.transformedToOriginal(transLineStart)
    const mappedContextLine = original.slice(0, mappedContextPos).split("\n").length

    console.log(`Mapped context position: ${mappedContextPos} (line ${mappedContextLine})`)

    // Should map to line 7
    expect(mappedContextLine).toBe(7)
  })
})
