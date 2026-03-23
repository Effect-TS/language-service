import { describe, expect, it } from "vitest"
import {
  applyPresetDiagnosticSeverities,
  compareRuleSeverity,
  isPresetEnabled,
  mergePresetDiagnosticSeverities,
  presets
} from "../src/presets"

describe("diagnostic presets", () => {
  it("merges the selected preset severities", () => {
    expect(mergePresetDiagnosticSeverities(["effect-native"])).toEqual(
      presets.find((preset) => preset.name === "effect-native")!.diagnosticSeverity
    )
  })

  it("applies preset severities as minimums on top of existing config", () => {
    const merged = applyPresetDiagnosticSeverities(
      {
        globalFetch: "error"
      },
      ["effect-native"]
    )

    expect(merged.globalFetch).toBe("error")
    expect(merged.extendsNativeError).toBe("warning")
    expect(merged.preferSchemaOverJson).toBe("warning")
  })

  it("normalizes existing diagnostic keys before applying presets", () => {
    const merged = applyPresetDiagnosticSeverities(
      {
        globalfetch: "error"
      },
      ["effect-native"]
    )

    expect(merged.globalFetch).toBe("error")
    expect(merged.globalfetch).toBeUndefined()
  })

  it("computes enablement using effective severities", () => {
    const merged = applyPresetDiagnosticSeverities({}, ["effect-native"])

    expect(isPresetEnabled("effect-native", merged)).toBe(true)
    expect(compareRuleSeverity(merged.globalFetch!, "warning")).toBeGreaterThanOrEqual(0)
  })
})
