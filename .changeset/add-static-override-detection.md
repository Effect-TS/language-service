---
"@effect/language-service": patch
---

Add code fix to rewrite Schema class constructor overrides as static 'new' methods

When detecting constructor overrides in Schema classes, the diagnostic now provides a new code fix option that automatically rewrites the constructor as a static 'new' method. This preserves the custom initialization logic while maintaining Schema's decoding behavior.

Example:
```typescript
// Before (with constructor override)
class MyClass extends Schema.Class<MyClass>("MyClass")({ a: Schema.Number }) {
  b: number
  constructor() {
    super({ a: 42 })
    this.b = 56
  }
}

// After (using static 'new' method)
class MyClass extends Schema.Class<MyClass>("MyClass")({ a: Schema.Number }) {
  b: number
  public static new() {
    const _this = new this({ a: 42 })
    _this.b = 56
    return _this
  }
}
```
