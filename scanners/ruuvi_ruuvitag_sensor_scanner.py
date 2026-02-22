#!/usr/bin/env python3
"""
scanners/ruuvi_ruuvitag_sensor_scanner.py

Scanner that uses the ruuvitag_sensor library to decode RuuviTag advertisements
and prints one JSON object per line with decoded fields (temperature, humidity,
pressure, battery, rssi, acceleration, etc.).

Requirements:
  python3 -m pip install ruuvitag_sensor

Usage:
  python3 scanners/ruuvi_ruuvitag_sensor_scanner.py

This script uses a callback-based API provided by ruuvitag_sensor and prints
decoded JSON objects to stdout so the Node app can consume them via IPC.
"""
import json
import sys
import time
import os
import base64
import asyncio
import traceback
import atexit
import re

try:
    from ruuvitag_sensor.ruuvi import RuuviTagSensor
    # Also import decoder helper for fallback decoding
    from ruuvitag_sensor.decoder import get_decoder
    # Import Bleak here so fallback can use it when get_data_async yields nothing
    try:
        from bleak import BleakScanner
    except Exception:
        BleakScanner = None
except Exception as e:
    print(json.dumps({"error": "failed to import ruuvitag_sensor", "exception": str(e)}))
    sys.exit(1)


def make_serializable(obj):
    """Recursively convert objects into JSON-serializable forms for logging."""
    if isinstance(obj, dict):
        return {k: make_serializable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [make_serializable(v) for v in obj]
    if isinstance(obj, (int, float, str, bool)) or obj is None:
        return obj
    try:
        return str(obj)
    except Exception:
        return repr(obj)


def callback(mac, data):
    try:
        # Ensure data is JSON serializable using shared helper
        serializable_data = make_serializable(data)
        
        # data is a dict with decoded fields documented by ruuvitag_sensor
        out = {
            "address": mac,
            "timestamp": time.time(),
            "data": serializable_data,
        }
        print(json.dumps(out), flush=True)
        try:
            write_reading_to_cache(mac, data)
        except Exception as e:
            print(json.dumps({"error": "failed to write cache", "exception": str(e)}), flush=True)
    except Exception as e:
        print(json.dumps({"error": "callback failed", "mac": mac, "exception": str(e), "traceback": traceback.format_exc()}), flush=True)
        # Don't exit the entire process on a single callback failure; log and continue
        return

CACHE_FILE = os.path.join(os.getcwd(), "ruuvi-cache.json")
PID_FILE = os.path.join(os.getcwd(), "ruuvi-scanner.pid")
CONFIG_FILE = os.path.join(os.getcwd(), "config.json")

# Cached config-derived maps
_ALIAS_MAP = {}
_ALLOWED_SHORT_IDS = None


def load_config():
    """Load `config.json` and build alias map and allowed short id set.

    Alias map entries are keyed by both full normalized id and short id.
    """
    global _ALIAS_MAP, _ALLOWED_SHORT_IDS
    try:
        if not os.path.exists(CONFIG_FILE):
            _ALIAS_MAP = {}
            _ALLOWED_SHORT_IDS = None
            return
        with open(CONFIG_FILE, "r", encoding="utf8") as f:
            cfg = json.load(f)
        ruuvi = cfg.get("ruuvi", {})
        tag_aliases = ruuvi.get("tagAliases") or {}
        _ALIAS_MAP = {}
        allowed = set()
        for k, v in tag_aliases.items():
            norm = re.sub(r"[^0-9a-fA-F]", "", str(k)).lower()
            short = norm[:8]
            _ALIAS_MAP[norm] = v
            _ALIAS_MAP[short] = v
            allowed.add(short)
        _ALLOWED_SHORT_IDS = allowed if len(allowed) > 0 else None
    except Exception:
        _ALIAS_MAP = {}
        _ALLOWED_SHORT_IDS = None


def generate_data_hash(tag_data: dict) -> str:
    # Mirror CacheManager.generateDataHash rounding rules
    def round_if(v, mult):
        if v is None:
            return None
        return round(v * mult) / mult

    significant = {
        "temperature": None,
        "humidity": None,
        "pressure": None,
        "battery": None,
        "signal": None,
        "status": tag_data.get("status"),
    }

    if tag_data.get("temperature") is not None:
        significant["temperature"] = round_if(tag_data.get("temperature"), 10)
    if tag_data.get("humidity") is not None:
        significant["humidity"] = round_if(tag_data.get("humidity"), 10)
    if tag_data.get("pressure") is not None:
        significant["pressure"] = round_if(tag_data.get("pressure"), 100)
    if tag_data.get("battery") is not None:
        significant["battery"] = round_if(tag_data.get("battery"), 100)
    # Support both 'rssi' and 'signal' keys (older vs newer naming)
    if tag_data.get("rssi") is not None:
        significant["signal"] = tag_data.get("rssi")
    elif tag_data.get("signal") is not None:
        significant["signal"] = tag_data.get("signal")

    s = json.dumps(significant, separators=(",", ":"))
    return base64.b64encode(s.encode("utf-8")).decode("ascii")


def load_cache():
    if not os.path.exists(CACHE_FILE):
        return {"version": "1.0.0", "lastUpdated": None, "cache": {}}
    try:
        with open(CACHE_FILE, "r", encoding="utf8") as f:
            return json.load(f)
    except Exception:
        return {"version": "1.0.0", "lastUpdated": None, "cache": {}}


def save_cache(cache_obj: dict):
    cache_obj["lastUpdated"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    with open(CACHE_FILE, "w", encoding="utf8") as f:
        json.dump(cache_obj, f, indent=2, ensure_ascii=False)


def write_reading_to_cache(mac: str, data: dict):
    # Normalize mac: keep only hex digits and lowercase
    normalized = re.sub(r"[^0-9a-fA-F]", "", str(mac)).lower()
    short_id = normalized[:8]
    # Ensure config aliases/allowed tags are loaded
    if not _ALIAS_MAP:
        load_config()

    # If config contains tag aliases, only save readings for allowed tags
    # You can force writing all detected tags for debugging by setting
    # environment variable `RUUVI_WRITE_ALL=1`.
    if _ALLOWED_SHORT_IDS is not None and short_id not in _ALLOWED_SHORT_IDS:
        if os.environ.get("RUUVI_WRITE_ALL", "0") not in ("1", "true", "yes"):
            return

    cache = load_cache()
    key = normalized

    # Build data object similar to CacheManager expectations
    # Use configured alias if available, otherwise use reported name
    alias_name = _ALIAS_MAP.get(normalized) or _ALIAS_MAP.get(short_id)
    tag_data = {
        "id": short_id,
        "name": alias_name or data.get("name"),
        "lastUpdated": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "status": "active",
    }

    # Map known fields if present
    if data.get("temperature") is not None:
        tag_data["temperature"] = data.get("temperature")
        tag_data["lastTemperatureUpdate"] = tag_data["lastUpdated"]
    if data.get("humidity") is not None:
        tag_data["humidity"] = data.get("humidity")
    if data.get("pressure") is not None:
        # ruuvitag_sensor reports pressure in hPa; CacheManager expects hPa
        tag_data["pressure"] = data.get("pressure")
    if data.get("battery") is not None:
        tag_data["battery"] = data.get("battery")
    if data.get("rssi") is not None:
        tag_data["signal"] = data.get("rssi")
    if data.get("acceleration") is not None:
        acc = data.get("acceleration")
        tag_data["accelerationX"] = acc.get("x") if isinstance(acc, dict) else None
        tag_data["accelerationY"] = acc.get("y") if isinstance(acc, dict) else None
        tag_data["accelerationZ"] = acc.get("z") if isinstance(acc, dict) else None

    entry = cache.get("cache", {})
    existing = entry.get(key)
    last_sent = None
    if existing and isinstance(existing, dict):
        last_sent = existing.get("lastSent")

    new_entry = {
        "data": tag_data,
        "hash": generate_data_hash(tag_data),
    }
    if last_sent:
        new_entry["lastSent"] = last_sent

    entry[key] = new_entry
    cache["cache"] = entry
    save_cache(cache)


# `asyncio`, `traceback`, and other stdlib imports moved to top to
# ensure they are available to callbacks defined earlier in the file.


def check_bluetooth_permissions():
    """Check if Bluetooth is available and accessible"""
    try:
        import asyncio
        from bleak import BleakScanner
        
        async def test_ble():
            try:
                print(json.dumps({"debug": "testing Bluetooth availability"}), flush=True)
                scanner = BleakScanner()
                await scanner.start()
                await asyncio.sleep(1)
                await scanner.stop()
                print(json.dumps({"debug": "Bluetooth test successful"}), flush=True)
                return True
            except Exception as e:
                print(json.dumps({"error": "Bluetooth test failed", "exception": str(e)}), flush=True)
                return False
        
        return asyncio.run(test_ble())
    except Exception as e:
        print(json.dumps({"error": "Failed to import bleak for Bluetooth test", "exception": str(e)}), flush=True)
        return False


def main():
    print(json.dumps({"status": "started"}), flush=True)
    # Write PID file so external supervisors (like the Node app) can detect
    # whether this scanner is running.
    try:
        with open(PID_FILE, "w", encoding="utf8") as pf:
            pf.write(str(os.getpid()))
    except Exception:
        pass

    def _cleanup_pid():
        try:
            if os.path.exists(PID_FILE):
                os.remove(PID_FILE)
        except Exception:
            pass

    atexit.register(_cleanup_pid)
    # Load config now so we know which tags are configured/allowed
    load_config()

    # Check Bluetooth permissions first
    if not check_bluetooth_permissions():
        print(json.dumps({"error": "Bluetooth not available or permission denied"}), flush=True)
        sys.exit(1)
    
    # Use async generator for macOS compatibility
    async def run_scanner():
        print(json.dumps({"debug": "starting bleak detection-callback scanner"}), flush=True)

        # Primary approach: use Bleak detection callbacks to capture raw adverts
        # and decode Ruuvi manufacturer data directly. This is more reliable on
        # some macOS backends than the high-level ruuvitag_sensor async iterator.
        try:
            def _process_adv(device, adv):
                try:
                    # Normalize advertisement/manufacturer map across backends
                    adv_map = None
                    try:
                        adv_map = getattr(adv, "manufacturer_data", None) or getattr(adv, "manufacturerData", None)
                    except Exception:
                        adv_map = None

                    if not adv_map:
                        md = getattr(device, "metadata", None) or getattr(device, "details", None)
                        if isinstance(md, dict):
                            adv_map = md.get("manufacturer_data") or md.get("manufacturerData")

                    if not adv_map and hasattr(device, "manufacturer_data"):
                        adv_map = getattr(device, "manufacturer_data")

                    if not adv_map:
                        return

                    for comp, rawbytes in list(adv_map.items()):
                        try:
                            # Only attempt decoding for Ruuvi company id (1177) or when
                            # the device name contains "ruuvi" — this avoids trying to
                            # decode unrelated vendor blobs that use different formats
                            dev_name = (getattr(device, "name", None) or "").lower()
                            if comp not in (1177, 0x0499) and "ruuvi" not in dev_name:
                                continue

                            hexstr = rawbytes.hex()
                            if not hexstr:
                                continue

                            # Basic length guard for common Ruuvi formats
                            # Format 5 requires 24 bytes -> 48 hex chars
                            fmt = int(hexstr[:2], 16) if len(hexstr) >= 2 else None
                            if fmt == 5 and len(hexstr) < 48:
                                continue

                            data_type = fmt
                            decoder = get_decoder(data_type)
                            decoded = decoder.decode_data(hexstr)
                            if decoded:
                                mac_to_use = decoded.get("mac") or getattr(device, "address", None)
                                print(json.dumps({"debug": "fallback_decoded", "mac": mac_to_use, "decoded": make_serializable(decoded)}), flush=True)
                                try:
                                    callback(mac_to_use, decoded)
                                except Exception as e:
                                    print(json.dumps({"error": "callback failed in detection callback", "exception": str(e)}), flush=True)
                        except Exception:
                            # swallow errors silently to avoid noisy stack traces
                            continue
                except Exception as e:
                    print(json.dumps({"error": "processing advert failed", "exception": str(e)}), flush=True)

            # Try to create a BleakScanner with a detection callback, falling
            # back to register_detection_callback when needed.
            used_scanner = None
            try:
                scanner = BleakScanner(detection_callback=_process_adv)
                used_scanner = scanner
            except TypeError:
                scanner = BleakScanner()
                if hasattr(scanner, "register_detection_callback"):
                    scanner.register_detection_callback(_process_adv)
                    used_scanner = scanner

            if used_scanner:
                await used_scanner.start()
                # Keep running and let the callback handle incoming adverts
                while True:
                    await asyncio.sleep(0.5)
            else:
                # If Bleak callbacks aren't available for some reason, fall back
                # to the ruuvitag_sensor async iterator as a secondary option.
                print(json.dumps({"debug": "Bleak callbacks unavailable, using ruuvitag_sensor.get_data_async fallback"}), flush=True)
                async for mac, data in RuuviTagSensor.get_data_async():
                    try:
                        callback(mac, data)
                    except Exception as callback_exc:
                        print(json.dumps({"error": "callback failed", "mac": mac, "exception": str(callback_exc), "traceback": traceback.format_exc()}), flush=True)

        except Exception as exc:
            print(json.dumps({"error": "scanner main loop failed", "exception": str(exc), "traceback": traceback.format_exc()}), flush=True)
    
    try:
        print(json.dumps({"debug": "calling asyncio.run"}), flush=True)
        asyncio.run(run_scanner())
    except KeyboardInterrupt:
        print(json.dumps({"debug": "received keyboard interrupt"}), flush=True)
        pass
    except Exception as exc:
        print(json.dumps({"error": "scanner failure", "exception": str(exc), "traceback": traceback.format_exc()}), flush=True)
        # Don't exit - let the supervisor handle restarts


if __name__ == "__main__":
    main()
