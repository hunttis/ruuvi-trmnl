# RuuviTRMNL

Send RuuviTag sensor data to TRMNL e-ink displays.

## Setup

1. **Install**: `npm install`
2. **Configure**: Copy `config.template.json` to `config.json` and add your TRMNL webhook URL
3. **Discover sensors**: `npm run setup`
4. **Run**: `npm start`

## Configuration

Edit `config.json`:

```json
{
  "trmnl": {
    "webhookUrl": "https://usetrmnl.com/api/custom_plugins/your-webhook-id",
    "refreshInterval": 300
  },
  "ruuvi": {
    "tagAliases": {
      "a0b1c2d3": "Living Room",
      "b1c2d3e4": "Outdoor"
    },
    "displayOrder": ["a0b1c2d3", "b1c2d3e4"]
  }
}
```

## TRMNL Plugin

Copy `templates/responsive.html` (or other template) into a TRMNL Private Plugin.

## Commands

| Command | Description |
|---------|-------------|
| `npm start` | Run application |
| `npm run setup` | Find and configure sensors |
| `npm run cache:inspect` | Inspect cache status |
| `npm run cache:clear` | Clear cache file |
| `npm run trmnl:send` | One-shot send to TRMNL |
| `npm test` | Run tests |

## Cache System

The app uses intelligent caching that only sends data when sensor values change:

- Only tags listed in `tagAliases` are transmitted
- Cache persists across restarts (`ruuvi-cache.json`)
- Hash-based change detection (temperature, humidity, pressure, battery)
- Use `npm run cache:clear` to reset if needed
