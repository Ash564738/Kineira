import os

# Actions: 26 letters + 10 common words
# ACTIONS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ") + [
#     "HELLO",
#     "THANKYOU",
#     "YES",
#     "NO",
#     "PLEASE",
#     "SORRY",
#     "LOVE",
#     "HELP",
#     "EAT",
#     "DRINK",
# ]

ACTIONS = list("ABC") + [
    "HELLO",
]

VIDEOS_PER_ACTION = 60
FRAMES_PER_VIDEO = 30

N_POSE = 33
N_FACE = 468
N_HAND = 21
FEATURE_SIZE = N_POSE * 4 + N_FACE * 3 + N_HAND * 3 + N_HAND * 3  # 1662

BACKEND_DIR = os.path.abspath(os.path.dirname(__file__))
DATASETS_DIR = os.path.join(BACKEND_DIR, "datasets")
DATA_PATH = os.path.join(DATASETS_DIR, "MP_Data")
ASSETS_DIR = os.path.join(BACKEND_DIR, "assets")
MODELS_DIR = os.path.join(ASSETS_DIR, "models")
MODEL_PATH = os.path.join(MODELS_DIR, "action.h5")
HOLISTIC_MODEL_PATH = os.path.join(MODELS_DIR, "holistic_landmarker.task")

# Training settings – giống notebook gốc
LSTM_EPOCHS = 2000
LSTM_BATCH_SIZE = 32
SEQUENCE_LENGTH = 30

MAX_UPLOAD_SIZE = 50 * 1024 * 1024