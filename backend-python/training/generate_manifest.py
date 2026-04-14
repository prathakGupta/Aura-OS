import os
import glob
import numpy as np
import joblib
from extract_features import extract_features, DatasetLabeler

DATASETS_ROOT = "backend-python/training/datasets"
OUTPUT_FILE = "backend-python/training/preprocessed_features.joblib"

def generate_manifest():
    print(f"🚀 Starting Feature Extraction & Manifest Generation...")
    print(f"📂 Root Directory: {DATASETS_ROOT}")
    
    X = []
    y = []
    metadata = []
    
    labeler = DatasetLabeler()
    
    # 1. Process RAVDESS
    ravdess_files = glob.glob(os.path.join(DATASETS_ROOT, "ravdess/Actor_*/*.wav"))
    print(f"🔍 Found {len(ravdess_files)} RAVDESS files...")
    for f in ravdess_files:
        label = labeler.get_ravdess_label(os.path.basename(f))
        if label:
            feat = extract_features(f)
            if feat is not None:
                X.append(feat)
                y.append(label)
                metadata.append({'path': f, 'dataset': 'ravdess'})
                
    # 2. Process CREMA-D
    cremad_files = glob.glob(os.path.join(DATASETS_ROOT, "crema-d/*.wav"))
    print(f"🔍 Found {len(cremad_files)} CREMA-D files...")
    for f in cremad_files:
        label = labeler.get_cremad_label(os.path.basename(f))
        if label:
            feat = extract_features(f)
            if feat is not None:
                X.append(feat)
                y.append(label)
                metadata.append({'path': f, 'dataset': 'crema-d'})
                
    # 3. Process TESS
    tess_folders = glob.glob(os.path.join(DATASETS_ROOT, "tess/*_*"))
    print(f"🔍 Found {len(tess_folders)} TESS folders...")
    for folder in tess_folders:
        label = labeler.get_tess_label(os.path.basename(folder))
        if label:
            files = glob.glob(os.path.join(folder, "*.wav"))
            for f in files:
                feat = extract_features(f)
                if feat is not None:
                    X.append(feat)
                    y.append(label)
                    metadata.append({'path': f, 'dataset': 'tess'})
                    
    if not X:
        print("❌ No features extracted. Ensure datasets are downloaded and structure is correct.")
        return

    print(f"✅ Successfully extracted features for {len(X)} samples.")
    
    data = {
        'X': np.array(X),
        'y': np.array(y),
        'metadata': metadata,
        'feature_names': [
            "mfcc_mean_0_39", "mfcc_std_0_39", "f0_mean", "f0_std", "rms", "zcr",
            "spec_centroid", "spec_bw", "spec_rolloff", "chroma_0_11", "jitter", "shimmer", "hnr"
        ]
    }
    
    joblib.dump(data, OUTPUT_FILE)
    print(f"💾 Saved preprocessed data to {OUTPUT_FILE}")

if __name__ == "__main__":
    generate_manifest()
