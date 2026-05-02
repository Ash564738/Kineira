import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import torch
import torch.nn as nn

from api.services.scoring import compute_overall_score, generate_feedback
from ml.preprocess import INPUT_SIZE, preprocess_sequence

logger = logging.getLogger(__name__)
device = "cuda" if torch.cuda.is_available() else "cpu"

BASE_DIR = Path(__file__).resolve().parents[2]
ARTIFACTS_DIR = BASE_DIR / "artifacts"
MODELS_DIR = ARTIFACTS_DIR / "models"

ALPHABET_MODEL_PATH = MODELS_DIR / "alphabet_model.pth"
WORD_MODEL_PATH = MODELS_DIR / "word_model.pth"
CTC_MODEL_PATH = MODELS_DIR / "ctc_model.pth"
TRAINING_DATA_PATH = ARTIFACTS_DIR / "training_data.json"

LEGACY_ALPHABET_MODEL_PATH = BASE_DIR / "alphabet_model.pth"
LEGACY_WORD_MODEL_PATH = BASE_DIR / "word_model.pth"
LEGACY_CTC_MODEL_PATH = BASE_DIR / "ctc_model.pth"
LEGACY_TRAINING_DATA_PATH = BASE_DIR / "training_data.json"


class AlphabetModel(nn.Module):
    def __init__(self, num_classes: int):
        super().__init__()
        self.lstm = nn.LSTM(INPUT_SIZE, 64, num_layers=1, batch_first=True, bidirectional=True)
        self.dropout = nn.Dropout(0.5)
        self.fc = nn.Sequential(nn.Linear(128, 64), nn.ReLU(), nn.Dropout(0.4), nn.Linear(64, num_classes))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.lstm(x)
        out = out.mean(dim=1)
        out = self.dropout(out)
        return self.fc(out)


class WordModel(nn.Module):
    def __init__(self, num_classes: int):
        super().__init__()
        self.lstm = nn.LSTM(INPUT_SIZE, 256, num_layers=3, batch_first=True, bidirectional=True, dropout=0.4)
        self.fc = nn.Sequential(
            nn.Linear(512, 256),
            nn.BatchNorm1d(256),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(256, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.lstm(x)
        out = torch.mean(out, dim=1)
        return self.fc(out)


class CTCModel(nn.Module):
    def __init__(self, vocab_size: int):
        super().__init__()
        self.lstm = nn.LSTM(INPUT_SIZE, 256, num_layers=3, batch_first=True, bidirectional=True, dropout=0.3)
        self.fc = nn.Sequential(nn.Linear(512, 256), nn.ReLU(), nn.Dropout(0.3), nn.Linear(256, vocab_size))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.lstm(x)
        out = self.fc(out)
        return torch.nn.functional.log_softmax(out, dim=-1)


class InferenceService:
    def __init__(self) -> None:
        self.alphabet_model: Optional[AlphabetModel] = None
        self.word_model: Optional[WordModel] = None
        self.ctc_model: Optional[CTCModel] = None
        self.alphabet: List[str] = []
        self.words: List[str] = []
        self.gloss_vocab: List[str] = []
        self.reference_data: Dict[str, Any] = {}

    def startup(self) -> None:
        self.load_models()
        self.load_reference_data()

    def load_models(self) -> None:
        alphabet_path = ALPHABET_MODEL_PATH if ALPHABET_MODEL_PATH.exists() else LEGACY_ALPHABET_MODEL_PATH
        word_path = WORD_MODEL_PATH if WORD_MODEL_PATH.exists() else LEGACY_WORD_MODEL_PATH
        ctc_path = CTC_MODEL_PATH if CTC_MODEL_PATH.exists() else LEGACY_CTC_MODEL_PATH

        if alphabet_path.exists():
            ckpt = torch.load(alphabet_path, map_location=device, weights_only=False)
            self.alphabet = ckpt["alphabet"]
            self.alphabet_model = AlphabetModel(len(self.alphabet)).to(device)
            self.alphabet_model.load_state_dict(ckpt["model_state_dict"])
            self.alphabet_model.eval()

        if word_path.exists():
            ckpt = torch.load(word_path, map_location=device, weights_only=False)
            self.words = ckpt["words"]
            self.word_model = WordModel(len(self.words)).to(device)
            self.word_model.load_state_dict(ckpt["model_state_dict"])
            self.word_model.eval()

        if ctc_path.exists():
            ckpt = torch.load(ctc_path, map_location=device, weights_only=False)
            self.gloss_vocab = ckpt.get("gloss_vocab", [])
            if self.gloss_vocab:
                self.ctc_model = CTCModel(len(self.gloss_vocab)).to(device)
                self.ctc_model.load_state_dict(ckpt["model_state_dict"])
                self.ctc_model.eval()

    def load_reference_data(self) -> None:
        path = TRAINING_DATA_PATH if TRAINING_DATA_PATH.exists() else LEGACY_TRAINING_DATA_PATH
        if not path.exists():
            return
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        for item in data:
            gloss = str(item.get("gloss", "")).lower().strip()
            if gloss and gloss not in self.reference_data:
                self.reference_data[gloss] = item.get("landmarks", [])

    def _decode_ctc(self, logits: torch.Tensor) -> tuple[str, float]:
        probs = torch.exp(logits)
        pred_ids = torch.argmax(probs, dim=2).squeeze(0).cpu().numpy()
        tokens: List[str] = []
        confs: List[float] = []
        prev = -1
        for t, idx in enumerate(pred_ids):
            if idx != 0 and idx != prev and idx < len(self.gloss_vocab):
                tokens.append(self.gloss_vocab[idx])
                confs.append(float(probs[0, t, idx].item()))
            prev = idx
        return " ".join(tokens), (float(np.mean(confs)) if confs else 0.0)

    def recognize(self, landmarks_sequence: List[Any], mode: str = "word") -> Dict[str, Any]:
        mode = (mode or "word").lower()
        seq = preprocess_sequence(landmarks_sequence, mode=mode)
        if seq is None:
            return {"sign": "unknown", "confidence": 0.0, "gloss": "", "sentence": ""}

        x = torch.tensor(seq).unsqueeze(0).to(device)
        if mode == "alphabet" and self.alphabet_model:
            with torch.no_grad():
                out = self.alphabet_model(x)
                probs = torch.softmax(out, dim=1)
                conf, pred = torch.max(probs, 1)
            label = self.alphabet[pred.item()]
            return {"sign": label, "confidence": float(conf.item()), "gloss": label, "sentence": label}

        if mode == "sentence" and self.ctc_model:
            with torch.no_grad():
                out = self.ctc_model(x)
            sentence, conf = self._decode_ctc(out)
            return {"sign": "sequence", "confidence": conf, "gloss": sentence, "sentence": sentence}

        if self.word_model:
            with torch.no_grad():
                out = self.word_model(x)
                probs = torch.softmax(out, dim=1)
                conf, pred = torch.max(probs, 1)
            label = self.words[pred.item()]
            return {"sign": label, "confidence": float(conf.item()), "gloss": label, "sentence": label}

        return {"sign": "unknown", "confidence": 0.0, "gloss": "", "sentence": ""}

    def score(self, landmarks_sequence: List[Any], reference_sign: str, mode: str = "word") -> Dict[str, Any]:
        user = preprocess_sequence(landmarks_sequence, mode=mode)
        ref_raw = self.reference_data.get(reference_sign.lower())
        if not ref_raw:
            return {
                "score": 0.0,
                "feedback": "Reference sign not found in dataset.",
                "details": {"accuracy": 0, "completeness": 0, "timing": 0},
                "is_correct": False,
                "reference_sign": reference_sign,
                "user_sign": "unknown",
            }

        reference = preprocess_sequence(ref_raw, mode=mode)
        if user is None or reference is None:
            return {
                "score": 0.0,
                "feedback": "Unable to process sign sequence.",
                "details": {"accuracy": 0, "completeness": 0, "timing": 0},
                "is_correct": False,
                "reference_sign": reference_sign,
                "user_sign": "unknown",
            }

        details = compute_overall_score(user, reference)
        prediction = self.recognize(landmarks_sequence, mode=mode)
        return {
            "score": details["score"],
            "feedback": generate_feedback(details["score"]),
            "details": {
                "accuracy": details["accuracy"],
                "completeness": details["completeness"],
                "timing": details["timing"],
            },
            "is_correct": prediction["sign"].lower() == reference_sign.lower(),
            "reference_sign": reference_sign,
            "user_sign": prediction["sign"],
        }


inference_service = InferenceService()
