---
title: definition.ts
nav_order: 1
parent: Modules
---

## definition overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [plugin](#plugin)
  - [ApplicableRefactorDefinition (interface)](#applicablerefactordefinition-interface)
  - [PluginOptions (interface)](#pluginoptions-interface)
  - [RefactorDefinition (interface)](#refactordefinition-interface)
  - [createRefactor](#createrefactor)

---

# plugin

## ApplicableRefactorDefinition (interface)

**Signature**

```ts
export interface ApplicableRefactorDefinition {
  kind: string
  description: string
  apply: (changeTracker: ts.textChanges.ChangeTracker) => void
}
```

Added in v1.0.0

## PluginOptions (interface)

**Signature**

```ts
export interface PluginOptions {
  preferredEffectGenAdapterName: string
}
```

Added in v1.0.0

## RefactorDefinition (interface)

**Signature**

```ts
export interface RefactorDefinition {
  name: string
  description: string
  apply: (
    ts: AST.TypeScriptApi,
    program: ts.Program,
    options: PluginOptions
  ) => (sourceFile: ts.SourceFile, textRange: ts.TextRange) => O.Option<ApplicableRefactorDefinition>
}
```

Added in v1.0.0

## createRefactor

**Signature**

```ts
export declare function createRefactor(definition: RefactorDefinition)
```

Added in v1.0.0
