// @effect-diagnostics nodeBuiltinImport:warning
import { pipe } from "effect"

// Flagged: ES module imports for covered modules
import fs from "fs"
import * as fs2 from "node:fs"
import { readFile } from "fs/promises"
import { readFile as readFile2 } from "node:fs/promises"
import { join } from "path"
import path from "node:path"
import { join as join2 } from "path/posix"
import { exec } from "child_process"
import { spawn } from "node:child_process"
import http from "http"
import https from "node:https"

// Flagged: side-effect import
import "node:fs"

// Flagged: top-level require
const fs3 = require("node:fs")

// Not flagged: Effect-native imports
// @ts-expect-error - @effect/platform not installed in harness
import { FileSystem } from "@effect/platform"

// Not flagged: third-party modules with similar names
// @ts-expect-error - fs-extra not installed in harness
import fsExtra from "fs-extra"
