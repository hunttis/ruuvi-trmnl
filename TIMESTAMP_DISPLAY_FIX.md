# Template Timestamp Display Fix

## Issue

The timestamp display under the temperature in the half_horizontal layout (and other layouts) was being cut off.

## Solution

Moved the timestamp display from under the temperature to the title line in brackets for all templates.

## Changes Made

### Templates Updated

1. **half-horizontal.html**: Moved timestamp from under temperature to title line in brackets
2. **half-vertical.html**: Moved timestamp from beside temperature to title line in brackets
3. **quadrant.html**: Moved timestamp from under temperature to title line in brackets
4. **full.html**: Moved timestamp from under temperature to title line in brackets

### Template Logic

- Timestamp only appears when sensor has been quiet for 30+ minutes AND has temperature data
- Format: `Sensor Name (HH:MM)` where HH:MM is the time of last measurement
- Uses Finnish time format (HH:MM)

### Example Display

- **Before**:
  ```
  Living Room
  22.5°C
  10:30  <-- This was cut off
  ```
- **After**:
  ```
  Living Room (10:30)
  22.5°C
  ```

### Test Updates

- Updated test data to use current timestamps instead of 2024 dates
- Fixed test expectations to match new timestamp location
- Updated truncation expectations (quadrant template uses 8 chars, not 6)
- Added regex pattern matching for timestamp format in titles

## Benefits

- ✅ Prevents timestamp cutoff issues
- ✅ More compact display layout
- ✅ Consistent across all template layouts
- ✅ Maintains readability with clear timestamp indication
- ✅ All 55 tests passing

## Template Coverage

- **Full layout**: Large displays - timestamp in large title
- **Half-horizontal**: Side panels - timestamp in small title
- **Half-vertical**: Top/bottom half - timestamp in medium title
- **Quadrant**: Corner displays - timestamp in tiny title (truncated name to 8 chars)
