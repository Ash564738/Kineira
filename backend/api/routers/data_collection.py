import logging
import os
from typing import List, Optional, Dict, Any
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import ACTIONS, DATA_PATH, FEATURE_SIZE, FRAMES_PER_VIDEO, VIDEOS_PER_ACTION
from ml.data_collection import DataCollector

router = APIRouter(prefix="/data-collection", tags=["data-collection"])
logger = logging.getLogger(__name__)
collector = DataCollector(data_path=DATA_PATH)


class FrameItem(BaseModel):
    frame_num: int
    keypoints: list[float]


class BatchFramePayload(BaseModel):
    frames: List[FrameItem]


@router.get("/actions")
async def get_actions():
    actions_list = list(ACTIONS)
    return {"actions": actions_list, "total": len(actions_list)}


@router.get("/status/{action}")
async def get_collection_status(action: str):
    if action not in ACTIONS:
        raise HTTPException(status_code=400, detail=f"Unknown action: {action}")
    current_collector = DataCollector(data_path=DATA_PATH)
    return current_collector.get_action_status(action)


@router.get("/status")
async def get_all_status():
    current_collector = DataCollector(data_path=DATA_PATH)
    status_dict = {}
    for action in ACTIONS:
        status_dict[action] = current_collector.get_action_status(action)
    return status_dict


@router.post("/start/{action}/{video_num}")
async def start_collection(action: str, video_num: int):
    if action not in ACTIONS:
        raise HTTPException(status_code=400, detail=f"Unknown action: {action}")
    if video_num < 1 or video_num > VIDEOS_PER_ACTION:
        raise HTTPException(status_code=400, detail=f"Video number must be 1-{VIDEOS_PER_ACTION}")
    success = collector.start_video_collection(action, video_num)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to start collection")
    return {"status": "started", "action": action, "video_num": video_num}


# ========== THAY ĐỔI: Nhận batch frame cho một video ==========
@router.post("/frame-vector/{action}/{video_num}")
async def save_frame_vector_batch(action: str, video_num: int, payload: BatchFramePayload):
    """Lưu toàn bộ 30 frame của một video trong một request."""
    if action not in ACTIONS:
        raise HTTPException(status_code=400, detail=f"Unknown action: {action}")
    if video_num < 1 or video_num > VIDEOS_PER_ACTION:
        raise HTTPException(status_code=400, detail=f"Video number must be 1-{VIDEOS_PER_ACTION}")

    # Kiểm tra danh sách frame không rỗng
    if not payload.frames:
        raise HTTPException(status_code=400, detail="No frames provided")

    saved = []
    for item in payload.frames:
        # Kiểm tra frame_num hợp lệ
        if item.frame_num < 0 or item.frame_num >= FRAMES_PER_VIDEO:
            raise HTTPException(status_code=400, detail=f"Frame number {item.frame_num} must be 0-{FRAMES_PER_VIDEO - 1}")

        # Kiểm tra độ dài keypoints
        if len(item.keypoints) != FEATURE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"Frame {item.frame_num}: expected {FEATURE_SIZE} values, got {len(item.keypoints)}"
            )

        ok, error, meta = collector.save_vector_frame(action, video_num, item.frame_num, item.keypoints)
        if not ok:
            raise HTTPException(status_code=400, detail=f"Frame {item.frame_num}: {error}")

        saved.append(meta)

    # Log tổng kết
    total_nonzero = sum(m["nonzero"] for m in saved)
    total_zeros = sum(m["zeros"] for m in saved)
    logger.info(
        "Batch saved for action=%s video=%s: %d frames, total nonzero=%d, zeros=%d",
        action, video_num, len(saved), total_nonzero, total_zeros
    )

    return {
        "status": "batch_saved",
        "action": action,
        "video_num": video_num,
        "frames_saved": len(saved),
        "total_nonzero": total_nonzero,
        "total_zeros": total_zeros,
        "frames": saved  # trả về metadata từng frame (vẫn giữ logging chi tiết)
    }
# =================================================================


@router.post("/validate/{action}")
async def validate_action_data(action: str):
    if action not in ACTIONS:
        raise HTTPException(status_code=400, detail=f"Unknown action: {action}")
    success, message = collector.validate_data(action)
    return {"action": action, "valid": success, "message": message}


@router.delete("/reset/{action}")
async def reset_collection(action: str):
    if action not in ACTIONS:
        raise HTTPException(status_code=400, detail=f"Unknown action: {action}")
    success = collector.reset_action(action)
    return {"status": "reset" if success else "error", "action": action}


@router.get("/next-video/{action}")
async def get_next_video(action: str):
    if action not in ACTIONS:
        raise HTTPException(status_code=400, detail=f"Unknown action: {action}")
    next_num = collector.get_next_video_number(action)
    return {"action": action, "next_video_num": next_num}