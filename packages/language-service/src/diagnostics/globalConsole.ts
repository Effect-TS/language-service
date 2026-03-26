import * as LSP from "../core/LSP.js"
import { makeGlobalConsoleApply } from "./globalConsoleInEffect.js"

export const globalConsole = LSP.createDiagnostic({
  name: "globalConsole",
  code: 60,
  description: "Warns when using console methods outside Effect generators instead of Effect.log/Logger",
  group: "effectNative",
  severity: "off",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: makeGlobalConsoleApply(false)
})
