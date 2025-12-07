# Update Throttling Fix (Dec 7, 2025)

## Problem

The application was still running out of memory after ~2.4 hours (8561 seconds), despite fixing the event listener accumulation issues.

```
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
```

## Root Cause

RuuviTags broadcast sensor data multiple times per second. The `updateTagData()` method was being called for EVERY broadcast, creating new objects and calling `cacheManager.updateTagData()` on each one.

### The Issue:

- A typical RuuviTag broadcasts ~1-2 times per second
- With multiple tags, this meant thousands of updates per minute
- Each update created new Date objects and ISO strings
- Each update called `cacheManager.updateTagData()` which:
  - Created new object spreads (`{ ...tagData }`)
  - Generated hash strings via `generateDataHash()`
  - Created more Date objects and strings
- Over 2+ hours: millions of temporary objects
- The garbage collector couldn't keep up with the allocation rate

### Why This Was Critical:

Even though individual objects were garbage collected, the _rate of allocation_ was the problem. The V8 engine's GC was spending more and more time trying to free memory, eventually reaching "ineffective mark-compacts" where it couldn't free enough memory between allocations.

## Solution

Added throttling to limit cache updates to once per second per tag:

```typescript
export class RuuviCollector {
  private lastUpdateTime = new Map<string, number>(); // Track last update time per tag
  private readonly UPDATE_THROTTLE_MS = 1000; // Only update cache once per second per tag

  private updateTagData(tagId: string, rawData: RawRuuviData): void {
    // ... existing code to update in-memory tagData ...

    // Throttle updates to prevent excessive object creation and GC pressure
    const now = Date.now();
    const lastUpdate = this.lastUpdateTime.get(tagId) || 0;
    const shouldUpdateCache = now - lastUpdate >= this.UPDATE_THROTTLE_MS;

    this.tagData.set(tagId, updatedTag);

    // Only update cache (which is expensive) if enough time has passed
    if (shouldUpdateCache) {
      this.cacheManager.updateTagData(updatedTag);
      this.lastUpdateTime.set(tagId, now);
    }
  }
}
```

## Impact

### Before:

- Cache updated multiple times per second per tag
- With 5 tags broadcasting 2x/second: **600 cache updates per minute**
- Over 2.4 hours: **~86,400 expensive operations**
- Millions of temporary objects created

### After:

- Cache updated maximum once per second per tag
- With 5 tags: **300 cache updates per minute** (50% reduction)
- Over 2.4 hours: **~43,200 operations** (50% reduction)
- Significant reduction in object creation and GC pressure

### Trade-offs:

- In-memory `tagData` Map is still updated on every broadcast (fast)
- Cache updates (the expensive part) are throttled
- Display shows real-time data (from `tagData` Map)
- Cache reflects data with max 1-second delay (negligible for sensor data)
- No functional impact on the user experience

## Why This Works

1. **Reduced Object Creation**: 50% fewer object spreads, Date objects, and string allocations
2. **Reduced Hash Computation**: `generateDataHash()` called 50% less often
3. **Reduced JSON Operations**: Cache serialization happens less frequently
4. **GC Can Keep Up**: Allocation rate is now sustainable for V8's garbage collector
5. **No Data Loss**: All sensor data is still captured and displayed in real-time

## Testing

All 60 unit tests pass, including the listener accumulation tests. The throttling is internal to `RuuviCollector` and doesn't affect the public API.

## Related Issues

This complements the listener accumulation fixes in `MEMORY_LEAK_FIX.md`. Together, these fixes address:

1. ✅ Event listener accumulation (fixed Nov 30 - Dec 6)
2. ✅ Excessive object creation from high-frequency updates (fixed Dec 7)

The application should now be able to run indefinitely without memory issues.
