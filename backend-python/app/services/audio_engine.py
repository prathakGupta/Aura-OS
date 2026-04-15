# backend-python/app/services/audio_engine.py
# ---------------------------------------------------------------
# AuraOS Emotion Engine -- ML-powered audio analysis
#
# At startup, loads the 3-model ensemble trained by train_ensemble.py.
# Falls back to heuristic scoring if models are not found.
# ---------------------------------------------------------------
from __future__ import annotations

import os
import pathlib
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import librosa

try:
    import joblib
    HAS_JOBLIB = True
except ImportError:
    HAS_JOBLIB = False

try:
    import parselmouth
    HAS_PARSELMOUTH = True
except ImportError:
    HAS_PARSELMOUTH = False

try:
    import torch
    import torch.nn as nn
    from transformers import Wav2Vec2Model, Wav2Vec2FeatureExtractor
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False


# -- Data class returned to callers ------------------------------------

@dataclass(frozen=True)
class AudioFeatures:
    rms: float
    zero_crossing_rate: float
    pitch_score: float
    cadence_score: float
    stress_score: float
    emotion: str
    arousal_score: float = 5.0
    confidence: float = 0.0
    jitter: float = 0.0
    shimmer: float = 0.0
    hnr: float = 0.0
    f0_mean: float = 0.0
    model_source: str = "heuristic"   # "heuristic" | "ensemble" | "wav2vec2"


_EMPTY = AudioFeatures(
    rms=0.0, zero_crossing_rate=0.0, pitch_score=0.0, cadence_score=0.0,
    stress_score=0.0, emotion="calm", arousal_score=2.5,
)


def _is_git_lfs_pointer(path: str) -> bool:
    """
    Returns True when a file is a Git LFS pointer placeholder, not the real binary.
    """
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            header = f.readline().strip()
        return header.startswith("version https://git-lfs.github.com/spec/v1")
    except Exception:
        return False


# -- Locate model directory --------------------------------------------

def _find_model_dir() -> str:
    """Search common relative paths for the models/ directory."""
    candidates = [
        os.path.join(os.path.dirname(__file__), "..", "..", "models"),
        os.path.join(os.getcwd(), "models"),
        os.path.join(os.getcwd(), "backend-python", "models"),
    ]
    for c in candidates:
        p = os.path.normpath(c)
        if os.path.isdir(p) and os.path.exists(os.path.join(p, "emotion_rf.pkl")):
            return p
    return os.path.normpath(candidates[0])


# -- Emotion Engine ----------------------------------------------------

class EmotionEngine:
    """
    Loads the 3-model ensemble and exposes `analyze_chunk()`.

    Models:
      emotion_rf.pkl      -- RandomForest emotion classifier (calm / mild / high)
      arousal_xgb.pkl     -- XGBoost arousal regressor (1-10)
      stress_mlp.pkl      -- MLP stress scorer (clinical features)
      feature_scaler.pkl  -- StandardScaler fitted on training data
      label_encoder.pkl   -- LabelEncoder (class index <-> string)
    """

    LABELS = ["calm", "mild_anxiety", "high_anxiety"]

    def __init__(self):
        self.rf = None
        self.xgb = None
        self.mlp = None
        self.scaler = None
        self.le = None
        self.is_ready = False
        # wav2vec2 deep learning model
        self.w2v_model = None
        self.w2v_fe = None
        self.has_wav2vec2 = False
        self._load()

    # -- Model loading -------------------------------------------------

    def _load(self):
        if not HAS_JOBLIB:
            print("[WARN] [EmotionEngine] joblib not installed -- heuristic mode only.")
            return

        model_dir = _find_model_dir()
        needed = ["emotion_rf.pkl", "feature_scaler.pkl", "label_encoder.pkl"]
        if not all(os.path.exists(os.path.join(model_dir, f)) for f in needed):
            print(f"[WARN] [EmotionEngine] Models not found in {model_dir} -- heuristic mode.")
            return
        if any(_is_git_lfs_pointer(os.path.join(model_dir, f)) for f in needed):
            print(
                f"[WARN] [EmotionEngine] Model files in {model_dir} are Git LFS pointers. "
                "Fetch real model binaries to enable ML mode."
            )
            return

        try:
            self.rf = joblib.load(os.path.join(model_dir, "emotion_rf.pkl"))
            self.scaler = joblib.load(os.path.join(model_dir, "feature_scaler.pkl"))
            self.le = joblib.load(os.path.join(model_dir, "label_encoder.pkl"))

            xgb_path = os.path.join(model_dir, "arousal_xgb.pkl")
            if os.path.exists(xgb_path):
                self.xgb = joblib.load(xgb_path)

            mlp_path = os.path.join(model_dir, "stress_mlp.pkl")
            if os.path.exists(mlp_path):
                self.mlp = joblib.load(mlp_path)

            self.is_ready = True
            print(f"[OK] [EmotionEngine] ML ensemble loaded from {model_dir}")
        except Exception as e:
            print(f"[ERR] [EmotionEngine] Failed to load models: {e}")

        # -- wav2vec2 deep learning model (optional, Phase 2) ----------
        self._load_wav2vec2(model_dir)

    def _load_wav2vec2(self, model_dir: str):
        if not HAS_TORCH:
            return
        w2v_path = os.path.join(model_dir, "wav2vec2_emotion.pt")
        if not os.path.exists(w2v_path):
            return
        try:
            checkpoint = torch.load(w2v_path, map_location="cpu", weights_only=False)
            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

            # Rebuild the model architecture
            class _Wav2Vec2Clf(nn.Module):
                def __init__(self):
                    super().__init__()
                    self.wav2vec2 = Wav2Vec2Model.from_pretrained("facebook/wav2vec2-base", use_safetensors=True)
                    self.wav2vec2.feature_extractor._freeze_parameters()
                    self.classifier = nn.Sequential(
                        nn.Dropout(0.1), nn.Linear(768, 256), nn.ReLU(),
                        nn.Dropout(0.1), nn.Linear(256, 3),
                    )
                def forward(self, x, attention_mask=None):
                    h = self.wav2vec2(x, attention_mask=attention_mask).last_hidden_state
                    return self.classifier(h.mean(dim=1))

            model = _Wav2Vec2Clf()
            model.load_state_dict(checkpoint["model_state_dict"])
            model.to(device).eval()

            self.w2v_model = model
            self.w2v_device = device
            self.w2v_fe = Wav2Vec2FeatureExtractor.from_pretrained("facebook/wav2vec2-base")
            self.has_wav2vec2 = True
            acc = checkpoint.get("accuracy", "?")
            print(f"[OK] [EmotionEngine] wav2vec2 model loaded (acc={acc}) on {device}")
        except Exception as e:
            print(f"[WARN] [EmotionEngine] wav2vec2 load failed: {e}")

    # -- Feature extraction (real-time, from raw PCM) ------------------

    @staticmethod
    def _extract_features(wave: np.ndarray, sr: int = 16000) -> tuple[np.ndarray | None, dict]:
        """
        Extract the same 103-dim vector used during training.
        Also returns a dict of clinical features for the report.
        """
        clinical = {}
        try:
            y = wave.astype(np.float32)
            if y.size < sr * 0.3:  # Less than 0.3s of audio
                return None, clinical

            # MFCCs
            mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=40)
            mfcc_mean = mfcc.mean(axis=1)
            mfcc_std = mfcc.std(axis=1)

            # Pitch
            pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
            pitch_vals = pitches[magnitudes > magnitudes.mean()]
            f0_mean = float(pitch_vals.mean()) if pitch_vals.size > 0 else 0.0
            f0_std = float(pitch_vals.std()) if pitch_vals.size > 0 else 0.0
            clinical['f0_mean'] = f0_mean

            # Energy / ZCR
            rms = float(librosa.feature.rms(y=y).mean())
            zcr = float(librosa.feature.zero_crossing_rate(y).mean())

            # Spectral
            spec_centroid = float(librosa.feature.spectral_centroid(y=y, sr=sr).mean())
            spec_bw = float(librosa.feature.spectral_bandwidth(y=y, sr=sr).mean())
            spec_rolloff = float(librosa.feature.spectral_rolloff(y=y, sr=sr).mean())

            # Chroma
            chroma = librosa.feature.chroma_stft(y=y, sr=sr).mean(axis=1)

            # Prosody
            jitter, shimmer, hnr = 0.0, 0.0, 0.0
            if HAS_PARSELMOUTH:
                try:
                    # Write to temp buffer for parselmouth
                    import tempfile, soundfile as sf
                    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
                        sf.write(tmp.name, y, sr)
                        snd = parselmouth.Sound(tmp.name)
                        pp = parselmouth.praat.call(snd, "To PointProcess (periodic, cc)", 75, 600)
                        jitter = parselmouth.praat.call(
                            [snd, pp], "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3
                        )
                        shimmer = parselmouth.praat.call(
                            [snd, pp], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6
                        )
                        harm = parselmouth.praat.call(snd, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0)
                        hnr = parselmouth.praat.call(harm, "Get mean", 0, 0)
                        os.unlink(tmp.name)
                except Exception:
                    pass

            jitter = 0.0 if (jitter is None or np.isnan(jitter)) else float(jitter)
            shimmer = 0.0 if (shimmer is None or np.isnan(shimmer)) else float(shimmer)
            hnr = 0.0 if (hnr is None or np.isnan(hnr)) else float(hnr)
            clinical.update({'jitter': jitter, 'shimmer': shimmer, 'hnr': hnr})

            # Pause ratio
            intervals = librosa.effects.split(y, top_db=25)
            voiced = sum(end - start for start, end in intervals)
            pause_ratio = 1.0 - (voiced / max(y.size, 1))

            vec = np.hstack([
                mfcc_mean, mfcc_std,
                f0_mean, f0_std, rms, zcr,
                spec_centroid, spec_bw, spec_rolloff,
                chroma,
                jitter, shimmer, hnr, pause_ratio,
            ])
            vec = np.nan_to_num(vec, nan=0.0, posinf=0.0, neginf=0.0)
            return vec, clinical

        except Exception:
            return None, clinical

    # -- Main analysis entrypoint --------------------------------------

    def analyze_chunk(self, samples: np.ndarray, sr: int = 16000) -> AudioFeatures:
        if samples.size == 0:
            return _EMPTY

        wave = np.asarray(samples, dtype=np.float32).flatten()
        rms = float(np.sqrt(np.mean(np.square(wave))))
        zcr = float(np.mean(np.abs(np.diff(np.signbit(wave)))))

        # Heuristic baseline (always available)
        pitch_h = _clamp((rms - 0.008) / 0.06)
        cadence_h = _clamp((zcr - 0.03) / 0.25)
        stress_h = _clamp(pitch_h * 0.62 + cadence_h * 0.38)

        if not self.is_ready:
            return AudioFeatures(
                rms=rms, zero_crossing_rate=zcr,
                pitch_score=round(pitch_h, 4), cadence_score=round(cadence_h, 4),
                stress_score=round(stress_h, 4),
                emotion=_emotion_from_stress(stress_h),
                arousal_score=round(1.0 + stress_h * 9.0, 2),
            )

        # -- ML inference ----------------------------------------------
        feat_vec, clinical = self._extract_features(wave, sr)

        if feat_vec is None:
            # Too short for full extraction -> fall back to heuristic
            return AudioFeatures(
                rms=rms, zero_crossing_rate=zcr,
                pitch_score=round(pitch_h, 4), cadence_score=round(cadence_h, 4),
                stress_score=round(stress_h, 4),
                emotion=_emotion_from_stress(stress_h),
                arousal_score=round(1.0 + stress_h * 9.0, 2),
            )

        feat_scaled = self.scaler.transform(feat_vec.reshape(1, -1))

        # Model 1: RF emotion
        rf_probs = self.rf.predict_proba(feat_scaled)[0]
        rf_pred = int(rf_probs.argmax())
        emotion = self.le.inverse_transform([rf_pred])[0]
        confidence = float(rf_probs.max())
        source = "rf"
        blended = rf_probs

        # Model 2: XGBoost arousal
        if self.xgb is not None:
            arousal = float(self.xgb.predict(feat_scaled)[0])
            arousal = max(1.0, min(10.0, arousal))
        else:
            arousal = round(1.0 + stress_h * 9.0, 2)

        # Model 3: MLP stress (clinical features only, indices 80:103)
        if self.mlp is not None:
            clinical_feats = feat_scaled[:, 80:103]
            mlp_probs = self.mlp.predict_proba(clinical_feats)[0]
            # Ensemble: blend RF 60% + MLP 40%
            blended = 0.6 * rf_probs + 0.4 * mlp_probs
            ensemble_pred = int(blended.argmax())
            emotion = self.le.inverse_transform([ensemble_pred])[0]
            confidence = float(blended.max())
            source = "ensemble"

        # -- Optional: deep learning (wav2vec2) integration --
        if self.has_wav2vec2 and self.w2v_model is not None:
            try:
                import torch
                import torch.nn.functional as F
                # Resample if needed (wav2vec2 expects 16k, we should be 16k)
                if sr != 16000:
                    y_16k = librosa.resample(wave, orig_sr=sr, target_sr=16000)
                else:
                    y_16k = wave
                    
                # Fix: Exact match to training script padding logic to prevent spatial corruption
                max_len = int(16000 * 4.0)
                if len(y_16k) < max_len:
                    y_16k = np.pad(y_16k, (0, max_len - len(y_16k)))
                else:
                    y_16k = y_16k[:max_len]

                inputs = self.w2v_fe(y_16k, sampling_rate=16000, return_tensors="pt", padding=False)
                input_values = inputs.input_values.to(self.w2v_device)
                
                with torch.no_grad():
                    logits = self.w2v_model(input_values)
                    probs = F.softmax(logits, dim=-1).squeeze(0).cpu().numpy()
                
                # Align probabilities to the label encoder's order
                # W2V model's labels were {'calm':0, 'mild_anxiety':1, 'high_anxiety':2} or so.
                # Actually, our LABEL2ID in the training script: {"calm":0, "mild_anxiety":1, "high_anxiety":2}
                # Let's dynamically map them. The training script saved LABEL2ID and ID2LABEL but we
                # rebuild the model without it directly here. We should use standard mapping.
                # W2V uses index 0: calm, 1: mild, 2: high.
                # Scikit le classes are often alphabetized: 0: calm, 1: high, 2: mild.
                # Let's align based on the string labels.
                
                w2v_labels = ["calm", "mild_anxiety", "high_anxiety"]
                scikit_probs = np.zeros(3)
                for i, lab in enumerate(self.le.classes_):
                    w2v_idx = w2v_labels.index(lab)
                    scikit_probs[i] = probs[w2v_idx]
                
                # Blend: Heavily favor Wav2Vec2 (80%) over acoustic MLP (20%)
                final_probs = 0.8 * scikit_probs + 0.2 * blended
                final_pred = int(final_probs.argmax())
                emotion = self.le.inverse_transform([final_pred])[0]
                confidence = float(final_probs.max())
                source = "wav2vec2_ensemble"
            except Exception as e:
                print(f"[WARN] wav2vec2 inference failed: {e}")

        # Phase 4: Enforce Baseline Confidence boundaries
        if confidence < 0.50:
             emotion = _emotion_from_stress(stress_h)
             # Throttle arousal prediction towards safer heuristic
             arousal = round(1.0 + stress_h * 9.0, 2)
             source += " (fallback_low_conf)"

        # Stress score: normalized arousal to 0-1
        stress_score = _clamp((arousal - 1.0) / 9.0)

        return AudioFeatures(
            rms=rms,
            zero_crossing_rate=zcr,
            pitch_score=round(pitch_h, 4),
            cadence_score=round(cadence_h, 4),
            stress_score=round(stress_score, 4),
            emotion=emotion,
            arousal_score=round(arousal, 2),
            confidence=round(confidence, 3),
            jitter=clinical.get('jitter', 0.0),
            shimmer=clinical.get('shimmer', 0.0),
            hnr=clinical.get('hnr', 0.0),
            f0_mean=clinical.get('f0_mean', 0.0),
            model_source=source,
        )

    def get_engine_status(self) -> dict:
        """Returns the readiness status of the ML models to prevent silent failures."""
        return {
            "heuristic_fallback": not self.is_ready and not self.has_wav2vec2,
            "ensemble_loaded": self.is_ready,
            "wav2vec2_loaded": self.has_wav2vec2,
            "expected_features": 103  # The fixed dimension size the pipeline expects
        }


# -- Helpers -----------------------------------------------------------

def _clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def _emotion_from_stress(s: float) -> str:
    if s >= 0.72:
        return "high_anxiety"
    if s >= 0.42:
        return "mild_anxiety"
    return "calm"


# -- Singleton + backward-compatible API -------------------------------

_engine = EmotionEngine()


def get_audio_engine_status() -> dict:
    """Check the load status of ML models in the engine singleton."""
    return _engine.get_engine_status()


def analyze_audio_chunk(samples: np.ndarray) -> AudioFeatures:
    """Drop-in replacement -- voice_service.py calls this unchanged."""
    return _engine.analyze_chunk(samples)


def arousal_from_stress(stress_score: float) -> float:
    return round(1.0 + (_clamp(stress_score) * 9.0), 2)
