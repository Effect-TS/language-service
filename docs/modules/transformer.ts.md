---
title: transformer.ts
nav_order: 3
parent: Modules
---

## transformer overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [plugin](#plugin)
  - [effectPlugin](#effectplugin)

---

# plugin

## effectPlugin

**Signature**

```ts
export default function effectPlugin(
  program: ts.Program,
  options?: {
    trace?: { include?: Array<string>; exclude?: Array<string> }
    debug?: { include?: Array<string>; exclude?: Array<string> }
    optimize?: { include?: Array<string>; exclude?: Array<string> }
    removeUnusedImports?: boolean
  }
)
```

Added in v1.0.0
