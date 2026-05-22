---
"@effect/language-service": patch
---

Fix `effectRpcDefinition` wiping the upstream go-to-definition result when the user clicks on a JSX `<Namespace.Component />` tag name. The plugin's RpcClient → Rpc enrichment now skips ancestor nodes whose type cannot be resolved (such as JSX tag-name nodes) instead of returning `undefined` for the entire request.
