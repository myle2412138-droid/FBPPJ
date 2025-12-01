#!/usr/bin/env python3
"""
Update all report JSON files in `results/` to include a `tumor_count` field.
Logic:
 - If report contains `detections` (list of frames with boxes), count total boxes.
 - Else if report contains `detected_frames`, use its length.
 - Else set tumor_count = 0.

Usage:
  python scripts\update_reports_tumor_count.py

This script will overwrite the existing report files in-place and print a summary.
"""
import os
import json

RESULTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'results')

if __name__ == '__main__':
    if not os.path.isdir(RESULTS_DIR):
        print('Results directory not found:', RESULTS_DIR)
        raise SystemExit(1)

    files = [f for f in os.listdir(RESULTS_DIR) if f.endswith('_report.json')]
    if not files:
        print('No report JSON files found in', RESULTS_DIR)
        raise SystemExit(0)

    updated = 0
    for fn in files:
        path = os.path.join(RESULTS_DIR, fn)
        try:
            with open(path, 'r', encoding='utf-8') as fh:
                data = json.load(fh)
        except Exception as e:
            print('Failed to read', fn, '->', e)
            continue

        # Determine tumor_count
        tumor_count = None
        if 'detections' in data and isinstance(data['detections'], list):
            # detections: list of {frame_index, boxes: [..]}
            total = 0
            for d in data['detections']:
                boxes = d.get('boxes') if isinstance(d, dict) else None
                if isinstance(boxes, list):
                    total += len(boxes)
            tumor_count = total
        elif 'tumor_count' in data:
            tumor_count = data['tumor_count']
        elif 'detected_frames' in data and isinstance(data['detected_frames'], list):
            # fallback: use number of saved detected frame images
            tumor_count = len(data['detected_frames'])
        else:
            tumor_count = 0

        # Update if missing or different
        if data.get('tumor_count') != tumor_count:
            data['tumor_count'] = tumor_count
            try:
                with open(path, 'w', encoding='utf-8') as fh:
                    json.dump(data, fh, ensure_ascii=False, indent=2)
                updated += 1
                print('Updated', fn, '-> tumor_count =', tumor_count)
            except Exception as e:
                print('Failed to write', fn, '->', e)

    print('\nDone. Updated', updated, 'files out of', len(files))
