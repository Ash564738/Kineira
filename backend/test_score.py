import requests, numpy as np
data = np.load(r"E:\Kineira\backend\datasets\MP_Data\HELLO\11\1.npy")
user_sequence = data.tolist() * 30  # tạo 30 frame giả
res = requests.post("http://localhost:8000/score", json={
    "user_sequence": user_sequence,
    "target_sign": "HELLO"
}).json()
print("display_score:", res["display_score"])
print("pose_similarity:", res["pose_similarity"])
print("face_similarity:", res["face_similarity"])