#!/usr/bin/env python3
"""Discover BLE devices (Bleak) and decode Ruuvi manufacturer payloads (company id 1177).

Usage:
  .venv/bin/python3 scripts/bleak-decode-discover.py
"""
import asyncio
import sys

try:
    from bleak import BleakScanner
except Exception as e:
    print("Error: failed to import bleak:", e, file=sys.stderr)
    sys.exit(2)

try:
    from ruuvitag_sensor.decoder import get_decoder
except Exception as e:
    print("Error: failed to import ruuvitag_sensor.decoder:", e, file=sys.stderr)
    sys.exit(2)


def extract_manufacturer_map(dev):
    # Try several common locations used by different Bleak backends
    adv = None
    try:
        if hasattr(dev, "metadata") and isinstance(dev.metadata, dict):
            adv = dev.metadata.get("manufacturer_data") or dev.metadata.get("manufacturerData")
    except Exception:
        adv = None

    if not adv and hasattr(dev, "details") and isinstance(getattr(dev, "details"), dict):
        adv = dev.details.get("manufacturer_data") or dev.details.get("manufacturerData")

    if not adv and hasattr(dev, "manufacturer_data"):
        adv = getattr(dev, "manufacturer_data")

    if not adv and hasattr(dev, "advertisement_data"):
        ad = getattr(dev, "advertisement_data")
        try:
            if isinstance(ad, dict):
                adv = ad.get("manufacturer_data")
            else:
                adv = getattr(ad, "manufacturer_data", None)
        except Exception:
            adv = None

    return adv or {}


async def main(duration=5.0):
    devices = await BleakScanner.discover(duration)
    found = 0
    for d in devices:
        name = getattr(d, "name", None) or ""
        manuf = extract_manufacturer_map(d)
        printed = False

        # If device name suggests Ruuvi, report it and attempt decoding of any payloads
        if "ruuvi" in (name or "").lower():
            print(f"{d.address} NAME={name} (name indicates Ruuvi)")
            printed = True

        # If manufacturer data exists, decode any entries (prefer 1177)
        if manuf:
            for comp, raw in list(manuf.items()):
                try:
                    h = raw.hex()
                    fmt = int(h[:2], 16) if len(h) >= 2 else None
                    decoded = None
                    if fmt is not None:
                        try:
                            decoded = get_decoder(fmt).decode_data(h)
                        except Exception as e:
                            decoded = f"decoder error: {e}"

                    if comp in (1177, 0x0499):
                        print(f"{d.address} Ruuvi manufacturer {comp} decoded: {decoded}")
                        found += 1
                    else:
                        # Print other manufacturer entries; if name indicated Ruuvi, still try decoding
                        print(f"{d.address} manufacturer {comp}: {h} decoded: {decoded}")
                        if "ruuvi" in (name or "").lower() and decoded:
                            found += 1
                except Exception as e:
                    print(f"{d.address} manuf parse error: {e}")

        # Also inspect service_data if present and try to decode
        svc = getattr(d, "service_data", None) or getattr(d, "serviceData", None)
        if not svc and hasattr(d, "metadata") and isinstance(d.metadata, dict):
            svc = d.metadata.get("service_data") or d.metadata.get("serviceData")
        if svc:
            for k, v in list(svc.items()):
                try:
                    raw = v
                    h = raw.hex() if isinstance(raw, (bytes, bytearray)) else str(raw)
                    print(f"{d.address} service {k}: {h}")
                except Exception:
                    pass

        # If name indicates Ruuvi but no manuf/service data decoded, print a simple line
        if "ruuvi" in (name or "").lower() and not printed and not manuf:
            print(f"{d.address} NAME={name} (no manufacturer/service data visible)")

    if found == 0:
        print("No Ruuvi manufacturer entries decoded")


if __name__ == "__main__":
    asyncio.run(main())
