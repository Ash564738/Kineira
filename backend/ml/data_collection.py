# ml/data_collection.py
import logging
import os
import shutil
from typing import Optional, Tuple, Dict, Any
import numpy as np

from config import ACTIONS, DATA_PATH, FEATURE_SIZE, FRAMES_PER_VIDEO, VIDEOS_PER_ACTION

logger = logging.getLogger(__name__)

class DataCollector:
    def __init__(self, data_path: str = None):
        if data_path is None:
            data_path = DATA_PATH
        self.data_path = os.path.abspath(data_path)
        self.current_action: Optional[str] = None
        self.current_video_num: Optional[int] = None
        self.current_frame_num: Optional[int] = None
        os.makedirs(self.data_path, exist_ok=True)
        logger.info("DataCollector initialized with path: %s", self.data_path)

    def _action_dir(self, action: str) -> str:
        return os.path.join(self.data_path, action)

    def _video_dir(self, action: str, video_num: int) -> str:
        return os.path.join(self.data_path, action, str(video_num))

    def _frame_exists(self, video_dir: str, frame_num: int) -> bool:
        return os.path.exists(os.path.join(video_dir, f"{frame_num}.npy"))

    def _video_is_complete(self, action: str, video_num: int) -> bool:
        video_dir = self._video_dir(action, video_num)
        if not os.path.isdir(video_dir):
            return False
        for frame_num in range(FRAMES_PER_VIDEO):
            if not self._frame_exists(video_dir, frame_num):
                return False
        return True

    def get_action_status(self, action: str) -> dict:
        if action not in ACTIONS:
            return {
                "action": action,
                "videos_collected": 0,
                "target": VIDEOS_PER_ACTION,
                "is_collecting": False,
                "current_video": None,
                "current_frame": None,
            }
        videos_collected = 0
        for video_num in range(1, VIDEOS_PER_ACTION + 1):
            if self._video_is_complete(action, video_num):
                videos_collected += 1
        return {
            "action": action,
            "videos_collected": videos_collected,
            "target": VIDEOS_PER_ACTION,
            "is_collecting": self.current_action == action,
            "current_video": self.current_video_num if self.current_action == action else None,
            "current_frame": self.current_frame_num if self.current_action == action else None,
        }

    def delete_video(self, action: str, video_num: int) -> bool:
        """Xoá một video cụ thể (thư mục chứa các frame)."""
        if action not in ACTIONS:
            return False
        video_dir = self._video_dir(action, video_num)
        if os.path.exists(video_dir):
            try:
                shutil.rmtree(video_dir)
                logger.info("Deleted video %s for action %s", video_num, action)
                return True
            except Exception as e:
                logger.exception("Failed to delete video %s: %s", video_num, e)
                return False
        return True  # coi như đã xoá nếu không tồn tại

    def start_video_collection(self, action: str, video_num: int, overwrite: bool = False) -> bool:
        """
        Bắt đầu thu thập video. Nếu overwrite=True và thư mục video đã tồn tại,
        xoá thư mục cũ trước khi tạo mới.
        """
        if action not in ACTIONS:
            logger.warning("Unknown action requested: %s", action)
            return False
        try:
            video_dir = self._video_dir(action, video_num)
            if os.path.exists(video_dir):
                if overwrite:
                    self.delete_video(action, video_num)
                else:
                    logger.warning("Video %s already exists for action %s, not overwriting.", video_num, action)
                    return False
            os.makedirs(video_dir, exist_ok=True)
            self.current_action = action
            self.current_video_num = video_num
            self.current_frame_num = 0
            logger.info("Started collection for %s video %s at %s", action, video_num, video_dir)
            return True
        except Exception as e:
            logger.exception("Failed to start video collection: %s", e)
            return False

    def save_vector_frame(
        self,
        action: str,
        video_num: int,
        frame_num: int,
        keypoints: list[float],
    ) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        if action not in ACTIONS:
            return False, f"Unknown action: {action}", None
        if frame_num < 0 or frame_num >= FRAMES_PER_VIDEO:
            return False, f"Frame number must be 0-{FRAMES_PER_VIDEO - 1}", None

        try:
            arr = np.asarray(keypoints, dtype=np.float32)
            if arr.shape != (FEATURE_SIZE,):
                return False, f"Expected {FEATURE_SIZE} values, got {arr.shape[0]}", None
            if not np.isfinite(arr).all():
                return False, "Keypoints contains NaN or Inf", None
            if np.count_nonzero(arr) == 0:
                return False, "Keypoints are all zeros", None
            zero_ratio = float(np.mean(arr == 0))
            if zero_ratio > 0.95:
                return False, f"Zero ratio too high: {zero_ratio:.4f}", None

            video_dir = self._video_dir(action, video_num)
            os.makedirs(video_dir, exist_ok=True)
            file_path = os.path.join(video_dir, f"{frame_num}.npy")
            np.save(file_path, arr)

            self.current_action = action
            self.current_video_num = video_num
            self.current_frame_num = frame_num

            meta = {
                "status": "saved",
                "action": action,
                "video_num": video_num,
                "frame_num": frame_num,
                "shape": int(arr.shape[0]),
                "nonzero": int(np.count_nonzero(arr)),
                "zeros": int(np.sum(arr == 0)),
                "min": float(arr.min()),
                "max": float(arr.max()),
                "preview": arr[:20].tolist(),
                "path": file_path,
            }

            logger.info(
                "Saved vector frame | action=%s video=%s frame=%s path=%s shape=%s nonzero=%s zeros=%s",
                action, video_num, frame_num, file_path, arr.shape[0], int(np.count_nonzero(arr)), int(np.sum(arr == 0))
            )
            return True, None, meta
        except Exception as e:
            logger.exception("Failed to save vector frame: %s", e)
            return False, str(e), None

    def validate_data(self, action: str) -> Tuple[bool, str]:
        if action not in ACTIONS:
            return False, f"Unknown action: {action}"
        completed = 0
        for video_num in range(1, VIDEOS_PER_ACTION + 1):
            if self._video_is_complete(action, video_num):
                completed += 1
        if completed == VIDEOS_PER_ACTION:
            return True, f"All {VIDEOS_PER_ACTION} videos are complete for '{action}'"
        return False, f"{completed}/{VIDEOS_PER_ACTION} videos complete for '{action}'"

    def reset_action(self, action: str) -> bool:
        if action not in ACTIONS:
            return False
        try:
            action_dir = self._action_dir(action)
            if os.path.exists(action_dir):
                shutil.rmtree(action_dir)
            os.makedirs(action_dir, exist_ok=True)
            if self.current_action == action:
                self.current_action = None
                self.current_video_num = None
                self.current_frame_num = None
            return True
        except Exception as e:
            logger.exception("Failed to reset action: %s", e)
            return False

    def get_next_video_number(self, action: str) -> int:
        action_dir = self._action_dir(action)
        if not os.path.exists(action_dir):
            return 1
        existing = [int(d) for d in os.listdir(action_dir) if d.isdigit()]
        return max(existing) + 1 if existing else 1