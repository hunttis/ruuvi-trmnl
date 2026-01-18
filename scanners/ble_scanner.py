#!/usr/bin/env python3
"""
scanners/ble_scanner.py

Simple BLE scanner using bleak that prints one JSON object per line for each
advertisement it sees. Manufacturer data is printed as a map of company_id->hex.

Usage:
  pip install bleak
  python3 scanners/ble_scanner.py

This is intentionally minimal so the Node app can consume JSON over stdout.
"""
import asyncio
import json
import sys
from bleak import BleakScanner


def adv_to_payload(device, advertisement):
    md = advertisement.manufacturer_data
    if not md:
        return None

    out = {str(k): v.hex() for k, v in md.items()}
    payload = {
        "address": device.address,
        "name": device.name,
        "rssi": device.rssi,
        "manufacturer_data": out,
        "timestamp": asyncio.get_event_loop().time(),
    }
    return payload


async def run():
    scanner = BleakScanner()
    await scanner.start()
    print(json.dumps({"status": "started"}), flush=True)

    try:
        while True:
            # Poll discovered devices / advertisement data once a second
            devices = await scanner.get_discovered_devices()
            for dev in devices:
                # Bleak's device may or may not expose advertisement data via metadata
                adv = dev.metadata.get("manufacturer_data") if dev.metadata else None
                if not adv:
                    continue
                out = {str(k): v.hex() for k, v in adv.items()}
                payload = {
                    "address": dev.address,
                    "name": dev.name,
                    "rssi": dev.rssi,
                    "manufacturer_data": out,
                    "timestamp": asyncio.get_event_loop().time(),
                }
                print(json.dumps(payload), flush=True)
            await asyncio.sleep(1)
    except asyncio.CancelledError:
        pass
    finally:
        await scanner.stop()


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        sys.exit(0)
