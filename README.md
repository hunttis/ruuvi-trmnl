# RuuviTRMNL

A TypeScript application that scans RuuviTag Bluetooth sensors and sends their data to TRMNL e-ink displays via webhook integration.

![TRMNL Display](https://img.shields.io/badge/TRMNL-E--ink%20Display-black) ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white) ![RuuviTag](https://img.shields.io/badge/RuuviTag-Bluetooth%20LE-red)

## 🌡️ Features

- **Multi-Sensor Support**: Automatically discovers and monitors multiple RuuviTag sensors
- **Smart Caching**: Only sends data to TRMNL when sensor readings actually change
- **Selective Transmission**: Only configured sensors (tagAliases) are sent to displays
- **Real-time Data**: Continuous scanning with efficient change-based updates
- **Rich Metrics**: Temperature, humidity, pressure, battery voltage, and signal strength
- **E-ink Optimized**: Custom TRMNL plugin template designed for 1-bit grayscale displays
- **Persistent State**: Cache survives restarts and prevents duplicate data transmission
- **Easy Setup**: Interactive tool to discover sensors and assign nicknames
- **Configurable**: Sensor aliases, refresh intervals, and webhook settings
- **Reliable**: Graceful error handling, connection testing, and automatic reconnection

## 📊 Sensor Data

Each RuuviTag provides:

- **Temperature** (°C)
- **Humidity** (%)
- **Pressure** (hPa)
- **Battery** (V)
- **Signal Strength** (dBm)
- **Status** (active/stale)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Settings

```bash
# Copy template and edit
cp config.template.json config.json
# Edit config.json with your TRMNL webhook URL
```

### 3. Discover Your RuuviTags

Use the interactive setup tool to find and nickname your sensors:

```bash
npm run setup
```

This will:

- Automatically discover nearby RuuviTag sensors
- Show real-time sensor data (temperature, humidity, battery)
- Let you assign friendly nicknames to each sensor
- Automatically update `config.json` with your sensor aliases

See `SETUP_TOOL.md` for detailed instructions.

### 4. Run Application

```bash
# Development mode
npm run dev:app

# Production mode
npm run build && npm run start:app
```

### 4. Setup TRMNL Plugin

1. Copy contents of `plugin-template.html`
2. Create a new [TRMNL Private Plugin](https://help.usetrmnl.com/en/articles/9510536-private-plugins#h_9de5a95e77)
3. Paste the template into the TRMNL plugin editor
4. Save and add to your TRMNL display

## ⚙️ Configuration

### config.json Structure

```json
{
  "trmnl": {
    "webhookUrl": "https://usetrmnl.com/api/custom_plugins/your-webhook-id",
    "refreshInterval": 300000,
    "maxTagsToDisplay": 5,
    "mergeStrategy": "replace",
    "requestTimeout": 10000
  },
  "ruuvi": {
    "scanTimeout": 5000,
    "dataRetentionTime": 300000,
    "tagAliases": {
      "a0b1c2d3e4f56789": "Living Room",
      "b1c2d3e4f5678901": "Outdoor",
      "c2d3e4f567890123": "Bedroom"
    }
  }
}
```

### Key Settings

- **refreshInterval**: Update frequency (300000ms = 5 minutes for TRMNL rate limiting)
- **tagAliases**: Map MAC addresses to friendly names (only these sensors are sent to TRMNL)
- **dataRetentionTime**: How long to keep sensor data before marking as stale

## 💾 Smart Cache System

RuuviTRMNL includes an intelligent caching system that dramatically reduces unnecessary API calls:

### How It Works

- **Change Detection**: Only sends data when sensor readings actually change
- **Selective Transmission**: Only sensors listed in `tagAliases` are sent to TRMNL
- **Persistent Storage**: Cache survives application restarts in `ruuvi-cache.json`
- **Efficient Updates**: Avoids sending duplicate data to respect TRMNL rate limits

### Cache Management

```bash
# View cache status and pending changes
npm run cache:inspect

# Clear cache (forces fresh transmission)
npm run cache:clear
```

### Benefits

- 🚀 **Faster Response**: Only processes changed data
- 📡 **Reduced API Usage**: Honors TRMNL rate limits efficiently
- 🔋 **Lower Power**: Less network activity
- 🎯 **Focused Data**: Only configured sensors reach your display

## 📱 TRMNL Plugin Templates

Three layout options included:

### Default Layout

- Best for 2-4 sensors
- Shows all metrics with emphasis on temperature/humidity
- Card-based design with status indicators

### Compact Layout

- Best for 3-6 sensors
- Essential metrics only
- Horizontal rows for space efficiency

### Grid Layout

- Best for 4+ sensors
- Equal-sized tiles for each sensor
- Clean, symmetric appearance

See `PLUGIN_TEMPLATE_README.md` for detailed customization guide.

## 🔧 Project Structure

```
├── src/
│   ├── app.ts              # Main application orchestrator
│   ├── ruuvi-collector.ts  # RuuviTag data collection service
│   ├── trmnl-sender.ts     # TRMNL webhook client
│   ├── config.ts           # Configuration management
│   ├── types.ts            # TypeScript interfaces
│   └── @types/             # Type definitions
├── config.json             # Your configuration (git-ignored)
├── config.template.json    # Configuration template
├── plugin-template.html    # TRMNL plugin markup
└── PLUGIN_TEMPLATE_README.md
```

## 🛠️ Development

### Available Scripts

```bash
npm run build        # Compile TypeScript
npm run dev          # Run original scanner (console output)
npm run dev:app      # Run full TRMNL app (development)
npm run start:app    # Run compiled app (production)
npm run clean        # Remove build files
```

### Requirements

- **Node.js** 18+
- **Bluetooth** adapter (built-in or USB)
- **RuuviTag** sensors broadcasting
- **TRMNL** account with webhook URL

## 📡 TRMNL Integration

### Rate Limits

- **Standard**: 12 requests/hour (5-minute intervals)
- **TRMNL+**: 30 requests/hour (2-minute intervals)

### Webhook Data Format

```json
{
  "merge_variables": {
    "ruuvi_tags": [
      {
        "id": "a06bd66b",
        "name": "Living Room",
        "temperature": 22.6,
        "humidity": 45.2,
        "battery": 2.89,
        "status": "active",
        "lastUpdated": "2025-10-13T..."
      }
    ],
    "lastRefresh": "2025-10-13T...",
    "totalTags": 3
  }
}
```

## 🔍 Troubleshooting

### No Sensors Found

- Check RuuviTag battery levels
- Verify Bluetooth is enabled
- Ensure tags are in range (typically 10-50m)
- Check tag aliases match actual MAC addresses

### TRMNL Connection Issues

- Verify webhook URL in config.json
- Test with: `curl -X POST your-webhook-url -d '{"test": true}'`
- Check rate limiting (max 12/hour standard, 30/hour TRMNL+)

### Stale Data

- Increase `dataRetentionTime` in config
- Check sensor placement and interference
- Verify sensors are actively broadcasting

## 🔄 Data Flow

```
RuuviTag BLE → Scanner → Data Collector → Webhook Sender → TRMNL Display
     ↓             ↓           ↓              ↓              ↓
   Sensor      Bluetooth   Aggregation    HTTP POST     E-ink Update
   Broadcast   Scanning    & Filtering    (5 min)       (Visual)
```

## 📊 Display Examples

The plugin shows sensor data like:

```
RuuviTag Sensors                     3 tags

Living Room
22.6°C                    45%
Temperature               Humidity

1013.2 hPa    2.89V      -65 dBm
Pressure      Battery    Signal

Updated: 14:32

Outdoor                           STALE
6.7°C                     78%
Temperature               Humidity

---

Last updated: 14:35 on Oct 13
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Test with real RuuviTags
5. Submit a pull request

## 📄 License

ISC License - see package.json

## 🙏 Acknowledgments

- [RuuviTag](https://ruuvi.com/) - Open source environmental sensors
- [TRMNL](https://usetrmnl.com/) - E-ink display platform
- [node-ruuvitag](https://github.com/pakastin/node-ruuvitag) - Bluetooth LE library
