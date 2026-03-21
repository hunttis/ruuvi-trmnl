#!/usr/bin/env python3
"""Decode a Ruuvi manufacturer payload hex string using ruuvitag_sensor decoder.

Usage:
  .venv/bin/python3 scripts/decode-ruuvi.py --hex 05fbf9...
"""
import argparse
import sys
try:
    from ruuvitag_sensor.decoder import get_decoder
except Exception as e:
    print("Error: failed to import ruuvitag_sensor.decoder:", e, file=sys.stderr)
    sys.exit(2)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--hex", "-x", required=True, help="Hex string of manufacturer payload (no 0x)")
    args = p.parse_args()

    hexstr = args.hex.strip().lower()
    if hexstr.startswith("0x"):
        hexstr = hexstr[2:]
    if len(hexstr) < 2:
        print("Invalid hex string", file=sys.stderr)
        sys.exit(2)

    try:
        fmt = int(hexstr[:2], 16)
        decoder = get_decoder(fmt)
        decoded = decoder.decode_data(hexstr)
        print("decoded:", decoded)
    except Exception as e:
        print("decode failed:", e, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
