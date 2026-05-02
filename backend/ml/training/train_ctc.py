import json
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.optim.lr_scheduler import ReduceLROnPlateau
from torch.utils.data import DataLoader, Dataset, random_split

from ml.preprocess import prepare_frame

BACKEND_ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS_DIR = BACKEND_ROOT / "artifacts"
DATA_FILE = ARTIFACTS_DIR / "training_data.json"
MODEL_FILE = ARTIFACTS_DIR / "models" / "ctc_model.pth"

MAX_FRAMES = 100
HAND_POINTS = 21
POSE_POINTS = 8
FACE_POINTS = 10
INPUT_SIZE = (HAND_POINTS * 3 * 2) + (POSE_POINTS * 3) + (FACE_POINTS * 3)

HIDDEN = 256
EPOCHS = 80
BATCH_SIZE = 16
LR = 5e-4
BLANK = 0


def resolve_training_data() -> Path:
    if DATA_FILE.exists():
        return DATA_FILE
    return BACKEND_ROOT / "training_data.json"


with open(resolve_training_data(), "r", encoding="utf-8") as f:
    raw = json.load(f)

sentences = [str(item.get("gloss", "")).lower().strip() for item in raw if str(item.get("gloss", "")).lower().strip()]
words = sorted(set(" ".join(sentences).split()))
words = ["<blank>"] + words
word2idx = {w: i for i, w in enumerate(words)}


def frame_to_vec(frame):
    return prepare_frame(frame, mode="sentence")


def seq_pad(seq):
    if not seq:
        return None
    if len(seq) > MAX_FRAMES:
        idx = np.linspace(0, len(seq) - 1, MAX_FRAMES).astype(int)
        seq = [seq[i] for i in idx]
    else:
        last = seq[-1]
        while len(seq) < MAX_FRAMES:
            seq.append(last.copy())
    return np.array(seq, dtype=np.float32)


class CTCDataset(Dataset):
    def __init__(self, data):
        self.samples = []
        for item in data:
            seq = seq_pad([frame_to_vec(f) for f in item.get("landmarks", [])])
            if seq is None:
                continue
            text = str(item.get("gloss", "")).lower().strip()
            target = [word2idx[t] for t in text.split() if t in word2idx]
            if len(target) == 0 or len(target) > MAX_FRAMES:
                continue
            self.samples.append((seq, target))

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        x, y = self.samples[idx]
        if self.training:
            noise = np.random.normal(0, 0.003, x.shape).astype(np.float32)
            x = x + noise
        return torch.tensor(x, dtype=torch.float32), torch.tensor(y, dtype=torch.long)


def collate(batch):
    xs, ys = zip(*batch)
    x = torch.stack(xs)
    y_lens = torch.tensor([len(y) for y in ys], dtype=torch.long)
    y = torch.cat(ys)
    x_lens = torch.full((len(xs),), MAX_FRAMES, dtype=torch.long)
    return x, y, x_lens, y_lens


class CTCModel(nn.Module):
    def __init__(self, vocab_size):
        super().__init__()
        self.lstm = nn.LSTM(INPUT_SIZE, HIDDEN, num_layers=3, bidirectional=True, batch_first=True, dropout=0.3)
        self.fc = nn.Sequential(nn.Linear(HIDDEN * 2, 256), nn.ReLU(), nn.Dropout(0.3), nn.Linear(256, vocab_size))

    def forward(self, x):
        x, _ = self.lstm(x)
        x = self.fc(x)
        return F.log_softmax(x, dim=-1)


def main():
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print("Device:", device)
    full_dataset = CTCDataset(raw)
    train_size = int(len(full_dataset) * 0.85)
    val_size = len(full_dataset) - train_size
    train_dataset, val_dataset = random_split(full_dataset, [train_size, val_size])
    train_dataset.dataset.training = True
    val_dataset.dataset.training = False

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, collate_fn=collate)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, collate_fn=collate)

    MODEL_FILE.parent.mkdir(parents=True, exist_ok=True)
    model = CTCModel(len(words)).to(device)
    criterion = nn.CTCLoss(blank=BLANK, zero_infinity=True)
    optimizer = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-4)
    scheduler = ReduceLROnPlateau(optimizer, mode="min", factor=0.5, patience=5)
    best_val_loss = float("inf")

    for epoch in range(EPOCHS):
        model.train()
        train_loss = 0.0
        for x, y, x_len, y_len in train_loader:
            x, y = x.to(device), y.to(device)
            x_len, y_len = x_len.to(device), y_len.to(device)
            optimizer.zero_grad()
            out = model(x).permute(1, 0, 2)
            loss = criterion(out, y, x_len, y_len)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            train_loss += loss.item()

        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for x, y, x_len, y_len in val_loader:
                x, y = x.to(device), y.to(device)
                x_len, y_len = x_len.to(device), y_len.to(device)
                out = model(x).permute(1, 0, 2)
                val_loss += criterion(out, y, x_len, y_len).item()

        avg_train_loss = train_loss / max(1, len(train_loader))
        avg_val_loss = val_loss / max(1, len(val_loader))
        scheduler.step(avg_val_loss)
        print(f"Epoch {epoch + 1:02d}/{EPOCHS} | Train Loss: {avg_train_loss:.4f} | Val Loss: {avg_val_loss:.4f}")
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            torch.save({"model_state_dict": model.state_dict(), "gloss_vocab": words, "input_size": INPUT_SIZE}, MODEL_FILE)
            print("  -> Saved best model!")

    print("DONE. Best Validation Loss:", best_val_loss)


if __name__ == "__main__":
    main()
