# language-service

This package implements a TypeScript language service plugin that allows additional refactors and diagnostics with your VSCode editor (or any editor that supports TypeScript's LSP).

## Installation

1. `npm install @effect/language-service --save-dev` in your project
   - For monorepos: We suggest installing `@effect/language-service` in the monorepo root and configuring it in the root `tsconfig.json` for consistent behavior across all packages
   - For any other package: Install directly in the package where you want to use it
2. Inside your tsconfig.json, you should add the plugin configuration as follows:
```jsonc
{
  "compilerOptions": {
    "plugins": [
      // ... other LSPs (if any) and as last
      {
        "name": "@effect/language-service"
      }
    ]
  }
}
```

3. Ensure that you have installed TypeScript locally in your project and set your editor to use your workspace TypeScript version.

   - In VSCode you can do this by pressing "F1" and typing "TypeScript: Select TypeScript version". Then select "Use workspace version". If that option does not appear, TypeScript is not installed locally in your node_modules.
       - Not required, but to remember the user to do so, you can update your `.vscode/settings.json`
         ```jsonc
         {
           "typescript.tsdk": "./node_modules/typescript/lib",
           "typescript.enablePromptUseWorkspaceTsdk": true
         }
         ```
   - In JetBrains you may have to disable the Vue language service, and choose the workspace version of TypeScript in the settings from the dropdown.
   - In NVim with nvim-vtsls you should refer to [how to enable TypeScript plugins in vtsls](https://github.com/yioneko/vtsls?tab=readme-ov-file#typescript-plugin-not-activated)
   - In Emacs, additional steps are required to enable LSPs, [step by step instructions can be found here](https://gosha.net/2025/effect-ls-emacs/)

And you're done! You'll now be able to use a set of refactors and diagnostics that target Effect!

## Provided functionalities

### Diagnostics

<!-- diagnostics-table:start -->
| Diagnostic | Sev | Fix | Description | v3 | v4 |
| --- | --- | --- | --- | --- | --- |
| `anyUnknownInErrorContext` | ➖ |  | Detects 'any' or 'unknown' types in Effect error or requirements channels | ✓ | ✓ |
| `catchAllToMapError` | 💡 | 🔧 | Suggests using Effect.mapError instead of Effect.catchAll when the callback only wraps the error with Effect.fail | ✓ | ✓ |
| `catchUnfailableEffect` | 💡 |  | Warns when using error handling on Effects that never fail (error type is 'never') | ✓ | ✓ |
| `classSelfMismatch` | ❌ | 🔧 | Ensures Self type parameter matches the class name in Service/Tag/Schema classes | ✓ | ✓ |
| `deterministicKeys` | ➖ | 🔧 | Enforces deterministic naming for service/tag/error identifiers based on class names | ✓ | ✓ |
| `duplicatePackage` | ⚠️ |  | Detects when multiple versions of the same Effect package are loaded | ✓ | ✓ |
| `effectFnIife` | ⚠️ | 🔧 | Effect.fn or Effect.fnUntraced is called as an IIFE (Immediately Invoked Function Expression). Use Effect.gen instead. | ✓ | ✓ |
| `effectFnOpportunity` | 💡 | 🔧 | Suggests using Effect.fn for functions that returns an Effect | ✓ | ✓ |
| `effectGenUsesAdapter` | ⚠️ |  | Warns when using the deprecated adapter parameter in Effect.gen | ✓ | ✓ |
| `effectInFailure` | ⚠️ |  | Warns when an Effect is used inside an Effect failure channel | ✓ | ✓ |
| `effectInVoidSuccess` | ⚠️ |  | Detects nested Effects in void success channels that may cause unexecuted effects | ✓ | ✓ |
| `effectMapVoid` | 💡 | 🔧 | Suggests using Effect.asVoid instead of Effect.map(() => void 0), Effect.map(() => undefined), or Effect.map(() => {}) | ✓ | ✓ |
| `effectSucceedWithVoid` | 💡 | 🔧 | Suggests using Effect.void instead of Effect.succeed(undefined) or Effect.succeed(void 0) | ✓ | ✓ |
| `extendsNativeError` | ➖ |  | Warns when a class directly extends the native Error class | ✓ | ✓ |
| `floatingEffect` | ❌ |  | Ensures Effects are yielded or assigned to variables, not left floating | ✓ | ✓ |
| `genericEffectServices` | ⚠️ |  | Prevents services with type parameters that cannot be discriminated at runtime | ✓ | ✓ |
| `globalErrorInEffectCatch` | ⚠️ |  | Warns when catch callbacks return global Error type instead of typed errors | ✓ | ✓ |
| `globalErrorInEffectFailure` | ⚠️ |  | Warns when the global Error type is used in an Effect failure channel | ✓ | ✓ |
| `importFromBarrel` | ➖ | 🔧 | Suggests importing from specific module paths instead of barrel exports | ✓ | ✓ |
| `instanceOfSchema` | ➖ | 🔧 | Suggests using Schema.is instead of instanceof for Effect Schema types | ✓ | ✓ |
| `layerMergeAllWithDependencies` | ⚠️ | 🔧 | Detects interdependencies in Layer.mergeAll calls where one layer provides a service that another layer requires | ✓ | ✓ |
| `leakingRequirements` | 💡 |  | Detects implementation services leaked in service methods | ✓ | ✓ |
| `missedPipeableOpportunity` | ➖ | 🔧 | Enforces the use of pipeable style for nested function calls | ✓ | ✓ |
| `missingEffectContext` | ❌ |  | Reports missing service requirements in Effect context channel | ✓ | ✓ |
| `missingEffectError` | ❌ | 🔧 | Reports missing error types in Effect error channel | ✓ | ✓ |
| `missingEffectServiceDependency` | ➖ |  | Checks that Effect.Service dependencies satisfy all required layer inputs | ✓ |  |
| `missingLayerContext` | ❌ |  | Reports missing service requirements in Layer context channel | ✓ | ✓ |
| `missingReturnYieldStar` | ❌ | 🔧 | Suggests using 'return yield*' for Effects with never success for better type narrowing | ✓ | ✓ |
| `missingStarInYieldEffectGen` | ❌ | 🔧 | Enforces using 'yield*' instead of 'yield' when yielding Effects in generators | ✓ | ✓ |
| `multipleEffectProvide` | ⚠️ | 🔧 | Warns against chaining Effect.provide calls which can cause service lifecycle issues | ✓ | ✓ |
| `nodeBuiltinImport` | ➖ |  | Warns when importing Node.js built-in modules that have Effect-native counterparts | ✓ | ✓ |
| `nonObjectEffectServiceType` | ❌ |  | Ensures Effect.Service types are objects, not primitives | ✓ |  |
| `outdatedApi` | ⚠️ |  | Detects usage of APIs that have been removed or renamed in Effect v4 |  | ✓ |
| `outdatedEffectCodegen` | ⚠️ | 🔧 | Detects when generated code is outdated and needs to be regenerated | ✓ | ✓ |
| `overriddenSchemaConstructor` | ❌ | 🔧 | Prevents overriding constructors in Schema classes which breaks decoding behavior | ✓ | ✓ |
| `preferSchemaOverJson` | 💡 |  | Suggests using Effect Schema for JSON operations instead of JSON.parse/JSON.stringify which may throw | ✓ | ✓ |
| `redundantSchemaTagIdentifier` | 💡 | 🔧 | Suggests removing redundant identifier argument when it equals the tag value in Schema.TaggedClass/TaggedError/TaggedRequest | ✓ | ✓ |
| `returnEffectInGen` | 💡 | 🔧 | Warns when returning an Effect in a generator causes nested Effect<Effect<...>> | ✓ | ✓ |
| `runEffectInsideEffect` | 💡 | 🔧 | Suggests using Runtime methods instead of Effect.run* inside Effect contexts | ✓ |  |
| `schemaStructWithTag` | 💡 | 🔧 | Suggests using Schema.TaggedStruct instead of Schema.Struct with _tag field | ✓ | ✓ |
| `schemaSyncInEffect` | 💡 |  | Suggests using Effect-based Schema methods instead of sync methods inside Effect generators | ✓ | ✓ |
| `schemaUnionOfLiterals` | ➖ | 🔧 | Simplifies Schema.Union of multiple Schema.Literal calls into single Schema.Literal | ✓ |  |
| `scopeInLayerEffect` | ⚠️ | 🔧 | Suggests using Layer.scoped instead of Layer.effect when Scope is in requirements | ✓ |  |
| `serviceNotAsClass` | ➖ | 🔧 | Warns when ServiceMap.Service is used as a variable instead of a class declaration |  | ✓ |
| `strictBooleanExpressions` | ➖ |  | Enforces boolean types in conditional expressions for type safety | ✓ | ✓ |
| `strictEffectProvide` | ➖ |  | Warns when using Effect.provide with layers outside of application entry points | ✓ | ✓ |
| `tryCatchInEffectGen` | 💡 |  | Discourages try/catch in Effect generators in favor of Effect error handling | ✓ | ✓ |
| `unknownInEffectCatch` | ⚠️ |  | Warns when catch callbacks return unknown instead of typed errors | ✓ | ✓ |
| `unnecessaryEffectGen` | 💡 | 🔧 | Suggests removing Effect.gen when it contains only a single return statement | ✓ | ✓ |
| `unnecessaryFailYieldableError` | 💡 | 🔧 | Suggests yielding yieldable errors directly instead of wrapping with Effect.fail | ✓ | ✓ |
| `unnecessaryPipe` | 💡 | 🔧 | Removes pipe calls with no arguments | ✓ | ✓ |
| `unnecessaryPipeChain` | 💡 | 🔧 | Simplifies chained pipe calls into a single pipe call | ✓ | ✓ |
| `unsupportedServiceAccessors` | ⚠️ | 🔧 | Warns about service accessors that need codegen due to generic/complex signatures | ✓ | ✓ |

`➖` off by default, `❌` error, `⚠️` warning, `💬` message, `💡` suggestion, `🔧` quick fix available
<!-- diagnostics-table:end -->

### Quickinfo

- Show the extended type of the current Effect
- Hovering `yield*` of `Effect.gen` will show the Effect type parameters
- Hovering a variable assignment of a type Layer, will show info on how each service got involved
- Hovering a layer, will attempt to produce a graph

### Completions

- Autocomplete 'Self' in `Effect.Service`, `Context.Tag`, `Schema.TaggedClass`, `Schema.TaggedRequest`, `ServiceMap.Service`, `Model.Class` and family
- Autocomplete `Effect.gen` with `function*(){}`
- Autocomplete `Effect.fn` with the span name given by the exported member
- Completions for DurationInput string millis/seconds/etc...
- Allow to configure packages to be imported with namespace style `import * as Effect from "effect"`
- Suggest brand when using `Schema.brand`
- Effect comment directives

### Refactors

- Transform an async function definition, into an Effect by using Effect.gen.
- Transform an async function definition, into an Effect by using Effect.gen, and generating a tagged error for each promise call.
- Transform an async function definition, into an Effect by using Effect.fn.
- Transform an async function definition, into an Effect by using Effect.fn, and generating a tagged error for each promise call.
- Transform a function returning an Effect.gen into a Effect.fn
- Implement Service accessors in an `Effect.Service`, `Context.Tag` or `Effect.Tag` declaration
- Function calls to pipe: Transform a set of function calls to a pipe() call.
- Pipe to datafirst: Transform a pipe() call into a series of datafirst function calls (where available).
- Toggle return type signature: With a single refactor, adds or removes type annotations from the definition.
- Remove unnecessary `Effect.gen` definitions that contains a single `yield` statement.
- Wrap an `Effect` expression with `Effect.gen`
- Toggle between pipe styles `X.pipe(Y)` and `pipe(X, Y)`
- Layer Magic: Automatically compose and build layers based on service dependencies
- Structural Type to Schema: Convert TypeScript interfaces and type aliases to Effect Schema classes, with automatic detection and reuse of existing schemas
- Convert `Effect.Service` to `Context.Tag` with a static `Layer` property (supports `effect`, `scoped`, `sync`, `succeed` combinators and `dependencies`)

### Codegens

- Automatically adds type annotations to exported constants based on their initializer types using `// @effect-codegens annotate`
- Automatically implements service accessors in `Effect.Service`, `Context.Tag` or `Effect.Tag` declarations using `// @effect-codegens accessors`
- Automatically generates Effect Schema classes from TypeScript types using `// @effect-codegens typeToSchema`

### Miscellaneous
- Renaming a class name, will rename the identifier as well for TaggedError, TaggedClass, etc...
- "Go to definition" for RpcClient will resolve to the Rpc definition

## Options

Few options can be provided alongside the initialization of the Language Service Plugin.

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@effect/language-service",
        "refactors": true, // controls Effect refactors (default: true)
        "diagnostics": true, // controls Effect diagnostics (default: true)
        "diagnosticSeverity": { // allows to change per-rule default severity of the diagnostic in the whole project
          "floatingEffect": "warning" // example for a rule, allowed values are off,error,warning,message,suggestion
        },
        "diagnosticsName": true, // controls whether to include the rule name in diagnostic messages (default: true)
        "missingDiagnosticNextLine": "warning", // controls the severity of warnings for unused @effect-diagnostics-next-line comments (default: "warning", allowed values: off,error,warning,message,suggestion)
        "includeSuggestionsInTsc": true, // when enabled with effect-language-service patch enabled, diagnostics with "suggestion" severity will be reported as "message" in TSC with "[suggestion]" prefix; useful to help steer LLM output (default: true)
        "ignoreEffectWarningsInTscExitCode": false, // if set to true, effect-related warnings won't change the exit code of tsc, meaning that tsc will compile fine even if effect warnings are emitted (default: false)
        "ignoreEffectErrorsInTscExitCode": false, // if set to true, effect-related errors won't change the exit code of tsc (default: false)
        "ignoreEffectSuggestionsInTscExitCode": true, // if set to true, effect-related suggestions won't change the exit code of tsc (default: true)
        "skipDisabledOptimization": false, // if set to true, disabled diagnostics are still processed so per-line or per-section overrides can be honored in patched tsc runs (default: false)
        "quickinfo": true, // controls Effect quickinfo (default: true)
        "quickinfoEffectParameters": "whenTruncated", // (default: "whenTruncated") controls when to display effect type parameters always,never,whenTruncated
        "quickinfoMaximumLength": -1, // controls how long can be the types in the quickinfo hover (helps with very long type to improve perfs, defaults to -1 for no truncation, can be any number eg. 1000 and TS will try to fit as much as possible in that budget, higher number means more info.)
        "completions": true, // controls Effect completions (default: true)
        "goto": true, // controls Effect goto references (default: true)
        "inlays": true, // controls Effect provided inlayHints (default: true)
        "allowedDuplicatedPackages": [], // list of package names that have effect in peer dependencies and are allowed to be duplicated (default: [])
        "barrelImportPackages": [], // package names that should be preferred as imported from the top level barrel file (default: [])
        "namespaceImportPackages": [], // package names that should be preferred as imported with namespace imports e.g. ["effect", "@effect/*"] (default: [])
        "topLevelNamedReexports": "ignore", // for namespaceImportPackages, how should top level named re-exports (e.g. {pipe} from "effect") be treated? "ignore" will leave them as is, "follow" will rewrite them to the re-exported module (e.g. {pipe} from "effect/Function")
        "importAliases": { "Array": "Arr" }, // allows to chose some different names for import name aliases (only when not chosing to import the whole module) (default: {})
        "noExternal": false, // disables features that provides links to external websites (such as links to mermaidchart.com) (default: false)
        "keyPatterns": [{ "target": "service", "pattern": "default", "skipLeadingPath": ["src/"] }], // configure the key patterns; recommended reading more on the section "Configuring Key Patterns"
        "effectFn": ["span"], // what types of Effect.fn you want to get suggested, zero or multiple between "untraced" for fnUntraced, "span" for Effect.fn with explicit withSpan span, "suggested-span" for Effect.fn with a broadly suggested name from local context, "inferred-span" for Effect.fn with inferred exported declaration names, "no-span" for Effect.fn with no span (default: ["span"])
        "layerGraphFollowDepth": 0, // controls the depth level that the layer graph will follow when resolving layer dependencies, depth is counted only when exiting the currently hovered/analyzed layer definition (default: 0)
        "mermaidProvider": "mermaid.live" // which provider to use for mermaid, can also be a uri like http://localhost:8080 if running mermaid-live-editor locally.
      }
    ]
  }
}
```

### DiagnosticSeverty properties list

The full list can be found in the [diagnostics](https://github.com/Effect-TS/language-service/tree/main/src/diagnostics) folder.

## Why do diagnostics not appear at compile time?

TypeScript LSPs are loaded only while editing your files. That means that if you run `tsc` in your project, the plugin won't be loaded and you'll miss out on the Effect diagnostics.


To solve this we modify directly the source code of the tsc compiler and the typescript library in your project node_modules. This allows to get effect's diagnostics even when noEmit is enabled, for composite and incremental projects as well.

After having installed and configured the LSP for editor usage, you can run the following command inside the folder that contains your local project typescript installation:

`effect-language-service patch`

If everything goes smoothly, something along these lines should be printed out:

```
/node_modules/typescript/lib/typescript.js patched successfully.
/node_modules/typescript/lib/_tsc.js patched successfully.
```

Now the CLI has patched the tsc binary and the typescript library to raise Effect diagnostics even at build time if the plugin is configured in your tsconfig!

As the command output suggests, you may need to delete your tsbuildinfo files or perform a full rebuild in order to re-check previously existing files.

To make the patch persistent across package installations and updates, we recommend adding the patch command to your package.json prepare scripts:

```jsonc
  "scripts": {
    "prepare": "effect-language-service patch"
  }
```

so that across updates the patch will be re-applied again.

## Effect-Language-Service CLI

The effect language service plugin comes with a builtin CLI tool that can be used to perform various utilities, checks and setups. Since it relies on typescript, we recommend to install it locally and run it locally to ensure it loads the same typescript version of your project rather than a global installation that may resolve to use a different TS version from the one of your project.

### `effect-language-service setup`
Runs through a wizard to setup/update some basic functionalities of the LSP in an interactive way.

### `effect-language-service codegen`
Automatically updates Effect codegens in your TypeScript files. This command scans files for `@effect-codegens` directives and applies the necessary code transformations. Use `--file` to update a specific file, or `--project` with a tsconfig file to update an entire project. The `--verbose` flag provides detailed output about which files are being processed and updated.

### `effect-language-service diagnostics`
Provides a way to get through a CLI the list of Effect specific diagnostics; without patching your typescript installation. A `--file` option may be used to get diagnostics for a specific file, or `--project` with a tsconfig file to get an entire project. You can also pass `--lspconfig '{ "effectFn": ["untraced"] }'` to override the project plugin configuration inline for that diagnostics run.

### `effect-language-service quickfixes`
Shows diagnostics that have available quick fixes along with their proposed code changes. This is useful for previewing what fixes the language service can apply to your code. Use `--file` to check a specific file, or `--project` with a tsconfig file to check an entire project. The output displays each diagnostic with its location and the diff of proposed changes.

### `effect-language-service check`
This command runs a check of the setup of the patching mechanism of the LSP, to understand if typescript has been patched or not.

### `effect-language-service patch`
Patches (or re-patches) your local TypeScript installation to provide Effect diagnostics at build time.

### `effect-language-service unpatch`
Revery any previously applied patch to the local TypeScript installation.

### `effect-language-service overview`
This command is useful to provide an overview of Effect-related exports in your files or project, and is very useful for LLMs to grasp an overall idea of what a file/project offers. Use `--file` to analyze a specific file, or `--project` with a tsconfig file to analyze an entire project.

Example output:
```
✔ Processed 3 file(s)

Yieldable Errors (2)
  NotFoundError
    ./src/errors.ts:5:1
    NotFoundError
    Thrown when a resource is not found

  ValidationError
    ./src/errors.ts:12:1
    ValidationError
    Thrown when input validation fails

Services (2)
  DbConnection
    ./src/services/db.ts:6:1
    DbConnection
    Manages database connections and pooling

  Cache
    ./src/services/cache.ts:13:1
    Cache
    In-memory caching layer

Layers (2)
  CacheLive
    ./src/layers/cache.ts:34:14
    Layer<Cache, never, never>
    Provides cache with file system backing

  AppLive
    ./src/layers/app.ts:39:14
    Layer<Cache | UserRepository, never, never>
    Complete application layer
```

### `effect-language-service layerinfo`
This command provides detailed information about a specific exported layer, including what services it provides, what it requires, and a suggested composition order. Use `--file` to specify the file and `--name` to specify the layer name.

Example output:
```
AppLive
  ./src/layers/app.ts:39:14
  Layer<Cache | UserRepository, never, never>

Provides (2):
  - Cache
  - UserRepository

Suggested Composition:
  UserRepository.Default.pipe(
    Layer.provide(DbConnection.Default),
    Layer.provideMerge(Cache.Default),
    Layer.provide(FileSystem.Default)
  )

Tip: Not sure you got your composition right? Just write all layers inside a Layer.mergeAll(...)
command, and then run the layerinfo command to get the suggested composition order to use.
```

## Configuring diagnostics

You can either disable or change the severity of specific diagnostics by using comments in your code.

```ts
// @effect-diagnostics effect/floatingEffect:off
Effect.succeed(1); // This will not be reported as a floating Effect

// @effect-diagnostics effect/floatingEffect:error
Effect.succeed(1); // This will be reported as a floating effect
```

You can also use `*` as a wildcard to apply a severity to all diagnostics at once:

```ts
// @effect-diagnostics *:off
Effect.succeed(1); // No diagnostics will be reported from this point on

// @effect-diagnostics effect/floatingEffect:error
Effect.succeed(1); // This will be reported as a floating effect (rule-specific overrides wildcard)
```

or you can set the severity for the entire project in the global plugin configuration

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        // ...
        "diagnosticSeverity": { // allows to change per-rule default severity of the diagnostic in the whole project
          "floatingEffect": "warning" // example for a rule, allowed values are off,error,warning,message,suggestion
        },
        // ...
      }
    ]
  }
}
```

## Configuring Key Patterns

Effect uses string keys for Services, Error Tags, RPC Methods, and more.
It can happen that sometimes, after some refactors or copy/paste, you may end up having wrong or non unique keys in your services.

To avoid that, the LSP suggests deterministic patterns for keys; that can be configured by the "keyPatterns" option.

To enable reporting of wrong or outdated keys, the rule "deterministicKeys" must be enabled first (off by default). To do so, adjust its diagnosticSeverity to error.

The keyPatterns key can then contain an array of the configured patterns.

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@effect/language-service",
        // ...
        "diagnosticSeverity": {
          "deterministicKeys": "error" // enables reporting of wrong keys
          // ...
        },
        "keyPatterns": [
          {
            "target": "service", // what key type to target between service|error
            "pattern": "default", // the chosen pattern
            "skipLeadingPath": ["src/"] // other pattern specific configs
          }
        ]
        
      }
    ]
  }
}
```

### Pattern: default

This pattern constructs keys by chaining package name + file path + class identifier.

E.g. `@effect/package/subpath-relative-to-package-root/FileName/ClassIdentifier`

If the filename and the class identifier are the same, they won't be repeated, but used only once.

The skipLeadingPath array can contain a set of prefixes to remove from the subpath part of the path. By default "src/" is removed for example.

### Pattern: default-hashed

If you are concerned potentially showing service names in builds, this pattern is the same as default; but the string will be then hashed.

### Pattern: package-identifier

This pattern uses the package name + identifier. This usually works great if you have a flat structure, with one file per service/error.

## Using Key Patterns in custom API definitions

You can enforce and take advantage of the deterministicKeys rule also in your own custom API that provide an `extends MyApi("identifier")`-like experience, so basically only in extends clause of class declarations.

To do so, first you need to enable `extendedKeyDetection: true` in plugin options to enable slower detection of this custom patterns.

And then you'll need to add a JSDoc `/** @effect-identifier */` to the parameter where you expect to receive string identifier.

Let's say for example that you want to provide a Repository() API that is basically the same of Context.Tag, but prefixes the key identifier with 'Repository/'; the definition of the Resource API would be something like this:

```ts
export function Repository(/** @effect-identifier */ identifier: string) {
  return Context.Tag("Repository/" + identifier)
}
```

and will be used as follows:
```ts
export class UserRepo extends Repository("Hello")<UserRepo, { /** ... */ }>() {}
```


## Known gotchas

### Svelte VSCode extension and SvelteKit

The Svelte LSP does not properly compose with other LSPs when using SvelteKit. So the Effect LSP should be loaded as last entry to ensure proper composition.

If you did not install the Svelte LSP into your local project but instead through the Svelte VSCode extension, we recommend instead to install it locally and add it as the first entry. That way it won't be applied by the VSCode extension.

Your tsconfig.json should look like this:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      { "name": "typescript-svelte-plugin" },
      { "name": "@effect/language-service" }
    ]
  }
}
```
