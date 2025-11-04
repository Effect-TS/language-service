---
"@effect/language-service": patch
---

Fix `missedPipeableOpportunity` diagnostic to correctly detect nested function call chains

The diagnostic now properly identifies when nested function calls can be converted to pipeable style. Previously, the chain detection logic incorrectly tracked parent-child relationships, causing false positives. This fix ensures that only valid pipeable chains are reported, such as `toString(double(addOne(5)))` which can be refactored to `addOne(5).pipe(double, toString)`.

Example:
```typescript
// Before: incorrectly flagged or missed
identity(Schema.decodeUnknown(MyStruct)({ x: 42, y: 42 }))

// After: correctly handles complex nested calls
toString(double(addOne(5))) // ✓ Now correctly detected as pipeable
```
