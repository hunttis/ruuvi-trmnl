External BLE scanner prototype

This document explains how to run the external Python BLE scanner and how to connect
it to the Node app.

Requirements (scanner):

- Python 3.8+
- pip install bleak

Run the scanner standalone:

```bash
python3 scanners/ble_scanner.py
```

It will print JSON lines to stdout. Example output:

{"address":"AA:BB:CC:DD:EE:FF","rssi":-56,"manufacturer_data":{"1177":"03021..."},"timestamp":...}

Consume it from Node.js (prototype already included): use `ExternalRuuviScanner` from `src/collectors/external-ruuvi-scanner.ts`.

Example integration (high-level):

```ts
import { ExternalRuuviScanner } from "@/collectors/external-ruuvi-scanner";
import { RuuviCollector } from "@/collectors/ruuvi-collector";

const collector = new RuuviCollector();
const scanner = new ExternalRuuviScanner("python3", "scanners/ble_scanner.py");

scanner.on("payload", (p) => {
  // p.manufacturer_data is a map company_id->hexstring
  // If company id 1177 found, decode payload and send to collector.processExternalReading
  const md = p.manufacturer_data?.["1177"];
  if (!md) return;
  // Decode in Node (or extend to decode in Python). For prototype, forward raw values:
  collector.processExternalReading(p.address, {
    rssi: p.rssi,
    // other fields can be filled after decoding
  });
});

scanner.start();
```

Notes:
- This prototype sends manufacturer_data as hex. You can decode Ruuvi payloads either in Python (using `ruuvitag_sensor`) or in Node (using a JS decoder package).
- The scanner process can be supervised and restarted if it grows in memory; this isolates leaks to the scanner process.
