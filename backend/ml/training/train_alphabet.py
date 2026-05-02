import json
import multiprocessing
from collections import Counter
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset, random_split

from ml.preprocess import prepare_frame

BACKEND_ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS_DIR = BACKEND_ROOT / "artifacts"
TRAIN_DATA_FILE = ARTIFACTS_DIR / "training_data.json"
MODEL_FILE = ARTIFACTS_DIR / "models" / "alphabet_model.pth"

MAX_FRAMES = 60
HAND_POINTS = 21
POSE_POINTS = 8
FACE_POINTS = 10
INPUT_SIZE = (HAND_POINTS * 3 * 2) + (POSE_POINTS * 3) + (FACE_POINTS * 3)

HIDDEN_SIZE = 64
EPOCHS = 80
BATCH_SIZE = 8
LEARNING_RATE = 5e-4

ALPHABET = list("abcdefghijklmnopqrstuvwxyz")
label_to_idx = {c: i for i, c in enumerate(ALPHABET)}
idx_to_label = {i: c for c, i in label_to_idx.items()}


def resolve_training_data() -> Path:
    if TRAIN_DATA_FILE.exists():
        return TRAIN_DATA_FILE
    return BACKEND_ROOT / "training_data.json"


def prepare_sequence(frames):
    seq = [prepare_frame(f, mode="alphabet") for f in frames]
    if len(seq) == 0:
        return None
    if len(seq) > MAX_FRAMES:
        idx = np.linspace(0, len(seq) - 1, MAX_FRAMES).astype(int)
        seq = [seq[i] for i in idx]
    else:
        last = seq[-1]
        while len(seq) < MAX_FRAMES:
            seq.append(last.copy())
    return np.array(seq, dtype=np.float32)


class AlphabetDataset(Dataset):
    def __init__(self, raw):
        self.samples = []
        for item in raw:
            label = item["gloss"].lower().strip()
            if len(label) != 1 or label not in label_to_idx:
                continue
            seq = prepare_sequence(item["landmarks"])
            if seq is None:
                continue
            self.samples.append((seq, label_to_idx[label]))
        counts = Counter(idx_to_label[y] for _, y in self.samples)
        print("Total samples:", len(self.samples))
        print("Class distribution:", counts)

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        seq, label = self.samples[idx]
        noise = np.random.normal(0, 0.002, seq.shape).astype(np.float32)
        seq = seq + noise
        return torch.tensor(seq, dtype=torch.float32), torch.tensor(label, dtype=torch.long)


class AlphabetModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.lstm = nn.LSTM(INPUT_SIZE, HIDDEN_SIZE, num_layers=1, batch_first=True, bidirectional=True)
        self.dropout = nn.Dropout(0.5)
        self.fc = nn.Sequential(
            nn.Linear(HIDDEN_SIZE * 2, 64),
            nn.ReLU(),
            nn.Dropout(0.4),
            nn.Linear(64, len(ALPHABET)),
        )

    def forward(self, x):
        out, _ = self.lstm(x)
        out = out.mean(dim=1)
        out = self.dropout(out)
        return self.fc(out)


def main():
    train_data_file = resolve_training_data()
    with open(train_data_file, "r", encoding="utf-8") as f:
        raw = json.load(f)

    MODEL_FILE.parent.mkdir(parents=True, exist_ok=True)
    dataset = AlphabetDataset(raw)
    train_size = int(len(dataset) * 0.85)
    val_size = len(dataset) - train_size
    train_dataset, val_dataset = random_split(dataset, [train_size, val_size])

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("Device:", device)
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    model = AlphabetModel().to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    best_val = 0.0

    for epoch in range(EPOCHS):
        model.train()
        correct = 0
        total = 0
        for x, y in train_loader:
            x = x.to(device)
            y = y.to(device)
            optimizer.zero_grad()
            output = model(x)
            loss = criterion(output, y)
            loss.backward()
            optimizer.step()
            pred = output.argmax(1)
            correct += (pred == y).sum().item()
            total += y.size(0)
        train_acc = 100 * correct / total

        model.eval()
        correct = 0
        total = 0
        with torch.no_grad():
            for x, y in val_loader:
                x = x.to(device)
                y = y.to(device)
                output = model(x)
                pred = output.argmax(1)
                correct += (pred == y).sum().item()
                total += y.size(0)
        val_acc = 100 * correct / total if total else 0
        print(f"Epoch {epoch + 1}/{EPOCHS} Train={train_acc:.2f}% Val={val_acc:.2f}%")
        if val_acc > best_val:
            best_val = val_acc
            torch.save({"model_state_dict": model.state_dict(), "alphabet": ALPHABET}, MODEL_FILE)
            print("Saved best model")

    print("Best validation accuracy:", best_val)


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
