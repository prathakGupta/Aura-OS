# backend-python/training/train_ensemble.py
# ---------------------------------------------------------------
# Train the 3-model AuraOS emotion ensemble from the extracted .npz
# ---------------------------------------------------------------
import os
import sys
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import classification_report, accuracy_score, mean_absolute_error
import xgboost as xgb

FEATURES_FILE = os.path.join(os.path.dirname(__file__), "aura_features.npz")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")


def _arousal_from_label(labels):
    """Map emotion labels to continuous arousal targets (1-10)."""
    mapping = {'calm': 2.5, 'mild_anxiety': 5.5, 'high_anxiety': 8.5}
    return np.array([mapping[l] for l in labels], dtype=np.float32)


def main():
    print("=" * 60)
    print(" AuraOS -- 3-Model Ensemble Training")
    print("=" * 60)

    if not os.path.exists(FEATURES_FILE):
        print(f"ERROR: Feature file not found: {FEATURES_FILE}")
        print("  Run  python training/build_dataset.py  first.")
        sys.exit(1)

    # -- Load -------------------------------------------------------
    data = np.load(FEATURES_FILE, allow_pickle=True)
    X = data['X']
    y = data['y']
    print(f"\nLoaded {X.shape[0]} samples x {X.shape[1]} features")

    # -- Encode labels -----------------------------------------------
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)
    print(f"Classes: {dict(zip(le.classes_, le.transform(le.classes_)))}")

    # -- Split -------------------------------------------------------
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
    )
    y_train_raw = le.inverse_transform(y_train)
    y_test_raw = le.inverse_transform(y_test)

    # -- Scale -------------------------------------------------------
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    # == MODEL 1 -- Random Forest Emotion Classifier =================
    print("\n[Model 1] Random Forest -- Emotion Classifier")
    rf = RandomForestClassifier(
        n_estimators=300,
        max_depth=20,
        min_samples_split=5,
        class_weight='balanced',
        random_state=42,
        n_jobs=-1,
    )
    rf.fit(X_train_s, y_train)
    rf_preds = rf.predict(X_test_s)
    rf_acc = accuracy_score(y_test, rf_preds)
    print(f"  Accuracy: {rf_acc:.4f}")
    print(classification_report(y_test, rf_preds, target_names=le.classes_))

    # == MODEL 2 -- XGBoost Arousal Regressor ========================
    print("[Model 2] XGBoost -- Arousal Regressor")
    arousal_train = _arousal_from_label(y_train_raw)
    arousal_test = _arousal_from_label(y_test_raw)

    xgb_model = xgb.XGBRegressor(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.08,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
    )
    xgb_model.fit(
        X_train_s, arousal_train,
        eval_set=[(X_test_s, arousal_test)],
        verbose=False,
    )
    arousal_preds = xgb_model.predict(X_test_s)
    arousal_mae = mean_absolute_error(arousal_test, arousal_preds)
    print(f"  Arousal MAE: {arousal_mae:.3f}  (target < 1.5)")

    # == MODEL 3 -- MLP Stress Scorer (clinical features) ============
    print("\n[Model 3] MLP -- Acoustic Stress Scorer")
    # Use clinical features: F0, spectral, jitter, shimmer, HNR, pause (indices 80-102)
    clinical_idx = list(range(80, 103))
    X_train_c = X_train_s[:, clinical_idx]
    X_test_c = X_test_s[:, clinical_idx]

    mlp = MLPClassifier(
        hidden_layer_sizes=(64, 32),
        activation='relu',
        max_iter=500,
        random_state=42,
        early_stopping=True,
        validation_fraction=0.15,
    )
    mlp.fit(X_train_c, y_train)
    mlp_preds = mlp.predict(X_test_c)
    mlp_acc = accuracy_score(y_test, mlp_preds)
    print(f"  Accuracy: {mlp_acc:.4f}")
    print(classification_report(y_test, mlp_preds, target_names=le.classes_))

    # == ENSEMBLE EVALUATION =========================================
    print("[Ensemble] Weighted Vote (RF 60% + MLP 40%)")
    rf_probs = rf.predict_proba(X_test_s)
    mlp_probs = mlp.predict_proba(X_test_c)
    ensemble_probs = 0.6 * rf_probs + 0.4 * mlp_probs
    ensemble_preds = ensemble_probs.argmax(axis=1)
    ensemble_acc = accuracy_score(y_test, ensemble_preds)
    print(f"  Ensemble Accuracy: {ensemble_acc:.4f}")
    print(classification_report(y_test, ensemble_preds, target_names=le.classes_))

    # == SAVE MODELS =================================================
    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(rf, os.path.join(MODEL_DIR, "emotion_rf.pkl"))
    joblib.dump(xgb_model, os.path.join(MODEL_DIR, "arousal_xgb.pkl"))
    joblib.dump(mlp, os.path.join(MODEL_DIR, "stress_mlp.pkl"))
    joblib.dump(scaler, os.path.join(MODEL_DIR, "feature_scaler.pkl"))
    joblib.dump(le, os.path.join(MODEL_DIR, "label_encoder.pkl"))

    print(f"\nAll models saved to {MODEL_DIR}/")
    print("=" * 60)
    print(f" RF Accuracy:       {rf_acc:.4f}")
    print(f" MLP Accuracy:      {mlp_acc:.4f}")
    print(f" Ensemble Accuracy: {ensemble_acc:.4f}")
    print(f" Arousal MAE:       {arousal_mae:.3f}")
    print("=" * 60)


if __name__ == "__main__":
    main()
