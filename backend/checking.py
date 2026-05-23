import os
import numpy as np

# =========================
# CONFIG
# =========================
DATASET_DIR = r"E:\Kineira\backend\datasets\MP_Data"

FRAMES_PER_VIDEO = 30
FEATURE_SIZE = 1662

# =========================
# SCAN
# =========================
total_ok = 0
total_errors = 0

print(f"\nScanning dataset: {DATASET_DIR}\n")

for action in sorted(os.listdir(DATASET_DIR)):
    action_path = os.path.join(DATASET_DIR, action)

    if not os.path.isdir(action_path):
        continue

    print(f"\n========== ACTION: {action} ==========")

    for video in sorted(os.listdir(action_path), key=lambda x: int(x)):
        video_path = os.path.join(action_path, video)

        if not os.path.isdir(video_path):
            continue

        problems = []

        # -------------------------
        # Check missing frames
        # -------------------------
        for frame_num in range(FRAMES_PER_VIDEO):
            frame_file = os.path.join(video_path, f"{frame_num}.npy")

            if not os.path.exists(frame_file):
                problems.append(f"Missing frame: {frame_num}")
                continue

            try:
                arr = np.load(frame_file)

                # -------------------------
                # Check shape
                # -------------------------
                if arr.shape != (FEATURE_SIZE,):
                    problems.append(
                        f"Bad shape frame {frame_num}: {arr.shape}"
                    )

                # -------------------------
                # Check NaN / Inf
                # -------------------------
                if np.isnan(arr).any():
                    problems.append(f"NaN values frame {frame_num}")

                if np.isinf(arr).any():
                    problems.append(f"Inf values frame {frame_num}")

                # -------------------------
                # Check all zero
                # -------------------------
                nonzero = np.count_nonzero(arr)

                if nonzero == 0:
                    problems.append(f"ALL ZERO frame {frame_num}")

                # -------------------------
                # Optional: high zero ratio
                # -------------------------
                zero_ratio = np.mean(arr == 0)

                if zero_ratio > 0.95:
                    problems.append(
                        f"High zero ratio frame {frame_num}: {zero_ratio:.2%}"
                    )

            except Exception as e:
                problems.append(f"Load error frame {frame_num}: {e}")

        # -------------------------
        # Print result
        # -------------------------
        if problems:
            total_errors += 1

            print(f"\n[ERROR] {action}/{video}")

            for p in problems:
                print(f"  - {p}")

        else:
            total_ok += 1
            print(f"[OK] {action}/{video}")

# =========================
# SUMMARY
# =========================
print("\n==============================")
print("SCAN COMPLETE")
print("==============================")
print(f"Valid videos : {total_ok}")
print(f"Problem videos: {total_errors}")
print("==============================")