import React, { useState, useRef, useEffect } from "react";
import CameraView from "../components/camera/CameraView";
import TopNav from "../components/layout/TopNav";
import { FRAMES_PER_VIDEO, FEATURE_SIZE, FrameSample } from "../types/landmarks";
import { resetTranslate } from "@/services/api/client";

const COOLDOWN_MS = 500;

const log = {
  info: (msg: string, data?: any) => console.log(`[TRANSLATE_PAGE] INFO: ${msg}`, data || ''),
  debug: (msg: string, data?: any) => console.debug(`[TRANSLATE_PAGE] DEBUG: ${msg}`, data || ''),
  warn: (msg: string, data?: any) => console.warn(`[TRANSLATE_PAGE] WARN: ${msg}`, data || ''),
  error: (msg: string, data?: any) => console.error(`[TRANSLATE_PAGE] ERROR: ${msg}`, data || ''),
};

const Translate: React.FC = () => {
  const [isTranslating, setIsTranslating] = useState(false);
  const [prediction, setPrediction] = useState("");
  const [confidence, setConfidence] = useState(0.0);
  const [error, setError] = useState("");

  const isTranslatingRef = useRef(false);
  const keypointsBufferRef = useRef<number[][]>([]);
  const cooldownRef = useRef(false);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isTranslatingRef.current = isTranslating;
    log.info(`Translation mode ${isTranslating ? 'ENABLED' : 'DISABLED'}`);
    if (isTranslating) {
      keypointsBufferRef.current = [];
      cooldownRef.current = false;
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    } else {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    }
  }, [isTranslating]);

  const translateSequence = async (sequence: number[][]) => {
    log.info("=".repeat(60));
    log.info("TRANSLATE API CALL STARTED");
    log.info("=".repeat(60));
    log.info(`Sending translation request - sequence length: ${sequence.length} frames`);

    try {
      const res = await fetch("http://localhost:8000/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keypoints_sequence: sequence })
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);

      const data = await res.json();
      log.info(`Translation result: sign='${data.sign}', confidence=${data.confidence.toFixed(4)}`);
      log.info("=".repeat(60));
      log.info("TRANSLATE API CALL COMPLETED");
      log.info("=".repeat(60));

      // ✅ XỬ LÝ CÁC TRƯỜNG HỢP ĐẶC BIỆT
      if (data.sign === "unknown") {
        setPrediction("unknown");
        setConfidence(0);
        setError("");
      } else if (data.sign === "model_not_loaded") {
        setError("Model not loaded");
      } else {
        setPrediction(data.sign);
        setConfidence(data.confidence);
        setError("");
      }
    } catch (err: any) {
      log.error(`Translation failed: ${err.message}`, err);
      log.info("=".repeat(60));
      log.info("TRANSLATE API CALL FAILED");
      log.info("=".repeat(60));
      setError(`Translation failed: ${err.message}`);
    }
  };

  const handleFrameDetected = (sample: FrameSample) => {
    if (!isTranslatingRef.current) return;
    if (cooldownRef.current) return;

    if (sample.keypoints.length === FEATURE_SIZE) {
      keypointsBufferRef.current.push([...sample.keypoints]);

      log.debug(`Frame added to buffer - current length: ${keypointsBufferRef.current.length}/${FRAMES_PER_VIDEO}`);

      if (keypointsBufferRef.current.length === FRAMES_PER_VIDEO) {
        const sequence = [...keypointsBufferRef.current];
        translateSequence(sequence);
        keypointsBufferRef.current = [];

        cooldownRef.current = true;
        if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = setTimeout(() => {
          cooldownRef.current = false;
          cooldownTimerRef.current = null;
          log.debug("Cooldown ended, ready for next sign");
        }, COOLDOWN_MS);
      }
    } else {
      log.debug(`Invalid frame - keypoints length: ${sample.keypoints.length}, expected: ${FEATURE_SIZE}`);
    }
  };

  const startTranslation = async () => {
    setPrediction("");
    setConfidence(0.0);
    setError("");
    try {
      await resetTranslate();
    } catch (e) {
      console.warn("Reset smoother failed", e);
    }
    setIsTranslating(true);
  };

  const stopTranslation = () => {
    setIsTranslating(false);
    keypointsBufferRef.current = [];
    cooldownRef.current = false;
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <TopNav active="translate" />
      <main className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold mb-6">Translate Sign Language</h1>

        <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">Camera</h2>
            <div className="text-sm text-white/60">
              {isTranslating ? "Translating..." : "Ready"}
            </div>
          </div>

          <CameraView
            isRecording={isTranslating}
            mode="recognition"
            onFrameDetected={handleFrameDetected}
          />

          <div className="flex justify-center mt-4 gap-3">
            {!isTranslating ? (
              <button
                onClick={startTranslation}
                className="px-6 py-2 rounded-lg bg-green-500 text-black font-semibold"
              >
                Start Translate
              </button>
            ) : (
              <button
                onClick={stopTranslation}
                className="px-6 py-2 rounded-lg bg-red-500 text-white font-semibold"
              >
                Stop
              </button>
            )}
          </div>

          {/* ✅ HIỂN THỊ KẾT QUẢ ĐÃ ĐƯỢC CẢI TIẾN */}
          <div className="mt-6 p-4 rounded-xl bg-slate-800/50 border border-white/10">
            <div className="text-sm text-white/50 mb-1">Prediction</div>
            {error ? (
              <p className="text-red-400 text-sm">{error}</p>
            ) : prediction === "unknown" ? (
              <p className="text-yellow-400 italic">Đang phân tích – hãy giữ ký hiệu ổn định...</p>
            ) : prediction ? (
              <div>
                <span className="text-3xl font-bold text-white">{prediction}</span>
                <span className="ml-3 text-sm text-green-400">
                  {(confidence * 100).toFixed(1)}% confidence
                </span>
              </div>
            ) : (
              <p className="text-white/40 italic">Waiting for sign...</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Translate;