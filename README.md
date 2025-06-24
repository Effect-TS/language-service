# language-service

This package implements a TypeScript language service plugin that allows additional refactors and diagnostics with your VSCode editor (or any editor that supports TypeScript's LSP).

## Installation

1. `npm install @effect/language-service --save-dev` in your project
2. inside your tsconfig.json, you should add the plugin configuration as follows:
```json
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
   - In JetBrains you may have to disable the Vue language service, and chose the workspace version of TypeScript in the settings from the dropdown.
   - In NVim with nvim-vtsls you should refer to [how to enable TypeScript plugins in vstls](https://github.com/yioneko/vtsls?tab=readme-ov-file#typescript-plugin-not-activated)

And you're done! You'll now be able to use a set of refactor and diagnostics that targets Effect!

## Provided functionalities

### Quickinfo

- Show the extended type of the current Effect
- Hovering `yield\*` of `Effect.gen` will show the Effect type parameters
- Hovering a variable assignment of a type Layer, will show info on how each service got involve
- Hovering a layer, will attempt to produce a graph

### Diagnostics

- Better error readability when you're missing errors or service types in your Effect definitions
- Floating Effects that are not yielded or run
- Wrong usage of yield inside `Effect.gen`
- Multiple versions of Effect in your project
- Warn on leaking requirements in Effect services
- Unnecessary usages of `Effect.gen` or `pipe()`
- Warn when importing from a barrel file instead of from the module directly

### Completions

- Autocomplete 'Self' in `Effect.Service`, `Context.Tag`, `Schema.TaggedClass`, `Schema.TaggedRequest` and family
- Autocomplete `Effect.gen` with `function*(){}`
- Autocomplete `Effect.fn` with the span name given by the exported member
- Allow to configure packages to be imported with namespace style `import * as Effect from "effect"`

### Refactors

- Transform an async function definition, into an Effect by using Effect.gen.
- Transform an async function definition, into an Effect by using Effect.gen, and generating a tagged error for each promise call.
- Transform a function returning an Effect.gen into a Effect.fn
- Function calls to pipe: Transform a set of function calls to a pipe() call.
- Pipe to datafirst: Transform a pipe() call into a series of datafirst function calls (where available).
- Toggle return type signature: With a single refactor, adds or removes type annotations from the definition.
- Remove unnecessary `Effect.gen` definitions that contains a single `yield` statement.
- Wrap an `Effect` expression with `Effect.gen`

### Miscellaneous
- "Go to definition" for RpcClient will resolve to the Rpc definition

## Options

Few options can be provided alongside the initialization of the Language Service Plugin.

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@effect/language-service",
        "diagnostics": true, // controls Effect diagnostics (default: true)
        "diagnosticSeverity": { // allows to change per-rule default severity of the diagnostic in the whole project
          "floatingEffect": "warning" // example for a rule, allowed values are off,error,warning,message,suggestion
        },
        "quickinfo": true, // controls quickinfo over Effect (default: true)
        "completions": true, // controls Effect completions (default: true)
        "allowedDuplicatedPackages": [], // list of package names that has effect in peer dependencies and are allowed to be duplicated (default: [])
        "namespaceImportPackages": [] // list of package names that should be preferred as imported with namespace imports e.g. ["effect"] (default: [])
      }
    ]
  }
}
```

## Why diagnostics does not appear at compile time?

TypeScript LSP are loaded only while editing your files. That means that if you run `tsc` in your project, the plugin won't be loaded and you'll miss out on the Effect diagnostics.

HOWEVER, if you use `ts-patch` you can enable the transform as well to get the diagnostics also at compile time.
Your `tsconfig.json` should look like this:

```json
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

Running `tspc` in your project will now also run the plugin and give you the diagnostics at compile time.
Effect diagnostics will be shown only after standard TypeScript diagnostics has been satisfied.

```ts
$ npx tspc
index.ts:3:1 - error TS3: Effect must be yielded or assigned to a variable.

3 Effect.succeed(1)
  ~~~~~~~~~~~~~~~~~

Found 1 error in index.ts:3 
```

## Configuring diagnostics

You can either disable or change the severity of specific diagnostics by using comments in your code.

```ts
// @effect-diagnostics effect/floatingEffect:off
Effect.succeed(1); // This will not be reported as a floating effect

// @effect-diagnostics effect/floatingEffect:error
Effect.succeed(1); // This will be reported as a floating effect
```

or you can set the severity for the entire project in the global plugin configuration

```json
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

## Known gotchas

### Svelte VSCode extension and SvelteKit

The Svelte LSP does not properly compose with other LSPs when using SvelteKit. So the Effect LSP should be loaded as last entry to ensure proper composition.

If you did not installed the Svelte LSP into your local project but instead through the Svelte VSCode extension, we recommend instead to install locally and add it as first entry. That way it won't be applied by the VSCode extension.

Your tsconfig should look like this:

```json
{
  "compilerOptions": {
    "plugins": [
      { "name": "typescript-svelte-plugin" },
      { "name": "@effect/language-service" }
    ]
  }
}
```
