#!/usr/bin/env node

import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Command } from "effect/unstable/cli"
import packageJson from "../package.json"
import { check } from "./cli/check"
import { codegen } from "./cli/codegen"
import { diagnostics } from "./cli/diagnostics"
import { layerInfo } from "./cli/layerinfo"
import { overview } from "./cli/overview"
import { patch } from "./cli/patch"
import { quickfixes } from "./cli/quickfixes"
import { setup } from "./cli/setup"
import { unpatch } from "./cli/unpatch"
import { TypeScriptContext } from "./cli/utils"

const cliCommand = Command.make(
  "effect-language-service",
  {},
  () => Console.log("Please select a command or run --help.")
).pipe(Command.withSubcommands([setup, patch, unpatch, check, diagnostics, quickfixes, codegen, overview, layerInfo]))

const main = Command.run(cliCommand, {
  version: packageJson.version
})

const cliLayers = Layer.merge(NodeServices.layer, TypeScriptContext.live(process.cwd()))

NodeRuntime.runMain(
  main.pipe(Effect.provide(cliLayers)),
  { disableErrorReporting: false }
)
