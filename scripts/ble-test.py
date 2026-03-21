import asyncio
import importlib
from bleak import BleakScanner

def bleak_version():
    try:
        import bleak
        return getattr(bleak, "__version__", None) or importlib.metadata.version("bleak")
    except Exception:
        return "unknown"

async def main():
    print("bleak version:", bleak_version())
    devices = await BleakScanner.discover(5.0)
    print(f"found {len(devices)} device(s)")
    for d in devices:
        rssi = getattr(d, "rssi", None)
        name = getattr(d, "name", None)
        md = getattr(d, "metadata", None) if hasattr(d, "metadata") else None
        # Try various metadata shapes for manufacturer data
        manuf = {}
        if isinstance(md, dict):
            manuf = md.get("manufacturer_data") or md.get("manufacturerData") or {}
        print(d.address, name, rssi, "manufacturer_keys=", ",".join(str(k) for k in (manuf.keys() if isinstance(manuf, dict) else [])))

if __name__ == "__main__":
    asyncio.run(main())
    