#!/usr/bin/env node

import * as Command from "@effect/cli/Command"
import * as NodeContext from "@effect/platform-node/NodeContext"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import packageJson from "../package.json"
import { check } from "./cli/check"
import { codegen } from "./cli/codegen"
import { diagnostics } from "./cli/diagnostics"
import { layerInfo } from "./cli/layerinfo"
import { overview } from "./cli/overview"
import { patch } from "./cli/patch"
import { setup } from "./cli/setup"
import { unpatch } from "./cli/unpatch"
import { TypeScriptContext } from "./cli/utils"

const cliCommand = Command.make(
  "effect-language-service",
  {},
  () => Console.log("Please select a command or run --help.")
).pipe(Command.withSubcommands([setup, patch, unpatch, check, diagnostics, codegen, overview, layerInfo]))

const main = Command.run(cliCommand, {
  name: "effect-language-service",
  version: packageJson.version
})

const cliLayers = Layer.merge(NodeContext.layer, TypeScriptContext.live(process.cwd()))

main(process.argv).pipe(
  Effect.provide(cliLayers),
  NodeRuntime.runMain({
    disableErrorReporting: false
  })
)
