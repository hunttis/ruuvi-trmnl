# RuuviTRMNL Cache System

## Overview

The RuuviTRMNL application now includes an intelligent caching system that only sends data to the TRMNL endpoint when RuuviTag data has actually changed. This provides several benefits:

- **Reduced API calls**: Only sends data when changes are detected
- **Focused data**: Only sends data for tags configured in `tagAliases`
- **Persistence**: Cache survives application restarts
- **Efficiency**: Avoids sending duplicate data to TRMNL

## How It Works

### 1. Tag Discovery & Data Updates

- When RuuviTags are discovered, their data is stored in both memory and a persistent cache file
- Each data update generates a hash based on significant sensor values (temperature, humidity, pressure, battery, signal)
- If the hash changes, the data is marked as "pending" for the next TRMNL transmission

### 2. Filtered Transmission

- Only tags listed in `config.json` → `ruuvi.tagAliases` are sent to TRMNL
- Tags not in `tagAliases` are cached but never transmitted (useful for monitoring without display)
- Changed data is sent immediately on the next cycle

### 3. Cache Persistence

- Cache is stored in `ruuvi-cache.json` (automatically added to `.gitignore`)
- Survives application restarts and system reboots
- Tracks last transmission time to prevent duplicate sends

## Configuration

The cache system respects your existing `config.json` settings:

```json
{
  "ruuvi": {
    "tagAliases": {
      "a06bd66b": "Living Room",
      "870d8621": "Outdoor",
      "c8cfe694": "Bedroom"
    }
  }
}
```

**Only tags listed in `tagAliases` will be sent to TRMNL.**

## Cache Management Commands

### Inspect Cache Status

```bash
npm run cache:inspect
```

Shows:

- All cached tags and their data
- Which tags are configured for TRMNL transmission
- Which tags have pending changes to be sent
- Cache statistics and last update times

### Clear Cache

```bash
npm run cache:clear
```

Deletes the cache file. Next run will start fresh and send all current data.

## Cache File Structure

The cache is stored as JSON in `ruuvi-cache.json`:

```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-10-14T...",
  "cache": {
    "a06bd66b12345678": {
      "data": {
        "id": "a06bd66b",
        "name": "Living Room",
        "temperature": 22.5,
        "humidity": 45.2,
        "lastUpdated": "2025-10-14T...",
        "status": "active"
      },
      "hash": "eyJ0ZW1wZXJhdHVyZSI6MjIuNSwiaHVtaWRpdHkiOjQ1LjJ9",
      "lastSent": "2025-10-14T..."
    }
  }
}
```

## Log Output Changes

The application now provides enhanced logging:

### Data Updates

- `📊` Normal data update (no change)
- `🔄` Data changed (will be sent next cycle)

### Send Cycles

```
📊 Data cycle - Total discovered: 5, Allowed tags: 3, Pending send: 1
📤 Sending 1 changed readings to TRMNL
✅ Successfully sent 1 readings to TRMNL
```

## Benefits

### Efficiency

- **Reduced TRMNL API usage**: Honors rate limits by only sending when needed
- **Lower network traffic**: No redundant data transmission
- **Faster cycles**: Skip processing when no changes detected

### Reliability

- **Persistent state**: Cache survives restarts and crashes
- **Selective monitoring**: Monitor all tags but only display configured ones
- **Change detection**: Accurate identification of meaningful data changes

### Debugging

- **Transparent operation**: Clear logging of cache operations
- **Inspection tools**: Built-in cache inspection utilities
- **Manual control**: Easy cache clearing for testing

## Change Detection Logic

The system detects changes by hashing sensor values with appropriate precision:

- **Temperature**: Rounded to 0.1°C (e.g., 22.5°C)
- **Humidity**: Rounded to 0.1% (e.g., 45.2%)
- **Pressure**: Rounded to 0.01 hPa (e.g., 1013.25 hPa)
- **Battery**: Rounded to 0.01V (e.g., 2.89V)
- **Signal**: Exact RSSI value
- **Status**: active/stale/offline

This ensures minor sensor noise doesn't trigger unnecessary updates while capturing all meaningful changes.

## Migration Notes

- Existing installations will automatically create a cache on first run
- No configuration changes required - existing `tagAliases` settings are used
- First run after upgrade will send all current data (as cache starts empty)
- Cache file should be excluded from version control (already in `.gitignore`)

## Troubleshooting

### Cache Issues

```bash
# View cache status
npm run cache:inspect

# Reset cache if corrupted
npm run cache:clear
npm run dev  # Will recreate cache
```

### Not Sending Data

1. Check tag is in `tagAliases` configuration
2. Verify data has actually changed since last send
3. Check logs for stale data filtering
4. Use `cache:inspect` to see pending changes

### Too Many Updates

1. Check for sensor noise causing false changes
2. Verify hash precision is appropriate for your sensors
3. Consider adjusting `dataRetentionTime` if needed
