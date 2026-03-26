import * as LSP from "../core/LSP.js"
import { makeGlobalTimersApply } from "./globalTimersInEffect.js"

export const globalTimers = LSP.createDiagnostic({
  name: "globalTimers",
  code: 62,
  description: "Warns when using setTimeout/setInterval outside Effect generators instead of Effect.sleep/Schedule",
  group: "effectNative",
  severity: "off",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: makeGlobalTimersApply(false)
})
