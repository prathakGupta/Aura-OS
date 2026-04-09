# backend-python/training/train_model.py
import os
import warnings

import joblib
import librosa
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split

warnings.filterwarnings("ignore")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(BASE_DIR, "dataset")
MODEL_DIR = os.path.join(BASE_DIR, "../models")
MODEL_SAVE_PATH = os.path.join(MODEL_DIR, "aura_arousal_rf.pkl")


def extract_features(file_path):
    """
    Extract Mel-Frequency Cepstral Coefficients (MFCCs) from an audio file.
    """
    try:
        audio, sample_rate = librosa.load(file_path, sr=22050, duration=3.0)
        mfccs = librosa.feature.mfcc(y=audio, sr=sample_rate, n_mfcc=40)
        mfccs_scaled = np.mean(mfccs.T, axis=0)
        return mfccs_scaled
    except Exception as exc:
        print(f"Warning: Error parsing {file_path}: {exc}")
        return None


def train():
    print("Starting AuraOS training pipeline (TESS dataset)...")

    features = []
    labels = []

    if not os.path.exists(DATASET_PATH):
        print(f"Error: Dataset folder not found at {DATASET_PATH}")
        return

    valid_labels = ["high_arousal", "calm", "sad"]

    for label in valid_labels:
        folder_path = os.path.join(DATASET_PATH, label)
        if not os.path.exists(folder_path):
            print(f"Warning: Skipping '{label}' - folder not found.")
            continue

        print(f"Extracting features from '{label}'...")
        file_count = 0

        for file_name in os.listdir(folder_path):
            if file_name.endswith(".wav"):
                file_path = os.path.join(folder_path, file_name)
                data = extract_features(file_path)

                if data is not None:
                    features.append(data)
                    labels.append(label)
                    file_count += 1

        print(f"Processed {file_count} files for '{label}'.")

    X = np.array(features)
    y = np.array(labels)

    if len(X) == 0:
        print("Error: No valid audio files processed. Check dataset folders.")
        return

    print(f"Training Random Forest model on {len(X)} total audio samples...")

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
    )

    model = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    model.fit(X_train, y_train)

    print("Model evaluation:")
    predictions = model.predict(X_test)
    acc = accuracy_score(y_test, predictions)
    print(f"Final accuracy: {acc * 100:.2f}%")
    print(classification_report(y_test, predictions))

    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(model, MODEL_SAVE_PATH)
    print(f"Success: model saved to {MODEL_SAVE_PATH}")


if __name__ == "__main__":
    train()
