External BLE scanner prototype

This document explains how to run the external Python BLE scanner and how to connect
it to the Node app.

Requirements (scanner):

- Python 3.8+
- Install Python dependencies:

```bash
python3 -m pip install ruuvitag_sensor bleak
```

Run the scanner standalone (decoded Ruuvi payloads):

```bash
python3 scanners/ruuvi_ruuvitag_sensor_scanner.py
```

It will print decoded JSON lines to stdout. Example output:

```json
{
  "address": "AA:BB:CC:DD:EE:FF",
  "timestamp": 1670000000.0,
  "data": {
    "temperature": 22.1,
    "humidity": 45.0,
    "pressure": 1013.2,
    "battery": 3.05,
    "rssi": -56,
    "accelerationX": 0.0,
    "accelerationY": 0.0,
    "accelerationZ": 0.0
  }
}
```

Consume it from Node.js using `ExternalRuuviScanner` from `src/collectors/external-ruuvi-scanner.ts`.

Example integration (high-level):

```ts
import { ExternalRuuviScanner } from "@/collectors/external-ruuvi-scanner";
import { RuuviCollector } from "@/collectors/ruuvi-collector";

const collector = new RuuviCollector();
// Use the ruuvi_sensor-backed script which outputs decoded data
const scanner = new ExternalRuuviScanner(
  "python3",
  "scanners/ruuvi_ruuvitag_sensor_scanner.py"
);

scanner.on("payload", (p) => {
  // p.data is a decoded object from ruuvitag_sensor
  if (!p.data) return;
  collector.processExternalReading(p.address, {
    temperature: p.data["temperature"] ?? undefined,
    humidity: p.data["humidity"] ?? undefined,
    pressure: p.data["pressure"] ?? undefined,
    battery: p.data["battery"] ?? undefined,
    rssi: p.data["rssi"] ?? undefined,
    accelerationX: p.data["accelerationX"] ?? undefined,
    accelerationY: p.data["accelerationY"] ?? undefined,
    accelerationZ: p.data["accelerationZ"] ?? undefined,
  });
});

scanner.start();
```

Notes:

- This script uses `ruuvitag_sensor` to decode manufacturer payloads so the Node app receives ready-to-use fields.
- The scanner process can be supervised and restarted if it grows in memory; this isolates leaks to the scanner process.
