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
