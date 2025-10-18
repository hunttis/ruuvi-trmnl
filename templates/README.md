# RuuviTRMNL Templates

This directory contains different layout templates for displaying RuuviTag sensor data on TRMNL e-ink displays.

## Template Variants

### 1. Full Layout (`full.html`)

**Best for: Full screen displays**

- Column layout with sensors arranged horizontally
- Extra large temperature values with large humidity
- Center-aligned text for visual balance
- Extra spacing between columns (gap--large)
- Timestamps only shown when sensor quiet for 30+ minutes

### 2. Half Horizontal Layout (`half-horizontal.html`)

**Best for: Half-width displays, side panels**

- Column layout with medium spacing
- Large temperature values with medium humidity
- Compact but readable design
- Status indicators for offline sensors

### 3. Half Vertical Layout (`half-vertical.html`)

**Best for: Half-height displays, narrow screens**

- Column layout optimized for vertical space
- Large temperature with small humidity
- Truncated location names for space efficiency
- Background highlighting for offline sensors

### 4. Quadrant Layout (`quadrant.html`)

**Best for: Quarter-screen displays, dashboard corners**

- Ultra-compact column layout with medium spacing
- Medium temperature with small humidity
- Maximum space efficiency with truncated names
- Essential data only with conditional timestamps

## Key Features

- **Column Layout**: All templates use vertical column arrangement with horizontal sensor distribution
- **Increased Spacing**: More breathing room between columns (gap--medium or gap--large)
- **Font Hierarchy**: Clear size progression from location names through temperature to humidity
- **Center Alignment**: Text centered for better visual balance
- **Conditional Timestamps**: Only shown when sensor has been quiet for 30+ minutes
- **Missing Data Handling**: Shows "-" for temperature/humidity when sensors are offline
- **Status Indicators**: Visual cues for stale/offline sensors
- **No Global Timestamps**: Removed general refresh time displays

## Usage

1. Choose the appropriate template for your display size
2. Copy the template content to your TRMNL plugin
3. The RuuviTRMNL application will automatically send data in the expected format
