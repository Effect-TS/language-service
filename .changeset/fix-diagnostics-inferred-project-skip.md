---
"@effect/language-service": patch
---

Fix the `diagnostics` CLI command silently skipping files that the project service resolves to an inferred project.

The command read the plugin config per file from that file's program `compilerOptions` and skipped the file when no `@effect/language-service` plugin entry was found. Files assigned to an inferred project (common on a `moduleResolution: bundler` project that remaps `effect` through `paths`, or one whose `include` pulls in external files) carry no plugins entry, so they were dropped. This produced summaries like `Checked 3 files out of 27` even though `overview` processed all 27 with the same per-file machinery.

The command now falls back to the plugin config parsed once from the `--project` tsconfig, and finally to a bare default, so every file with a source file is checked and the file's own `diagnosticSeverity` is still honored when present.
