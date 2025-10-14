# RuuviTRMNL Plugin Template

This file contains the TRMNL plugin markup for displaying RuuviTag sensor data on your TRMNL e-ink display.

## Setup Instructions

1. **Copy the Template**: Copy the contents of `plugin-template.html`
2. **Create Plugin**: Go to [TRMNL Private Plugins](https://help.usetrmnl.com/en/articles/9510536-private-plugins#h_9de5a95e77)
3. **Paste Markup**: Paste the template code into the TRMNL plugin editor
4. **Configure Webhook**: Use the webhook URL from your `config.json` file

## Template Variants

The template includes three different layout options:

### 1. Default Layout (Detailed)

- **Best for**: 2-4 sensors, full information display
- **Features**: Temperature, humidity, pressure, battery, signal strength
- **Visual**: Card-based layout with emphasis on primary metrics

### 2. Compact Layout

- **Best for**: 3-6 sensors, space-efficient
- **Features**: Essential metrics only (temp, humidity, battery)
- **Visual**: Horizontal rows with aligned values

### 3. Grid Layout

- **Best for**: 4+ sensors, equal emphasis
- **Features**: Grid tiles with primary metrics
- **Visual**: Equal-sized boxes for each sensor

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

## Customization

### Changing Layout

Uncomment one of the alternative layouts in the template and comment out the default.

### Modifying Tag Aliases

Update the `tagAliases` in your `config.json`:

```json
{
  "ruuvi": {
    "tagAliases": {
      "a0b1c2d3e4f56789": "Kitchen",
      "b1c2d3e4f5678901": "Garage",
      "c2d3e4f567890123": "Attic"
    }
  }
}
```

### Display Options

- **Temperature**: Always shown in Celsius
- **Humidity**: Rounded to whole percentage
- **Pressure**: In hectopascals (hPa)
- **Battery**: In volts (V)
- **Signal**: In dBm

### Stale Data Handling

- Tags marked as "stale" get visual emphasis
- Based on `dataRetentionTime` in config (default: 5 minutes)

## Framework Classes Used

The template uses TRMNL Framework v2 classes:

- `layout`: Flex containers for arrangement
- `item`: Structured content blocks
- `value`: Numerical display with sizing
- `title`: Headings and labels
- `label`: Secondary text
- `description`: Supporting information
- `gap--*`: Spacing between elements
- `text--*`: Text alignment

## Troubleshooting

### No Data Showing

1. Verify RuuviTags are broadcasting
2. Check webhook URL in config.json
3. Ensure app is running (`npm run dev:app`)

### Layout Issues

1. Try different template variants
2. Adjust gap/spacing classes
3. Use responsive prefixes for screen size

### Stale Data

- Increase `dataRetentionTime` in config
- Check Bluetooth range to sensors
- Verify sensor battery levels

## Display Recommendations

- **Portrait Mode**: Use default or compact layout
- **Landscape Mode**: Consider grid layout for multiple sensors
- **Small Displays**: Use compact layout
- **Large Displays**: Use default layout with all metrics

The template is optimized for TRMNL's 1-bit grayscale display and follows the design system guidelines for optimal readability.
