# backend-python/app/core/emotion_ai.py
import os
import warnings

import joblib
import librosa
import numpy as np

warnings.filterwarnings("ignore")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.abspath(os.path.join(BASE_DIR, "../../models/aura_arousal_nn.pkl"))
SCALER_PATH = os.path.abspath(os.path.join(BASE_DIR, "../../models/aura_scaler.pkl"))

classifier = None
scaler = None
try:
    classifier = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
except Exception as e:
    print(f"⚠️ Warning: Model/Scaler not found. Run train_model.py first.")

def _heuristic_result(audio_np: np.ndarray) -> dict:
    if audio_np.size == 0:
        return {"primary": "calm", "arousal_score": 3.0, "confidence": 0.5}

    rms = float(np.sqrt(np.mean(np.square(audio_np))))
    if rms >= 0.075:
        return {"primary": "high_arousal", "arousal_score": 8.0, "confidence": 0.55}
    if rms >= 0.02:
        return {"primary": "sad", "arousal_score": 5.0, "confidence": 0.52}
    return {"primary": "calm", "arousal_score": 3.0, "confidence": 0.6}


def analyze_audio(audio_np: np.ndarray, sample_rate: int = 16000) -> dict:
    if audio_np is None or audio_np.size == 0:
        return {"primary": "calm", "arousal_score": 3.0, "confidence": 0.5}

    audio_np = np.asarray(audio_np, dtype=np.float32).flatten()
    if audio_np.size < int(sample_rate * 0.25):
        return _heuristic_result(audio_np)

    try:
        target_sr = 22050
        if sample_rate != target_sr:
            audio_np = librosa.resample(audio_np, orig_sr=sample_rate, target_sr=target_sr)
            sample_rate = target_sr

        mfccs = librosa.feature.mfcc(y=audio_np, sr=sample_rate, n_mfcc=40)
        mfccs_scaled = np.mean(mfccs.T, axis=0).reshape(1, -1)

        if classifier is None or scaler is None:
            return _heuristic_result(audio_np)

        mfccs_normalized = scaler.transform(mfccs_scaled)
        prediction = int(classifier.predict(mfccs_normalized)[0])
        probabilities = classifier.predict_proba(mfccs_normalized)[0]
        confidence = float(np.max(probabilities))

        arousal_mapping = {
            0: {"label": "high_arousal", "score": 9.0},
            1: {"label": "calm", "score": 3.0},
            2: {"label": "sad", "score": 4.0},
        }
        result = arousal_mapping.get(prediction, {"label": "calm", "score": 3.0})
        return {
            "primary": result["label"],
            "arousal_score": result["score"],
            "confidence": confidence,
        }
    except Exception:
        return _heuristic_result(audio_np)
