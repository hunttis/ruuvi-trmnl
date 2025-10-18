# RuuviTRMNL Templates

This directory contains different layout templates for displaying RuuviTag sensor data on TRMNL e-ink displays.

## Template Variants

### 1. Full Layout (`full.html`)
**Best for: Full screen displays with detailed information**
- Complete sensor information with names, values, and timestamps
- Visual status indicators for stale/offline sensors
- Large, readable text
- Detailed last update timestamps

### 2. Half Horizontal Layout (`half-horizontal.html`)
**Best for: Half-width displays, side panels**
- Compact horizontal rows
- Essential data only (name, temperature, humidity)
- Status indicators for offline sensors
- Simplified timestamp display

### 3. Half Vertical Layout (`half-vertical.html`)
**Best for: Half-height displays, narrow screens**
- Stacked sensor cards
- Abbreviated labels to save space
- Background highlighting for offline sensors
- Ultra-compact design

### 4. Quadrant Layout (`quadrant.html`)
**Best for: Quarter-screen displays, dashboard corners**
- Minimal grid layout
- Essential data only
- Truncated names and labels
- Maximum space efficiency

## Data Structure

All templates expect the same webhook data structure:

```json
{
  "merge_variables": {
    "ruuvi_tags": [
      {
        "id": "a06bd66b",
        "name": "Living Room", 
        "temperature": 22.6,
        "humidity": 45.2,
        "lastTemperatureUpdate": "2025-10-18T10:30:00Z",
        "lastUpdated": "2025-10-18T10:30:00Z",
        "status": "active"  // or "stale", "offline"
      }
    ],
    "lastRefresh": "2025-10-18T10:30:00Z",
    "totalTags": 2
  }
}
```

## Features

- **Missing data handling**: Shows "-" for temperature/humidity when sensors are offline
- **Status indicators**: Visual cues for stale/offline sensors
- **Responsive text sizes**: Appropriate for each layout size
- **Time formatting**: Readable timestamps for last updates
- **Error resilience**: Graceful handling of missing sensor data

## Usage

1. Choose the appropriate template for your display size
2. Copy the template content to your TRMNL plugin
3. The RuuviTRMNL application will automatically send data in the expected format