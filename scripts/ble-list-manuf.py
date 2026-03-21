import asyncio
from bleak import BleakScanner

async def main():
    devs = await BleakScanner.discover(5.0)
    for d in devs:
        md = getattr(d, "metadata", None) if hasattr(d, "metadata") else None
        manuf = {}
        if isinstance(md, dict):
            manuf = md.get("manufacturer_data") or md.get("manufacturerData") or {}
        if manuf:
            print(d.address, getattr(d, "name", None), manuf)
            if 1177 in manuf or 0x0499 in manuf:
                print("  -> Looks like a Ruuvi tag (company id 1177 / 0x0499)")

if __name__ == "__main__":
    asyncio.run(main())
    