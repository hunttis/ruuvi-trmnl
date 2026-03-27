# Templates

Layout templates for TRMNL displays:

- `responsive.html` - **Recommended** - Adaptive layout that works across all screen sizes, orientations, and bit-depths

Copy template content into a TRMNL Private Plugin.

## Responsive Template

The `responsive.html` template uses TRMNL's responsive framework to automatically adapt to:

- **Screen sizes**: Small (600px+), Medium (800px+), Large (1024px+)
- **Orientation**: Landscape (default) and Portrait
- **Bit-depth**: 1-bit, 2-bit, and 4-bit displays

This single template replaces the need for separate layouts for different screen configurations.

## Data Structure

The plugin expects this data structure from the webhook:

```json
{
  "merge_variables": {
    "ruuvi_tags": [
      {
        "id": "a06bd66b",
        "name": "Living Room",
        "temperature": 22.6,
        "humidity": 45.2,
        "pressure": 1013.25,
        "battery": 2.89,
        "signal": -65,
        "lastUpdated": "2025-10-13T...",
        "status": "active"
      }
    ],
    "lastRefresh": "2025-10-13T...",
    "totalTags": 3
  }
}
```

## Status States

- **active**: Tag is broadcasting normally
- **stale**: No update in `dataRetentionTime` (default 5 min)
- **offline**: No data received
