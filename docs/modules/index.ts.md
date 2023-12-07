---
title: index.ts
nav_order: 1
parent: Modules
---

## index overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [plugin](#plugin)
  - [init](#init)

---

# plugin

## init

**Signature**

```ts
export declare const init: (modules: { typescript: typeof ts }) => {
  create: (info: ts.server.PluginCreateInfo) => ts.LanguageService
}
```

Added in v1.0.0
