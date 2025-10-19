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

Copy `templates/quadrant.html` (or other template) into a TRMNL Private Plugin.

## Commands

- `npm start` - Run application
- `npm run setup` - Find and configure sensors
- `npm test` - Run tests
