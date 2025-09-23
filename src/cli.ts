#!/usr/bin/env node

import * as Command from "@effect/cli/Command"
import * as NodeContext from "@effect/platform-node/NodeContext"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import { check } from "./cli/check"
import { mcp } from "./cli/mcp"
import { patch } from "./cli/patch"
import { unpatch } from "./cli/unpatch"

const cliCommand = Command.make(
  "effect-language-service",
  {},
  () => Console.log("Please select a command or run --help.")
).pipe(Command.withSubcommands([patch, unpatch, check, mcp]))

const main = Command.run(cliCommand, {
  name: "effect-language-service",
  version: "0.0.2"
})

main(process.argv).pipe(
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain({
    disableErrorReporting: false
  })
)
