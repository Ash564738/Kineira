# api/services/ai_service.py
import os
import json
import logging

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

# Tự động khởi tạo client bằng API Key từ biến môi trường
api_key = os.getenv("GOOGLE_API_KEY")
client = genai.Client(api_key=api_key) if api_key else None


def get_ai_coach_feedback(
    sign: str,
    hand_similarity: float,
    motion_score: float,
    body_score: float,
    overall_score: float,
    finger_details: dict = None,
    recent_scores: list[dict] = None,
) -> dict | None:
    logger.debug(
        "AI coach feedback requested for sign='%s', overall=%.0f%%, hand=%.0f%%, motion=%.0f%%, body=%.0f%%",
        sign, overall_score, hand_similarity*100, motion_score*100, body_score*100
    )

    if not os.getenv("GOOGLE_API_KEY") or client is None:
        logger.warning("GOOGLE_API_KEY not set – skipping AI coach")
        return None

    # 1. Chuẩn bị dữ liệu chuỗi bổ sung
    finger_text = ""
    if finger_details:
        finger_text = "Finger accuracy:\n"
        for finger, info in finger_details.items():
            finger_text += (
                f"- {finger}: {info.get('similarity', 0)*100:.0f}% "
                f"(curl: {info.get('curl_similarity', 0)*100:.0f}%, "
                f"extension: {info.get('extension_similarity', 0)*100:.0f}%)\n"
            )
        logger.debug("Built finger details text:\n%s", finger_text)

    recent_text = ""
    if recent_scores:
        recent_text = "Recent sign history:\n"
        for s in recent_scores:
            recent_text += f"- {s['sign']}: average {s['avg']:.0f}% ({s['count']} attempts)\n"
        logger.debug("Built recent scores text:\n%s", recent_text)

    # 2. Xây dựng cấu trúc Định dạng dữ liệu đầu ra bắt buộc (Structured Outputs)
    json_schema = types.Schema(
        type=types.Type.OBJECT,
        properties={
            "overall_score": types.Schema(type=types.Type.INTEGER),
            "hand_feedback": types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "name": types.Schema(type=types.Type.STRING),
                    "score": types.Schema(type=types.Type.INTEGER),
                    "issues": types.Schema(type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING)),
                    "recommendations": types.Schema(type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING)),
                },
                required=["name", "score", "issues", "recommendations"]
            ),
            "motion_feedback": types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "name": types.Schema(type=types.Type.STRING),
                    "score": types.Schema(type=types.Type.INTEGER),
                    "issues": types.Schema(type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING)),
                    "recommendations": types.Schema(type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING)),
                },
                required=["name", "score", "issues", "recommendations"]
            ),
            "body_feedback": types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "name": types.Schema(type=types.Type.STRING),
                    "score": types.Schema(type=types.Type.INTEGER),
                    "issues": types.Schema(type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING)),
                    "recommendations": types.Schema(type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING)),
                },
                required=["name", "score", "issues", "recommendations"]
            ),
            "weak_signs": types.Schema(type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING)),
            "practice_plan": types.Schema(
                type=types.Type.ARRAY,
                items=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "sign": types.Schema(type=types.Type.STRING),
                        "times": types.Schema(type=types.Type.INTEGER),
                        "reason": types.Schema(type=types.Type.STRING),
                    },
                    required=["sign", "times", "reason"]
                )
            ),
            "xp_earned": types.Schema(type=types.Type.INTEGER),
            "encouragement": types.Schema(type=types.Type.STRING),
        },
        required=[
            "overall_score", "hand_feedback", "motion_feedback",
            "body_feedback", "weak_signs", "practice_plan",
            "xp_earned", "encouragement"
        ]
    )

    system_instruction = (
        "You are a friendly, expert sign language coach. Analyze the user's performance data "
        "and give detailed, constructive feedback in valid JSON format.\n"
        "Base your feedback on the provided metrics. If a metric is high, praise it; if low, give specific, actionable tips.\n"
        f"The user performed the sign \"{sign}\"."
    )

    user_prompt = f"""
Performance for sign "{sign}":
- Overall score: {overall_score:.0f}%
- Hand similarity: {hand_similarity*100:.0f}%
- Motion score: {motion_score*100:.0f}%
- Body posture: {body_score*100:.0f}%

{finger_text}
{recent_text}
Based on these numbers, provide encouraging feedback and a practice plan.
"""

    logger.debug("Sending AI request to Gemini with prompt length %d chars", len(user_prompt))

    try:
        # Sử dụng mô hình mới nhất 'gemini-2.5-flash' tương thích hoàn toàn với API v1beta
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=json_schema,
                temperature=0.2,
            ),
        )

        if response.text:
            logger.debug("AI response received successfully, length %d", len(response.text))
            return json.loads(response.text)

        logger.warning("AI response was empty")
        return None

    except Exception as e:
        logger.exception("AI Coach error: %s", e)
        return None