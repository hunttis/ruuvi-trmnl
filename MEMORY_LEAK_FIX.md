# Memory Leak Fix (Nov 30, 2025)
## Updated: Dec 6, 2025 - Complete Memory Leak Audit

## Problem

App crashed with `FATAL ERROR: JavaScript heap out of memory` after running for ~2 hours (7517 seconds).

## Memory Leaks Found and Fixed

### 1. Event Listener Accumulation in RuuviCollector (CRITICAL)

**Location**: `src/collectors/ruuvi-collector.ts:44`
**Status**: ✅ FIXED (Dec 6, 2025)

Every time the `ruuvi.on("found")` event fired for a tag, a NEW `tag.on("updated")` listener was attached, even if the tag had already been discovered. With continuous scanning, this caused hundreds of duplicate listeners to pile up in memory.

**Issue**: The previous fix from Nov 30 was inadvertently reverted. The comment on line 44 still said "Always set up the updated listener (even for rediscovered tags)".

```typescript
// BEFORE (memory leak):
ruuvi.on("found", (tag) => {
  // ...
  // Always set up the updated listener (even for rediscovered tags)
  tag.on("updated", (data) => { // New listener EVERY time!
    this.updateTagData(tag.id, data);
  });
});

// AFTER (fixed):
private tagListeners = new Set<string>(); // Track which tags have listeners

ruuvi.on("found", (tag) => {
  // ...
  // Only attach listener once per tag to prevent memory leak
  if (!this.tagListeners.has(tag.id)) {
    this.tagListeners.add(tag.id);
    tag.on("updated", (data) => {
      this.updateTagData(tag.id, data);
    });
  }
});
```

### 2. Process Event Listener Accumulation (MEDIUM)

**Location**: `src/core/app.ts:401`
**Status**: ✅ FIXED (Dec 6, 2025)

The `setupGracefulShutdown()` method is called in `start()`, but if the app is stopped and restarted (which can happen in tests or manual restarts), new process event listeners are attached without removing the old ones.

```typescript
// BEFORE (memory leak on restart):
private setupGracefulShutdown(): void {
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("uncaughtException", (error) => { ... });
  process.on("unhandledRejection", (reason, promise) => { ... });
}

// AFTER (fixed):
private processListenersAttached = false;

private setupGracefulShutdown(): void {
  // Only attach listeners once to prevent accumulation
  if (this.processListenersAttached) {
    return;
  }
  this.processListenersAttached = true;
  
  process.on("SIGINT", () => shutdown("SIGINT"));
  // ... rest of listeners
}
```

### 3. Event Listener Accumulation in Setup Mode (ALREADY FIXED Nov 30)

**Location**: `src/core/app.ts:583, 622`
**Status**: ✅ Already fixed and still working correctly

Two separate issues were fixed on Nov 30:
- New `ruuvi.on("found")` listener added EVERY time user pressed T to enter setup mode
- New `tag.on("updated")` listener attached for every tag discovery in setup mode
- No cleanup when exiting setup mode (pressing D or Q)

The fix properly tracks listeners and cleans them up when exiting setup mode.

## Verified Safe Areas

### ✅ Timeouts in trmnl-sender.ts
All `setTimeout` calls are properly cleared in both success and error paths.

### ✅ Intervals in Combined Display
The `setInterval` in `ink-combined-display.ts` is properly stored and cleared in the `stop()` method.

### ✅ Cache Manager
The cache object only stores data for configured tags (bounded by config). Old tag data is replaced, not accumulated.

### ✅ Maps and Sets
All Maps and Sets are bounded:
- `tagData` in RuuviCollector: Only stores discovered tags (bounded by physical tags)
- `discoveredTags` in Setup Mode: Cleared when exiting setup
- `setupTagListeners`: Properly cleared when exiting setup

## Impact

### Before
- Memory grew unbounded
- ~2000 MB consumption after 2 hours  
- Crash with heap out of memory

### After
- Event listeners properly managed
- Memory usage should remain stable
- Listeners cleaned up when no longer needed
- Process listeners only attached once

## Testing
- All 50 tests pass
- Build successful
- Should be monitored during long-running sessions to confirm fix

## Files Changed
- `src/collectors/ruuvi-collector.ts` - Re-applied fix to track and prevent duplicate tag listeners
- `src/core/app.ts` - Added flag to prevent duplicate process listener attachment
- `MEMORY_LEAK_FIX.md` - Updated with complete audit findings

- All 50 tests pass
- Build successful
- Should be monitored during long-running sessions to confirm fix

## Files Changed

- `src/collectors/ruuvi-collector.ts` - Track and prevent duplicate tag listeners
- `src/core/app.ts` - Add setup mode listener lifecycle management
