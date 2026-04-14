# backend-python/training/build_dataset.py
# ---------------------------------------------------------------
# Crawl RAVDESS, CREMA-D, TESS -> extract 103-dim features -> .npz
# ---------------------------------------------------------------
import os
import sys
import glob
import time
import numpy as np

# Ensure training/ is importable
sys.path.insert(0, os.path.dirname(__file__))
from extract_features import (
    extract_features,
    label_ravdess,
    label_cremad,
    label_tess,
)

DATASETS_DIR = os.path.join(os.path.dirname(__file__), "datasets")
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "aura_features.npz")


def _collect_ravdess():
    """Collect from ravdess/Actor_XX/*.wav  (skip nested duplicate folder)."""
    items = []
    root = os.path.join(DATASETS_DIR, "ravdess")
    for actor_dir in sorted(glob.glob(os.path.join(root, "Actor_*"))):
        # Only top-level Actor_XX folders, skip nested audio_speech_actors_01-24
        if "audio_speech_actors" in actor_dir.lower():
            continue
        for wav in glob.glob(os.path.join(actor_dir, "*.wav")):
            label = label_ravdess(os.path.basename(wav))
            if label:
                items.append((wav, label, "ravdess"))
    return items


def _collect_cremad():
    """Collect from crema-d/*.wav."""
    items = []
    root = os.path.join(DATASETS_DIR, "crema-d")
    for wav in glob.glob(os.path.join(root, "*.wav")):
        label = label_cremad(os.path.basename(wav))
        if label:
            items.append((wav, label, "cremad"))
    return items


def _collect_tess():
    """Collect from tess/<PREFIX>_<emotion>/*.wav."""
    items = []
    root = os.path.join(DATASETS_DIR, "tess")
    for emo_dir in sorted(glob.glob(os.path.join(root, "*"))):
        if not os.path.isdir(emo_dir):
            continue
        folder_name = os.path.basename(emo_dir)
        label = label_tess(folder_name)
        if label is None:
            print(f"  [TESS] Unrecognised folder -- skipping: {folder_name}")
            continue
        for wav in glob.glob(os.path.join(emo_dir, "*.wav")):
            items.append((wav, label, "tess"))
    return items


def main():
    print("=" * 60)
    print(" AuraOS -- Feature Extraction Pipeline")
    print("=" * 60)

    all_items = []

    print("\n[1/3] Scanning RAVDESS ...")
    ravdess = _collect_ravdess()
    print(f"       Found {len(ravdess)} labelled clips")
    all_items.extend(ravdess)

    print("[2/3] Scanning CREMA-D ...")
    cremad = _collect_cremad()
    print(f"       Found {len(cremad)} labelled clips")
    all_items.extend(cremad)

    print("[3/3] Scanning TESS ...")
    tess = _collect_tess()
    print(f"       Found {len(tess)} labelled clips")
    all_items.extend(tess)

    total = len(all_items)
    print(f"\n>> Total clips to process: {total}")

    if total == 0:
        print("ERROR: No audio files found. Check the datasets/ folder structure.")
        return

    # -- Extract features -----------------------------------------------
    X_list, y_list = [], []
    t0 = time.time()
    skipped = 0

    for idx, (wav_path, label, dataset) in enumerate(all_items):
        if (idx + 1) % 200 == 0 or idx == 0:
            elapsed = time.time() - t0
            rate = (idx + 1) / max(elapsed, 0.01)
            eta = (total - idx - 1) / max(rate, 0.01)
            print(f"  [{idx+1}/{total}]  {rate:.1f} clips/s  ETA {eta:.0f}s  -- {dataset}")

        feat = extract_features(wav_path)
        if feat is None:
            skipped += 1
            continue
        X_list.append(feat)
        y_list.append(label)

    elapsed = time.time() - t0
    print(f"\nDONE: Extracted {len(X_list)} feature vectors in {elapsed:.1f}s  ({skipped} skipped)")

    X = np.array(X_list, dtype=np.float32)
    y = np.array(y_list)

    # -- Print class distribution ----------------------------------------
    for cls in ['calm', 'mild_anxiety', 'high_anxiety']:
        count = int(np.sum(y == cls))
        pct = 100 * count / len(y) if len(y) > 0 else 0
        print(f"   {cls:20s}: {count:5d}  ({pct:.1f}%)")

    # -- Save ------------------------------------------------------------
    np.savez_compressed(OUTPUT_FILE, X=X, y=y)
    print(f"\nSaved to {OUTPUT_FILE}  ({X.shape[0]} samples x {X.shape[1]} features)")


if __name__ == "__main__":
    main()
