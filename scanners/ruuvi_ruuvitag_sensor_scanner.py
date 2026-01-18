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

try:
    from ruuvitag_sensor.ruuvi import RuuviTagSensor
except Exception as e:
    print(json.dumps({"error": "failed to import ruuvitag_sensor", "exception": str(e)}))
    sys.exit(1)


def callback(mac, data):
    # data is a dict with decoded fields documented by ruuvitag_sensor
    out = {
        "address": mac,
        "timestamp": time.time(),
        "data": data,
    }
    print(json.dumps(out), flush=True)
    try:
        write_reading_to_cache(mac, data)
    except Exception as e:
        print(json.dumps({"error": "failed to write cache", "exception": str(e)}), flush=True)


import os
import base64


CACHE_FILE = os.path.join(os.getcwd(), "ruuvi-cache.json")


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
    if tag_data.get("rssi") is not None:
        significant["signal"] = tag_data.get("rssi")

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
    # Normalize mac: remove colons, lower
    normalized = mac.replace(":", "").lower()
    short_id = normalized[:8]

    cache = load_cache()
    key = normalized

    # Build data object similar to CacheManager expectations
    tag_data = {
        "id": short_id,
        "name": data.get("name"),
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


def main():
    print(json.dumps({"status": "started"}), flush=True)
    # get_datas will block scanning and call callback for each reading
    # We run it with background=False so it returns only on KeyboardInterrupt
    try:
        RuuviTagSensor.get_datas(callback=callback, background=False)
    except KeyboardInterrupt:
        pass
    except Exception as exc:
        print(json.dumps({"error": "scanner failure", "exception": str(exc)}), flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
