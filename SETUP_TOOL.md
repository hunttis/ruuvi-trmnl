# RuuviTag Setup Tool

The RuuviTag Setup Tool is an interactive command-line utility that helps you discover RuuviTag sensors and assign friendly nicknames to them. It automatically updates your `config.json` file with the configured sensor aliases.

## 🚀 Quick Start

```bash
npm run setup
```

## 📋 Features

- **Auto-Discovery**: Automatically finds nearby RuuviTag sensors
- **Real-time Data**: Shows live sensor readings (temperature, humidity, battery)
- **Interactive Interface**: Simple numbered menu for assigning nicknames
- **Automatic Configuration**: Updates `config.json` with your sensor aliases
- **Live Updates**: See sensor data update in real-time as you work

## 🎯 How It Works

### 1. Start Discovery

The tool begins scanning for RuuviTag sensors immediately when started:

```
🔍 RuuviTag Setup Tool
═════════════════════════
This tool will help you discover RuuviTags and assign nicknames.
Press Ctrl+C at any time to save and exit.

🔍 Starting RuuviTag scan...
```

### 2. View Discovered Tags

As tags are found, they appear in a numbered list with real-time data:

```
📋 Discovered Tags:
───────────────────
1. a06bd66b → <no nickname>
   📊 22.5°C, 45%, 2.89V | Last: 14:30:25

2. 870d8621 → <no nickname>
   📊 18.2°C, 62%, 2.76V | Last: 14:30:28
```

### 3. Assign Nicknames

Use the interactive menu to set friendly names:

```
🛠️  Actions:
1-9) Set nickname for tag number
s) Save to config.json
r) Refresh display
q) Quit

Choose an action: 1

📝 Setting nickname for a06bd66b
Current nickname: <no nickname>
Enter new nickname (or press Enter to skip): Living Room
✅ Set nickname "Living Room" for a06bd66b
```

### 4. Save Configuration

Save your nicknames to the configuration file:

```
Choose an action: s

✅ Config saved to config.json
   📝 Added: 2 new tags
   🔄 Updated: 0 existing tags

📋 Current tagAliases:
   a06bd66b → Living Room
   870d8621 → Outdoor Deck
```

## 🎛️ Menu Options

| Option   | Action                                |
| -------- | ------------------------------------- |
| `1-9`    | Set nickname for tag number (1-9)     |
| `s`      | Save current nicknames to config.json |
| `r`      | Refresh the display                   |
| `q`      | Save and quit                         |
| `Ctrl+C` | Save and exit immediately             |

## 📊 Display Information

For each discovered tag, you'll see:

- **Tag ID**: First 8 characters of the MAC address
- **Nickname**: Current assigned name (or `<no nickname>`)
- **Live Data**:
  - Temperature (°C)
  - Humidity (%)
  - Battery voltage (V)
  - Last update time

## 💾 Configuration Integration

The tool automatically updates your `config.json` file:

### Before Setup

```json
{
  "ruuvi": {
    "tagAliases": {}
  }
}
```

### After Setup

```json
{
  "ruuvi": {
    "tagAliases": {
      "a06bd66b": "Living Room",
      "870d8621": "Outdoor Deck",
      "c8cfe694": "Bedroom"
    }
  }
}
```

## 🔧 Usage Tips

### Best Practices

1. **Run Near Your Sensors**: Get close to your RuuviTags for best discovery
2. **Wait for Data**: Let tags appear and show sensor readings before assigning names
3. **Descriptive Names**: Use clear, location-based names like "Kitchen", "Garage", etc.
4. **Save Frequently**: Use `s` to save progress as you work

### Troubleshooting

#### No Tags Found

- Ensure RuuviTags are nearby and powered
- Check that Bluetooth is enabled on your system
- Wait 30-60 seconds for discovery to complete
- Try moving closer to the sensors

#### Data Not Updating

- RuuviTags transmit data every 1-10 seconds
- Check battery levels (should be > 2.5V)
- Ensure tags aren't in deep sleep mode

#### Permission Errors

- On Linux, you may need to run with `sudo` for Bluetooth access
- On macOS, ensure Terminal has Bluetooth permissions

## 🔄 Updating Existing Configuration

If you already have tagAliases configured:

1. **Existing Aliases Preserved**: Current nicknames remain unchanged
2. **Update Mode**: Re-run setup to modify existing nicknames
3. **Addition Mode**: New tags are added to existing configuration
4. **Backup Recommended**: Consider backing up `config.json` before major changes

## 🚪 Exiting

The tool provides multiple ways to exit safely:

- **Type `q`**: Save current progress and quit
- **Press `Ctrl+C`**: Immediate save and exit
- **Close Terminal**: Progress may be lost

All exit methods attempt to save your progress to `config.json`.

## Example Session

```bash
$ npm run setup

🔍 RuuviTag Setup Tool
═════════════════════════
🔍 Starting RuuviTag scan...

📡 New tag discovered: a06bd66b

📋 Discovered Tags:
───────────────────
1. a06bd66b → <no nickname>
   📊 22.5°C, 45%, 2.89V | Last: 14:30:25

🛠️  Actions:
1-9) Set nickname for tag number
s) Save to config.json
r) Refresh display
q) Quit

Choose an action: 1

📝 Setting nickname for a06bd66b
Current nickname: <no nickname>
Enter new nickname: Living Room
✅ Set nickname "Living Room" for a06bd66b

Choose an action: s

✅ Config saved to config.json
   📝 Added: 1 new tags
   🔄 Updated: 0 existing tags

Choose an action: q
💾 Saving configuration before exit...
🛑 Stopping scan and cleaning up...
```

After running the setup tool, you can immediately start the main application:

```bash
npm run dev:app
```

Your sensors will now appear with their friendly names in the logs and TRMNL display!
