import json
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.optim.lr_scheduler import ReduceLROnPlateau
from torch.utils.data import DataLoader, Dataset, random_split

from ml.preprocess import prepare_frame

BACKEND_ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS_DIR = BACKEND_ROOT / "artifacts"
TRAIN_DATA_FILE = ARTIFACTS_DIR / "training_data.json"
MODEL_FILE = ARTIFACTS_DIR / "models" / "word_model.pth"

MAX_FRAMES = 60
HAND_POINTS = 21
POSE_POINTS = 8
FACE_POINTS = 10
INPUT_SIZE = (HAND_POINTS * 3 * 2) + (POSE_POINTS * 3) + (FACE_POINTS * 3)

HIDDEN_SIZE = 256
EPOCHS = 100
BATCH_SIZE = 32
LEARNING_RATE = 1e-3


def resolve_training_data() -> Path:
    if TRAIN_DATA_FILE.exists():
        return TRAIN_DATA_FILE
    return BACKEND_ROOT / "training_data.json"


def prepare_sequence(frames):
    if not frames:
        return None
    seq = [prepare_frame(f, mode="word") for f in frames]
    if len(seq) > MAX_FRAMES:
        idx = np.linspace(0, len(seq) - 1, MAX_FRAMES).astype(int)
        seq = [seq[i] for i in idx]
    else:
        last = seq[-1]
        while len(seq) < MAX_FRAMES:
            seq.append(last.copy())
    return np.array(seq, dtype=np.float32)


class WordDataset(Dataset):
    def __init__(self, raw_data, word_to_idx):
        self.samples = []
        for item in raw_data:
            label = str(item.get("gloss", "")).lower().strip()
            if len(label) <= 1 or label not in word_to_idx:
                continue
            seq = prepare_sequence(item.get("landmarks", []))
            if seq is not None:
                self.samples.append((seq, word_to_idx[label]))

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        seq, label = self.samples[idx]
        if self.training:
            noise = np.random.normal(0, 0.003, seq.shape).astype(np.float32)
            seq = seq + noise
        return torch.tensor(seq), torch.tensor(label)


class WordModel(nn.Module):
    def __init__(self, num_classes):
        super().__init__()
        self.lstm = nn.LSTM(
            INPUT_SIZE,
            HIDDEN_SIZE,
            num_layers=3,
            batch_first=True,
            bidirectional=True,
            dropout=0.4,
        )
        self.fc = nn.Sequential(
            nn.Linear(HIDDEN_SIZE * 2, 256),
            nn.BatchNorm1d(256),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(256, num_classes),
        )

    def forward(self, x):
        lstm_out, _ = self.lstm(x)
        out = torch.mean(lstm_out, dim=1)
        return self.fc(out)


def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    with open(resolve_training_data(), "r", encoding="utf-8") as f:
        raw = json.load(f)

    all_words = sorted({str(item.get("gloss", "")).lower().strip() for item in raw if len(str(item.get("gloss", "")).lower().strip()) > 1})
    word_to_idx = {w: i for i, w in enumerate(all_words)}
    print(f"Vocabulary Size: {len(all_words)}")

    full_dataset = WordDataset(raw, word_to_idx)
    train_size = int(len(full_dataset) * 0.85)
    val_size = len(full_dataset) - train_size
    train_ds, val_ds = random_split(full_dataset, [train_size, val_size])
    train_ds.dataset.training = True
    val_ds.dataset.training = False

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE)

    MODEL_FILE.parent.mkdir(parents=True, exist_ok=True)
    model = WordModel(len(all_words)).to(device)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = torch.optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=1e-4)
    scheduler = ReduceLROnPlateau(optimizer, mode="max", factor=0.5, patience=5)

    best_val_acc = 0.0
    for epoch in range(EPOCHS):
        model.train()
        train_loss = 0.0
        correct = 0
        total = 0
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad()
            outputs = model(x)
            loss = criterion(outputs, y)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            train_loss += loss.item()
            pred = outputs.argmax(1)
            correct += (pred == y).sum().item()
            total += y.size(0)

        train_acc = 100 * correct / total if total else 0
        model.eval()
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for x, y in val_loader:
                x, y = x.to(device), y.to(device)
                outputs = model(x)
                pred = outputs.argmax(1)
                val_correct += (pred == y).sum().item()
                val_total += y.size(0)
        val_acc = 100 * val_correct / val_total if val_total else 0
        scheduler.step(val_acc)
        print(f"Epoch {epoch + 1}/{EPOCHS} | Loss: {train_loss / max(1, len(train_loader)):.4f} | Train Acc: {train_acc:.2f}% | Val Acc: {val_acc:.2f}%")
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(
                {
                    "model_state_dict": model.state_dict(),
                    "words": all_words,
                    "input_size": INPUT_SIZE,
                    "hidden_size": HIDDEN_SIZE,
                },
                MODEL_FILE,
            )
            print(f"--- Saved Best Model ({val_acc:.2f}%) ---")


if __name__ == "__main__":
    main()
