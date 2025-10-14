# TRMNL Plugin Conversion Plan

## Converting RuuviTag Scanner to TRMNL Plugin

**Project Goal:** Transform the current RuuviTag scanning console application into a TRMNL plugin that displays sensor data on an e-ink display.

---

## Current State Analysis

### Existing Application

- **File:** `src/index.ts`
- **Functionality:** Scans for RuuviTags and logs temperature/humidity data
- **Output Format:** Console logs with format: `[DATA] tagId... | Temp: XX.X°C | Humidity: XX.X%`
- **Dependencies:** `node-ruuvitag` library
- **Data Collected:** Temperature, humidity, tag ID, signal strength, battery, acceleration, etc.

### TRMNL Requirements

- **Display:** 800x480 pixel e-ink, 1-bit grayscale
- **Plugin System:** HTML templates with Liquid templating
- **Data Source:** HTTP API endpoints that TRMNL polls
- **Framework:** Custom CSS framework optimized for e-ink
- **Layouts:** Full, half vertical, half horizontal, quadrant views

---

## Implementation Plan

### **Phase 1: Architecture Understanding & Setup**

**Estimated Time:** 1-2 days

#### Task 1.1: Study TRMNL Plugin Structure

- [ ] Read TRMNL documentation thoroughly
- [ ] Understand Liquid templating system
- [ ] Learn e-ink display constraints and best practices
- [ ] Study CSS framework and layout options
- [ ] Review existing plugin examples

#### Task 1.2: Create Plugin Development Environment

- [ ] Set up TRMNL account with developer access
- [ ] Create basic HTML template structure
- [ ] Set up testing workflow with TRMNL's live preview
- [ ] Test basic plugin functionality

**Deliverables:**

- TRMNL developer account setup
- Basic plugin template working
- Development workflow established

---

### **Phase 2: Data Collection Service**

**Estimated Time:** 2-3 days

#### Task 2.1: Refactor RuuviTag Scanner for Server-Side

- [ ] Convert console app to HTTP server (Express.js)
- [ ] Implement data aggregation and storage
- [ ] Store recent readings from multiple tags in memory/database
- [ ] Add REST endpoints for TRMNL to consume
- [ ] Handle multiple RuuviTag data simultaneously

#### Task 2.2: Design Data Structure

- [ ] Create JSON API format for TRMNL consumption
- [ ] Define data schema: tag ID, temperature, humidity, timestamp, signal strength
- [ ] Implement data filtering and tag selection logic
- [ ] Add error handling for missing/stale data
- [ ] Create configuration for tag aliases/friendly names

**Example API Response:**

```json
{
  "tags": [
    {
      "id": "a06bd66b",
      "name": "Living Room",
      "temperature": 22.6,
      "humidity": 36.2,
      "signal": -80,
      "battery": 2.45,
      "lastUpdated": "2025-10-13T13:08:23.693Z",
      "status": "active"
    }
  ],
  "lastRefresh": "2025-10-13T13:08:25.000Z",
  "totalTags": 3
}
```

**Deliverables:**

- HTTP API server (`src/api-server.ts`)
- JSON endpoints for tag data
- Data aggregation logic
- Error handling and fallbacks

---

### **Phase 3: TRMNL Plugin Development**

**Estimated Time:** 2-3 days

#### Task 3.1: Create Plugin Template

- [ ] Design e-ink friendly layout for RuuviTag data
- [ ] Create responsive design for different view sizes
- [ ] Implement templates for 1, 2, or multiple RuuviTag display
- [ ] Add visual hierarchy and readability optimization
- [ ] Test with TRMNL's CSS framework

#### Task 3.2: Implement Dynamic Content

- [ ] Use Liquid templating for data interpolation
- [ ] Add conditional display logic (show/hide based on data availability)
- [ ] Format temperature/humidity values appropriately
- [ ] Implement data freshness indicators
- [ ] Add error state displays (no data, connection issues)

**Plugin Layouts to Create:**

1. **Full View:** All discovered tags in grid layout
2. **Half View:** 2-3 selected tags with detailed info
3. **Quadrant View:** Single tag with large temperature display

**Deliverables:**

- HTML template files
- Liquid template variables
- CSS customizations
- Multiple layout options

---

### **Phase 4: Integration & Polish**

**Estimated Time:** 1-2 days

#### Task 4.1: HTTP Service Integration

- [ ] Deploy data service (local server or cloud hosting)
- [ ] Configure TRMNL plugin to poll your service
- [ ] Implement proper error handling and fallbacks
- [ ] Set up appropriate polling intervals
- [ ] Test end-to-end data flow

#### Task 4.2: User Experience Enhancement

- [ ] Add configuration options (which tags to display, refresh intervals)
- [ ] Create multiple layout options (compact vs detailed view)
- [ ] Add visual indicators for data freshness and connectivity
- [ ] Implement tag selection/filtering
- [ ] Add friendly tag naming system

**Configuration Options:**

- Selected tag IDs to display
- Refresh interval (5min, 15min, 30min)
- Temperature units (C/F)
- Layout preference
- Tag aliases/friendly names

**Deliverables:**

- Deployed API service
- Complete TRMNL plugin
- Configuration interface
- Error handling and fallbacks

---

### **Phase 5: Testing & Deployment**

**Estimated Time:** 1 day

#### Task 5.1: Testing & Optimization

- [ ] Test with real RuuviTags and TRMNL device
- [ ] Optimize for e-ink display characteristics
- [ ] Test different error scenarios (no tags found, network issues)
- [ ] Performance testing and optimization
- [ ] User acceptance testing

#### Task 5.2: Documentation & Sharing

- [ ] Create setup documentation
- [ ] Write installation/configuration guide
- [ ] Consider publishing to TRMNL marketplace
- [ ] Add troubleshooting guide
- [ ] Create README with screenshots

**Deliverables:**

- Complete documentation
- Installation guide
- Tested and deployed plugin
- Optional: Marketplace submission

---

## Technical Architecture

### Data Flow

```
RuuviTags (BLE) → Node.js Scanner → HTTP API Server → TRMNL Plugin → E-ink Display
```

### File Structure

```
ruuvi-trmnl/
├── src/
│   ├── index.ts              # Original scanner (keep for reference)
│   ├── api-server.ts         # HTTP API server
│   ├── ruuvi-collector.ts    # RuuviTag data collection logic
│   └── types/
│       └── api.ts            # API response types
├── trmnl-plugin/
│   ├── template-full.html    # Full layout template
│   ├── template-half.html    # Half layout template
│   └── template-quad.html    # Quadrant layout template
├── docs/
│   ├── setup.md              # Setup instructions
│   └── configuration.md      # Configuration guide
└── package.json
```

### Technology Stack

- **Backend:** Node.js + TypeScript + Express.js
- **RuuviTag Interface:** node-ruuvitag library
- **TRMNL Plugin:** HTML + Liquid templating + TRMNL CSS framework
- **Data Storage:** In-memory with optional file persistence
- **Deployment:** Local server or cloud (Heroku, Railway, etc.)

---

## Key Considerations

### E-ink Display Constraints

- Black and white only (no grayscale)
- 800x480 resolution
- Slow refresh rate (optimize for minimal updates)
- High contrast design required
- Text readability paramount

### RuuviTag Data Management

- Handle intermittent connections
- Aggregate data over time
- Provide meaningful error states
- Support multiple tags simultaneously
- Battery level monitoring

### TRMNL Integration

- Polling intervals (don't overwhelm the API)
- Error handling for network issues
- Configuration through TRMNL interface
- Responsive design for different layouts

---

## Success Criteria

1. **Functional:** Plugin successfully displays RuuviTag data on TRMNL device
2. **Reliable:** Handles network issues and tag connectivity gracefully
3. **User-Friendly:** Easy setup and configuration process
4. **Performant:** Efficient data collection and API responses
5. **Maintainable:** Clean code structure and documentation
6. **Extensible:** Easy to add new features or support more tags

---

## Next Steps

**Immediate:** Start with Phase 2 (Data Collection Service) as this is the foundation for everything else.

**Priority Order:**

1. Phase 2: Create HTTP API server
2. Phase 3: Basic TRMNL plugin template
3. Phase 4: Integration and testing
4. Phase 1 & 5: Refinement and documentation

---

_Last Updated: October 13, 2025_
_Project Status: Planning Complete - Ready for Implementation_
