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

ACTIONS = list("AB") + [
    "HELLO",
    "LOVE"
]

VIDEOS_PER_ACTION = 100
FRAMES_PER_VIDEO = 30

# Keypoints configuration
N_HAND = 21
N_POSE = 23
FACE_EXPRESSION_INDICES = [
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 95,
    70, 63, 105, 66, 107, 336, 296, 334, 293, 300,
    33, 133, 362, 263, 1, 4, 168
]
N_FACE = len(FACE_EXPRESSION_INDICES)

# Thứ tự: LEFT_HAND(63) + RIGHT_HAND(63) + POSE_UPPER(92) + FACE_EXPRESSION(111) = 329
FEATURE_SIZE = (N_HAND * 3) + (N_HAND * 3) + (N_POSE * 4) + (N_FACE * 3)

BACKEND_DIR = os.path.abspath(os.path.dirname(__file__))
DATASETS_DIR = os.path.join(BACKEND_DIR, "datasets")
DATA_PATH = os.path.join(DATASETS_DIR, "MP_Data")
ASSETS_DIR = os.path.join(BACKEND_DIR, "assets")
MODELS_DIR = os.path.join(ASSETS_DIR, "models")
MODEL_PATH = os.path.join(MODELS_DIR, "action.h5")
ACTIONS_META_PATH = os.path.join(MODELS_DIR, "actions.json")
SCALER_PATH = os.path.join(MODELS_DIR, "scaler.json")
HOLISTIC_MODEL_PATH = os.path.join(MODELS_DIR, "holistic_landmarker.task")
REFERENCES_DIR = os.path.join(DATASETS_DIR, "references")
RAW_VIDEOS_DIR = os.path.join(DATASETS_DIR, "WLASL", "start_kit", "raw_videos")

# Training settings
LSTM_EPOCHS = 2000
LSTM_BATCH_SIZE = 32
SEQUENCE_LENGTH = 30
MAX_UPLOAD_SIZE = 50 * 1024 * 1024