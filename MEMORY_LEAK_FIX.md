# Memory Leak Fix (Nov 30, 2025)

## Problem
App crashed with `FATAL ERROR: JavaScript heap out of memory` after running for ~2 hours (7517 seconds).

## Root Causes

### 1. Event Listener Accumulation in RuuviCollector
**Location**: `src/collectors/ruuvi-collector.ts:44`

Every time the `ruuvi.on("found")` event fired for a tag, a NEW `tag.on("updated")` listener was attached, even if the tag had already been discovered. With continuous scanning, this caused hundreds of duplicate listeners to pile up in memory.

```typescript
// BEFORE (memory leak):
ruuvi.on("found", (tag) => {
  // ...
  tag.on("updated", (data) => { // New listener EVERY time!
    this.updateTagData(tag.id, data);
  });
});
```

### 2. Event Listener Accumulation in Setup Mode
**Location**: `src/core/app.ts:583, 622`

Two separate issues:
- New `ruuvi.on("found")` listener added EVERY time user pressed T to enter setup mode
- New `tag.on("updated")` listener attached for every tag discovery in setup mode
- No cleanup when exiting setup mode (pressing D or Q)

```typescript
// BEFORE (memory leak):
private async initializeSetupMode() {
  ruuvi.on("found", (tag) => { // New listener every time!
    tag.on("updated", (data) => { // More listeners!
      // ...
    });
  });
}
```

## Solutions

### 1. Track Listeners in RuuviCollector
Added `tagListeners` Set to track which tags already have listeners attached:

```typescript
private tagListeners = new Set<string>();

// Only attach listener once per tag
if (!this.tagListeners.has(tag.id)) {
  this.tagListeners.add(tag.id);
  tag.on("updated", (data) => {
    this.updateTagData(tag.id, data);
  });
}
```

### 2. Track and Clean Up Setup Mode Listeners
Added proper lifecycle management for setup mode:

```typescript
// Track listeners with function references for cleanup
private setupTagListeners = new Map<string, { 
  tag: RawRuuviTag; 
  listener: (data: RawRuuviData) => void 
}>();
private setupFoundListener: ((tag: RawRuuviTag) => void) | null = null;

// Cleanup when exiting setup mode
private cleanupSetupMode() {
  // Remove all tag listeners
  for (const [tagId, { tag, listener }] of this.setupTagListeners.entries()) {
    (tag as any).removeListener?.("updated", listener);
  }
  this.setupTagListeners.clear();

  // Remove main found listener
  if (this.setupFoundListener) {
    ruuvi.removeListener("found", this.setupFoundListener);
    this.setupFoundListener = null;
  }
}
```

## Impact

### Before
- Memory grew unbounded
- ~2000 MB consumption after 2 hours
- Crash with heap out of memory

### After
- Event listeners properly managed
- Memory usage should remain stable
- Listeners cleaned up when no longer needed

## Testing
- All 50 tests pass
- Build successful
- Should be monitored during long-running sessions to confirm fix

## Files Changed
- `src/collectors/ruuvi-collector.ts` - Track and prevent duplicate tag listeners
- `src/core/app.ts` - Add setup mode listener lifecycle management
