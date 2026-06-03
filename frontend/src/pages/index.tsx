// src/pages/index.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import CameraView from "../components/camera/CameraView";
import TopNav from "../components/layout/TopNav";
import { FRAMES_PER_VIDEO, FEATURE_SIZE, FrameSample } from "../types/landmarks";
import { resetTranslate } from "@/services/api/client";

const WINDOW_SIZE = 30;      // số frame mỗi lần gửi
const SLIDE_STEP = 5;        // trượt 5 frame mỗi lần (có thể chỉnh)

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
  const [sentence, setSentence] = useState("");

  const isTranslatingRef = useRef(false);
  const frameBufferRef = useRef<number[][]>([]);   // buffer lớn
  const processingRef = useRef(false);              // tránh gọi API chồng lấn
  const lastSentIndex = useRef(0);                  // vị trí cuối cùng đã gửi
  const [readyToSign, setReadyToSign] = useState(false);

  useEffect(() => {
    isTranslatingRef.current = isTranslating;
    log.info(`Translation mode ${isTranslating ? 'ENABLED' : 'DISABLED'}`);
    if (isTranslating) {
      frameBufferRef.current = [];
      processingRef.current = false;
      lastSentIndex.current = 0;
    }
  }, [isTranslating]);

  const translateWindow = async (sequence: number[][]) => {
    log.info("TRANSLATE API CALL STARTED");
    try {
      const res = await fetch("http://localhost:8000/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keypoints_sequence: sequence })
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);

      const data = await res.json();
      if (data.sentence) {
        setSentence(data.sentence);
      }

      log.info(`Translation result: sign='${data.sign}', confidence=${data.confidence.toFixed(4)}`);

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
      setError(`Translation failed: ${err.message}`);
    }
  };

  const handleFrameDetected = useCallback((sample: FrameSample) => {
      if (!readyToSign) {
        frameBufferRef.current.push([...sample.keypoints]);
        if (frameBufferRef.current.length >= WINDOW_SIZE) {
          setReadyToSign(true);
        }
        return;
      }
      if (!isTranslatingRef.current) return;

      if (sample.keypoints.length !== FEATURE_SIZE) {
        log.debug(`Invalid frame - keypoints length: ${sample.keypoints.length}`);
        return;
      }

      frameBufferRef.current.push([...sample.keypoints]);

      if (frameBufferRef.current.length < WINDOW_SIZE) return;

      if (processingRef.current) return;

      processingRef.current = true;

      const buffer = frameBufferRef.current;
      const window = buffer.slice(-WINDOW_SIZE);

      translateWindow(window).finally(() => {
        processingRef.current = false;
      });

      if (buffer.length > 60) {
        frameBufferRef.current = buffer.slice(-60);
      }
  }, [readyToSign]);


  const startTranslation = async () => {
    setPrediction("");
    setConfidence(0.0);
    setError("");
    setSentence("");
    setReadyToSign(false);
    try {
      await resetTranslate();
    } catch (e) {
      console.warn("Reset smoother failed", e);
    }
    setIsTranslating(true);
  };

  const stopTranslation = () => {
    setIsTranslating(false);
    frameBufferRef.current = [];
    processingRef.current = false;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <TopNav active="translate" />
      <main className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold mb-6">Translate Sign Language</h1>

        <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">Camera</h2>
            {/* Đèn trạng thái */}
            <div className="flex items-center gap-2">
              {isTranslating ? (
                readyToSign ? (
                  <>
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    <span className="text-sm font-medium text-green-400">Ready</span>
                  </>
                ) : (
                  <>
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                    <span className="text-sm font-medium text-red-400">Warming up...</span>
                  </>
                )
              ) : (
                <span className="text-sm text-white/60">Idle</span>
              )}
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

          {/* Kết quả */}
          <div className="mt-6 p-4 rounded-xl bg-slate-800/50 border border-white/10">
            <div className="text-sm text-white/50 mb-1">Prediction</div>
            {error ? (
              <p className="text-red-400 text-sm">{error}</p>
            ) : prediction === "unknown" ? (
              <p className="text-yellow-400 italic">Analyzing – hold the sign steady...</p>
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

            {/* Câu hiện tại */}
            <div className="mt-4 p-3 rounded-lg bg-slate-700/50 border border-white/10">
              <div className="text-sm text-white/50 mb-1">Current Sentence</div>
              <p className="text-xl font-semibold text-blue-300">
                {sentence || "..."}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Translate;