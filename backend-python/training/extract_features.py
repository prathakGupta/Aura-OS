# backend-python/training/extract_features.py
# ---------------------------------------------------------------
# 103-dimensional acoustic feature extractor for AuraOS Voice Emotion
# ---------------------------------------------------------------
import numpy as np
import librosa

# Optional: parselmouth for clinical prosodic markers
try:
    import parselmouth
    HAS_PARSELMOUTH = True
except ImportError:
    HAS_PARSELMOUTH = False
    print("[FeatureExtractor] parselmouth not installed -- jitter/shimmer/HNR will be zero.")


def extract_features(audio_path: str, sr: int = 16000) -> np.ndarray | None:
    """
    Extract a 103-dim feature vector from an audio file.

    Dimensions:
      [0:40]   MFCC means
      [40:80]  MFCC stds
      [80]     F0 mean
      [81]     F0 std
      [82]     RMS energy
      [83]     Zero-crossing rate
      [84]     Spectral centroid
      [85]     Spectral bandwidth
      [86]     Spectral rolloff
      [87:99]  Chroma (12)
      [99]     Jitter
      [100]    Shimmer
      [101]    HNR
      [102]    Pause ratio
    """
    try:
        y, _ = librosa.load(audio_path, sr=sr, duration=5.0)
        if y.size == 0:
            return None

        # ── MFCCs ──────────────────────────────────────────────────────
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=40)
        mfcc_mean = mfcc.mean(axis=1)                    # 40
        mfcc_std = mfcc.std(axis=1)                       # 40

        # ── Pitch (F0) ────────────────────────────────────────────────
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
        pitch_vals = pitches[magnitudes > magnitudes.mean()]
        f0_mean = float(pitch_vals.mean()) if pitch_vals.size > 0 else 0.0
        f0_std = float(pitch_vals.std()) if pitch_vals.size > 0 else 0.0

        # ── Energy / ZCR ──────────────────────────────────────────────
        rms = float(librosa.feature.rms(y=y).mean())
        zcr = float(librosa.feature.zero_crossing_rate(y).mean())

        # ── Spectral ──────────────────────────────────────────────────
        spec_centroid = float(librosa.feature.spectral_centroid(y=y, sr=sr).mean())
        spec_bw = float(librosa.feature.spectral_bandwidth(y=y, sr=sr).mean())
        spec_rolloff = float(librosa.feature.spectral_rolloff(y=y, sr=sr).mean())

        # ── Chroma ────────────────────────────────────────────────────
        chroma = librosa.feature.chroma_stft(y=y, sr=sr).mean(axis=1)   # 12

        # ── Prosody (Jitter / Shimmer / HNR) ──────────────────────────
        jitter, shimmer, hnr = 0.0, 0.0, 0.0
        if HAS_PARSELMOUTH:
            try:
                snd = parselmouth.Sound(audio_path)
                pp = parselmouth.praat.call(snd, "To PointProcess (periodic, cc)", 75, 600)
                jitter = parselmouth.praat.call(
                    [snd, pp], "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3
                )
                shimmer = parselmouth.praat.call(
                    [snd, pp], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6
                )
                harm = parselmouth.praat.call(snd, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0)
                hnr = parselmouth.praat.call(harm, "Get mean", 0, 0)
            except Exception:
                pass
        # Sanitise NaN from parselmouth
        jitter = 0.0 if (jitter is None or np.isnan(jitter)) else float(jitter)
        shimmer = 0.0 if (shimmer is None or np.isnan(shimmer)) else float(shimmer)
        hnr = 0.0 if (hnr is None or np.isnan(hnr)) else float(hnr)

        # ── Pause ratio ──────────────────────────────────────────────
        intervals = librosa.effects.split(y, top_db=25)
        voiced_samples = sum(end - start for start, end in intervals)
        pause_ratio = 1.0 - (voiced_samples / max(y.size, 1))

        # ── Concatenate ──────────────────────────────────────────────
        vec = np.hstack([
            mfcc_mean,       # 40
            mfcc_std,        # 40
            f0_mean,         # 1
            f0_std,          # 1
            rms,             # 1
            zcr,             # 1
            spec_centroid,   # 1
            spec_bw,         # 1
            spec_rolloff,    # 1
            chroma,          # 12
            jitter,          # 1
            shimmer,         # 1
            hnr,             # 1
            pause_ratio,     # 1
        ])                   # Total: 103

        # Replace any NaN/Inf with 0
        vec = np.nan_to_num(vec, nan=0.0, posinf=0.0, neginf=0.0)
        return vec

    except Exception as e:
        print(f"[extract] SKIP {audio_path}: {e}")
        return None


# ─── Dataset label mappers ─────────────────────────────────────────────

RAVDESS_MAP = {
    '01': 'calm',           # neutral
    '02': 'calm',           # calm
    '03': 'calm',           # happy
    '04': 'mild_anxiety',   # sad
    '05': 'high_anxiety',   # angry
    '06': 'high_anxiety',   # fearful
    '07': 'mild_anxiety',   # disgust
    '08': 'mild_anxiety',   # surprised
}


def label_ravdess(filename: str) -> str | None:
    """03-01-05-01-01-01-12.wav -> emotion from 3rd field."""
    parts = filename.replace('.wav', '').split('-')
    if len(parts) < 3:
        return None
    return RAVDESS_MAP.get(parts[2])


def label_cremad(filename: str) -> str | None:
    """1001_DFA_ANG_HI.wav -> emotion from 3rd field + intensity from 4th."""
    parts = filename.replace('.wav', '').split('_')
    if len(parts) < 4:
        return None
    emo = parts[2]
    intensity = parts[3]
    if emo in ('NEU', 'HAP'):
        return 'calm'
    if emo == 'SAD':
        return 'high_anxiety' if intensity == 'HI' else 'mild_anxiety'
    if emo == 'DIS':
        return 'mild_anxiety'
    if emo in ('FEA', 'ANG'):
        return 'high_anxiety' if intensity in ('MD', 'HI', 'XX') else 'mild_anxiety'
    return None


TESS_MAP = {
    'neutral': 'calm',
    'happy': 'calm',
    'pleasant_surprise': 'calm',
    'pleasant_surprised': 'calm',   # YAF variant
    'ps': 'calm',                    # abbreviation variant
    'sad': 'mild_anxiety',
    'disgust': 'mild_anxiety',
    'fear': 'high_anxiety',
    'angry': 'high_anxiety',
}


def label_tess(folder_name: str) -> str | None:
    """OAF_angry -> 'high_anxiety', YAF_pleasant_surprised -> 'calm'."""
    # Strip prefix (OAF_ or YAF_)
    lower = folder_name.lower()
    for prefix in ('oaf_', 'yaf_'):
        if lower.startswith(prefix):
            emo = lower[len(prefix):]
            return TESS_MAP.get(emo)
    return None
