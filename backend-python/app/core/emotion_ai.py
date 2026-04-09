# backend-python/app/core/emotion_ai.py
import os
import tempfile
import librosa
import numpy as np
import joblib
import warnings

warnings.filterwarnings("ignore")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.abspath(os.path.join(BASE_DIR, "../../models/aura_arousal_nn.pkl"))
SCALER_PATH = os.path.abspath(os.path.join(BASE_DIR, "../../models/aura_scaler.pkl"))

try:
    classifier = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
except Exception as e:
    print(f"⚠️ Warning: Model/Scaler not found. Run train_model.py first.")

def analyze_audio(audio_bytes: bytes) -> dict:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        audio, sr = librosa.load(tmp_path, sr=22050, duration=3.0)
        mfccs = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=40)
        mfccs_scaled = np.mean(mfccs.T, axis=0).reshape(1, -1)
        
        # Scale the live audio
        mfccs_normalized = scaler.transform(mfccs_scaled)
        
        prediction = classifier.predict(mfccs_normalized)[0]
        probabilities = classifier.predict_proba(mfccs_normalized)[0]
        confidence = float(np.max(probabilities))
        
        arousal_mapping = {
            0: {"label": "high_arousal", "score": 9.0}, 
            1: {"label": "calm", "score": 3.0},         
            2: {"label": "sad", "score": 2.0}           
        }
        
        result = arousal_mapping.get(prediction, {"label": "unknown", "score": 5.0})
        
        return {
            "primary": result["label"],
            "arousal_score": result["score"],
            "confidence": confidence
        }
    except Exception as e:
        return {"primary": "error", "arousal_score": 0.0, "confidence": 0.0}
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)