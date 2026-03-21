import asyncio
from bleak import BleakScanner


def _print_adv(device, adv):
    try:
        md = getattr(adv, "manufacturer_data", None) or getattr(adv, "manufacturerData", None)
        sd = getattr(adv, "service_data", None) or getattr(adv, "serviceData", None)
        suuids = getattr(adv, "service_uuids", None) or getattr(adv, "serviceUuids", None)
        print(f"ADDR={device.address} NAME={getattr(device,'name',None)} RSSI={getattr(device,'rssi',None)}")
        print("  Manufacturer:", md)
        print("  Service Data:", sd)
        print("  Service UUIDs:", suuids)
    except Exception as e:
        print("callback print error:", e)


async def run(duration=10.0):
    # Try constructor-based callback first (older/newer compat), then register_detection_callback,
    # finally fallback to polling discover and printing device attrs.
    def callback(device, adv):
        _print_adv(device, adv)

    try:
        # Some bleak versions accept detection_callback in constructor
        scanner = BleakScanner(detection_callback=callback)
        await scanner.start()
        await asyncio.sleep(duration)
        await scanner.stop()
        return
    except TypeError:
        pass

    try:
        scanner = BleakScanner()
        if hasattr(scanner, "register_detection_callback"):
            scanner.register_detection_callback(callback)
            await scanner.start()
            await asyncio.sleep(duration)
            await scanner.stop()
            return
    except Exception:
        pass

    # Fallback: use discover and print available attrs for inspection
    try:
        devices = await BleakScanner.discover(duration)
        print(f"discover fallback found {len(devices)} device(s)")
        for d in devices:
            print(repr(d))
            # attempt to print any obvious metadata
            md = getattr(d, "metadata", None)
            if md:
                print("  metadata:", md)
            # some backends embed manufacturer data in details
            details = getattr(d, "details", None)
            if details:
                print("  details:", details)
    except Exception as e:
        print("discover fallback failed:", e)


if __name__ == '__main__':
    asyncio.run(run(10.0))
