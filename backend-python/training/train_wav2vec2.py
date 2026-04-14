# backend-python/training/train_wav2vec2.py
# ---------------------------------------------------------------
# Fine-tune wav2vec2-base for AuraOS 3-class emotion recognition
# Runs on RTX 3050 (4GB VRAM) with gradient accumulation
# ---------------------------------------------------------------
import os
import sys
import glob
import random
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from transformers import (
    Wav2Vec2Model,
    Wav2Vec2FeatureExtractor,
    get_linear_schedule_with_warmup,
)
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import librosa
import joblib

# ---------------------------------------------------------------
# Config
# ---------------------------------------------------------------
DATASETS_DIR = os.path.join(os.path.dirname(__file__), "datasets")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
CHECKPOINT_DIR = os.path.join(os.path.dirname(__file__), "checkpoints")

LABELS = ["calm", "mild_anxiety", "high_anxiety"]
LABEL2ID = {l: i for i, l in enumerate(LABELS)}
ID2LABEL = {i: l for i, l in enumerate(LABELS)}

SR = 16000
MAX_SEC = 4.0                   # Truncate/pad to 4s (fits in 4GB VRAM)
MAX_LEN = int(SR * MAX_SEC)

BATCH_SIZE = 4                  # Safe for 4GB VRAM
GRAD_ACCUM = 4                  # Effective batch = 16
EPOCHS = 8
LR = 2e-5
WARMUP_RATIO = 0.1
FREEZE_FEATURE_EXTRACTOR = True # Freeze CNN encoder, train transformer only

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ---------------------------------------------------------------
# Dataset label mappers (reuse from extract_features)
# ---------------------------------------------------------------
sys.path.insert(0, os.path.dirname(__file__))
from extract_features import label_ravdess, label_tess


def collect_all_files():
    """Gather (path, label) tuples from RAVDESS + TESS."""
    items = []

    # RAVDESS
    for actor_dir in sorted(glob.glob(os.path.join(DATASETS_DIR, "ravdess/Actor_*"))):
        if "audio_speech_actors" in actor_dir.lower():
            continue
        for wav in glob.glob(os.path.join(actor_dir, "*.wav")):
            label = label_ravdess(os.path.basename(wav))
            if label:
                items.append((wav, label))

    # TESS
    for emo_dir in sorted(glob.glob(os.path.join(DATASETS_DIR, "tess/*"))):
        if not os.path.isdir(emo_dir):
            continue
        label = label_tess(os.path.basename(emo_dir))
        if label is None:
            continue
        for wav in glob.glob(os.path.join(emo_dir, "*.wav")):
            items.append((wav, label))

    return items


# ---------------------------------------------------------------
# PyTorch Dataset
# ---------------------------------------------------------------
class EmotionAudioDataset(Dataset):
    def __init__(self, file_label_pairs, feature_extractor, max_len=MAX_LEN):
        self.pairs = file_label_pairs
        self.fe = feature_extractor
        self.max_len = max_len

    def __len__(self):
        return len(self.pairs)

    def __getitem__(self, idx):
        path, label = self.pairs[idx]
        # Load raw audio
        y, _ = librosa.load(path, sr=SR, duration=MAX_SEC)
        # Pad if too short
        if len(y) < self.max_len:
            y = np.pad(y, (0, self.max_len - len(y)))
        else:
            y = y[:self.max_len]

        # Process through wav2vec2 feature extractor
        inputs = self.fe(y, sampling_rate=SR, return_tensors="pt", padding=False)
        input_values = inputs.input_values.squeeze(0)  # (seq_len,)

        return input_values, LABEL2ID[label]


# ---------------------------------------------------------------
# Classification Head
# ---------------------------------------------------------------
class Wav2Vec2EmotionClassifier(nn.Module):
    """wav2vec2-base + classification head for 3-class emotion."""

    def __init__(self, num_labels=3):
        super().__init__()
        self.wav2vec2 = Wav2Vec2Model.from_pretrained("facebook/wav2vec2-base", use_safetensors=True)
        hidden_size = self.wav2vec2.config.hidden_size  # 768

        if FREEZE_FEATURE_EXTRACTOR:
            self.wav2vec2.feature_extractor._freeze_parameters()

        self.classifier = nn.Sequential(
            nn.Dropout(0.1),
            nn.Linear(hidden_size, 256),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(256, num_labels),
        )

    def forward(self, input_values, attention_mask=None):
        outputs = self.wav2vec2(input_values, attention_mask=attention_mask)
        hidden_states = outputs.last_hidden_state  # (batch, seq, 768)
        # Mean pooling over time
        pooled = hidden_states.mean(dim=1)          # (batch, 768)
        logits = self.classifier(pooled)            # (batch, 3)
        return logits


# ---------------------------------------------------------------
# Training Loop
# ---------------------------------------------------------------
def train():
    print("=" * 60)
    print(" AuraOS -- wav2vec2 Fine-Tuning (Phase 2)")
    print("=" * 60)
    print(f" Device: {DEVICE}")
    print(f" Batch size: {BATCH_SIZE} x {GRAD_ACCUM} accum = {BATCH_SIZE*GRAD_ACCUM} effective")
    print(f" Epochs: {EPOCHS}")
    print(f" Max audio: {MAX_SEC}s")

    # Collect files
    all_files = collect_all_files()
    print(f"\n Found {len(all_files)} audio clips")

    if len(all_files) == 0:
        print("ERROR: No audio files found. Check datasets/ folder.")
        return

    # Split
    train_files, test_files = train_test_split(
        all_files, test_size=0.2, random_state=42,
        stratify=[l for _, l in all_files]
    )
    print(f" Train: {len(train_files)}, Test: {len(test_files)}")

    # Feature extractor
    print("\n Loading wav2vec2-base feature extractor...")
    fe = Wav2Vec2FeatureExtractor.from_pretrained("facebook/wav2vec2-base")

    train_ds = EmotionAudioDataset(train_files, fe)
    test_ds = EmotionAudioDataset(test_files, fe)

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True,
                              num_workers=0, pin_memory=True)
    test_loader = DataLoader(test_ds, batch_size=BATCH_SIZE, shuffle=False,
                             num_workers=0, pin_memory=True)

    # Model
    print(" Building classifier...")
    model = Wav2Vec2EmotionClassifier(num_labels=len(LABELS)).to(DEVICE)

    # Optimizer
    optimizer = torch.optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=LR, weight_decay=0.01
    )

    total_steps = (len(train_loader) // GRAD_ACCUM) * EPOCHS
    scheduler = get_linear_schedule_with_warmup(
        optimizer,
        num_warmup_steps=int(total_steps * WARMUP_RATIO),
        num_training_steps=total_steps
    )

    criterion = nn.CrossEntropyLoss(
        weight=torch.tensor([1.0, 1.4, 1.2]).to(DEVICE)  # Slight upweight for minorities
    )

    # Training
    best_acc = 0.0
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)
    os.makedirs(MODEL_DIR, exist_ok=True)

    for epoch in range(EPOCHS):
        model.train()
        total_loss = 0
        optimizer.zero_grad()

        for step, (input_values, labels) in enumerate(train_loader):
            input_values = input_values.to(DEVICE)
            labels = torch.tensor(labels).to(DEVICE)

            logits = model(input_values)
            loss = criterion(logits, labels) / GRAD_ACCUM
            loss.backward()
            total_loss += loss.item() * GRAD_ACCUM

            if (step + 1) % GRAD_ACCUM == 0:
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                optimizer.step()
                scheduler.step()
                optimizer.zero_grad()

            if (step + 1) % 50 == 0:
                avg_loss = total_loss / (step + 1)
                print(f"  Epoch {epoch+1}/{EPOCHS} Step {step+1}/{len(train_loader)} Loss: {avg_loss:.4f}")

        # Evaluate
        model.eval()
        all_preds, all_labels = [], []
        with torch.no_grad():
            for input_values, labels in test_loader:
                input_values = input_values.to(DEVICE)
                logits = model(input_values)
                preds = logits.argmax(dim=-1).cpu().numpy()
                all_preds.extend(preds)
                all_labels.extend(labels)

        acc = accuracy_score(all_labels, all_preds)
        print(f"\n  Epoch {epoch+1}/{EPOCHS} -- Test Accuracy: {acc:.4f}")
        print(classification_report(
            all_labels, all_preds,
            target_names=LABELS, zero_division=0
        ))

        # Save best
        if acc > best_acc:
            best_acc = acc
            save_path = os.path.join(MODEL_DIR, "wav2vec2_emotion.pt")
            torch.save({
                'model_state_dict': model.state_dict(),
                'accuracy': acc,
                'epoch': epoch + 1,
                'label2id': LABEL2ID,
                'id2label': ID2LABEL,
            }, save_path)
            print(f"  >> New best model saved ({acc:.4f})")

        # Checkpoint
        ckpt_path = os.path.join(CHECKPOINT_DIR, f"epoch_{epoch+1}.pt")
        torch.save(model.state_dict(), ckpt_path)

    # Final report
    print("\n" + "=" * 60)
    print(f" TRAINING COMPLETE")
    print(f" Best Accuracy: {best_acc:.4f}")
    print(f" Model saved to: {os.path.join(MODEL_DIR, 'wav2vec2_emotion.pt')}")
    print("=" * 60)

    # Clear GPU memory
    del model
    torch.cuda.empty_cache()


if __name__ == "__main__":
    train()
