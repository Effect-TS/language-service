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

### Quickinfo

- Show the extended type of the current Effect
- Hovering `yield*` of `Effect.gen` will show the Effect type parameters
- Hovering a variable assignment of a type Layer, will show info on how each service got involved
- Hovering a layer, will attempt to produce a graph

### Diagnostics

- Better error readability when you're missing errors or service types in your Effect definitions
- Floating Effects that are not yielded or run
- Wrong usage of yield inside `Effect.gen`
- Multiple versions of Effect in your project
- Warn on leaking requirements in Effect services
- Warn on Scope as requirement of a Layer
- Warn on subsequent `Effect.provide` anti-pattern
- Warn when using `Effect.provide` with Layer outside of application entry points
- Detect wrong `Self` type parameter for APIs like `Effect.Service` or `Schema.TaggedError` and similar 
- Unnecessary usages of `Effect.gen` or `pipe()`
- Warn when using `Effect.gen` with the old generator adapter pattern
- Warn when importing from a barrel file instead of from the module directly
- Warn on usage of try/catch inside `Effect.gen` and family
- Detect unnecessary pipe chains like `X.pipe(Y).pipe(Z)`
- Warn when using `Effect.Service` with `accessors: true` but methods have generics or multiple signatures
- Warn on missing service dependencies in `Effect.Service` declarations
- Warn when `Effect.Service` is used with a primitive type instead of an object type
- Warn when schema classes override the default constructor behavior
- Warn when `@effect-diagnostics-next-line` comments have no effect (i.e., they don't suppress any diagnostic)
- Detect nested function calls that can be converted to pipeable style for better readability
- Warn when using catch functions (`catchAll`, `catch`, `catchIf`, `catchSome`, `catchTag`, `catchTags`) on effects that never fail

### Completions

- Autocomplete 'Self' in `Effect.Service`, `Context.Tag`, `Schema.TaggedClass`, `Schema.TaggedRequest` and family
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
        "keyPatterns": [{ "target": "service", "pattern": "default", "skipLeadingPath": ["src/"] }] // configure the key patterns; recommended reading more on the section "Configuring Key Patterns"
      }
    ]
  }
}
```

### DiagnosticSeverty properties list

The full list can be found in the [diagnostics](https://github.com/Effect-TS/language-service/tree/main/src/diagnostics) folder.

## Why do diagnostics not appear at compile time?

TypeScript LSPs are loaded only while editing your files. That means that if you run `tsc` in your project, the plugin won't be loaded and you'll miss out on the Effect diagnostics.

We provide two approaches to solve this scenario.

### Option A - Effect LSP Cli Patch (experimental recommended)

This option works by modifing directly the source code of the tsc compiler and the typescript library in your project node_modules. This allows to get effect's diagnostics even when noEmit is enabled, for composite and incremental projects as well.

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

### Option B - Using ts-patch

if you use `ts-patch` you can enable the transform as well to get the diagnostics also at compile time.
Your `tsconfig.json` should look like this:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@effect/language-service",
        "transform": "@effect/language-service/transform" // enables diagnostics at compile time when using ts-patch
      }
    ]
  }
}
```

To get diagnostics you need to install `ts-patch` which will make it possible to run `tspc`.

Running `tspc` in your project will now also run the plugin and give you the error diagnostics at compile time.
Effect error diagnostics will be shown only after standard TypeScript diagnostics have been satisfied.
Beware that setting noEmit will completely skip the effect diagnostics, and projects using incremental builds may encounter some issues.

```ts
$ npx tspc
index.ts:3:1 - error TS3: Effect must be yielded or assigned to a variable.

3 Effect.succeed(1)
  ~~~~~~~~~~~~~~~~~

Found 1 error in index.ts:3 
```

## Effect-Language-Service CLI

The effect language service plugin comes with a builtin CLI tool that can be used to perform various utilities, checks and setups. Since it relies on typescript, we recommend to install it locally and run it locally to ensure it loads the same typescript version of your project rather than a global installation that may resolve to use a different TS version from the one of your project.

### `effect-language-service diagnostics`
Provides a way to get through a CLI the list of Effect specific diagnostics; without patching your typescript installation. A --file option may be used to get diagnostics for a specific file, or --project with a tsconfig file to get an entire project.

### `effect-language-service check`
This command runs a check of the setup of the patching mechanism of the LSP, to understand if typescript has been patched or not.

### `effect-language-service patch`
Patches (or re-patches) your local TypeScript installation to provide Effect diagnostics at build time.

### `effect-language-service unpatch`
Revery any previously applied patch to the local TypeScript installation.

## Configuring diagnostics

You can either disable or change the severity of specific diagnostics by using comments in your code.

```ts
// @effect-diagnostics effect/floatingEffect:off
Effect.succeed(1); // This will not be reported as a floating Effect

// @effect-diagnostics effect/floatingEffect:error
Effect.succeed(1); // This will be reported as a floating effect
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
