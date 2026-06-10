// src/pages/translate.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import CameraView from "../components/camera/CameraView";
import TopNav from "../components/layout/TopNav";
import Button from "../components/layout/Button";
import { FEATURE_SIZE, FrameSample } from "../types/landmarks";
import { resetTranslate } from "@/services/api/client";
import { apiUrl } from "@/services/api/config";
import {
  Brain,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Activity,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { themeColors, typography, spacing, borderRadius, effects } from "../styles/theme";
import PageState from "@/components/ui/PageState";
import { useToast } from "@/components/ui/ToastProvider";

const WINDOW_SIZE = 30;

const log = {
  info: (msg: string, data?: any) => console.log(`[TRANSLATE_PAGE] INFO: ${msg}`, data || ''),
  debug: (msg: string, data?: any) => console.debug(`[TRANSLATE_PAGE] DEBUG: ${msg}`, data || ''),
  warn: (msg: string, data?: any) => console.warn(`[TRANSLATE_PAGE] WARN: ${msg}`, data || ''),
  error: (msg: string, data?: any) => console.error(`[TRANSLATE_PAGE] ERROR: ${msg}`, data || ''),
};

const Translate: React.FC = () => {
  const { theme } = useTheme();
  const palette = themeColors[theme];
  const { showToast } = useToast();

  const [isTranslating, setIsTranslating] = useState(false);
  const [prediction, setPrediction] = useState("");
  const [confidence, setConfidence] = useState(0.0);
  const [error, setError] = useState(""); // lỗi inline khi dịch (có thể bỏ nếu dùng toast)
  const [sentence, setSentence] = useState("");

  const isTranslatingRef = useRef(false);
  const frameBufferRef = useRef<number[][]>([]);
  const processingRef = useRef(false);
  const [readyToSign, setReadyToSign] = useState(false);

  // State cho trạng thái toàn trang
  const [pageLoading, setPageLoading] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);

  // Kiểm tra model sẵn sàng (có thể thay bằng endpoint health check thực tế)
  const checkModelReady = useCallback(async () => {
      setPageLoading(false);      // bỏ qua gọi API, cho vào thẳng
      setModelError(null);
  }, []);

  useEffect(() => {
    checkModelReady();
  }, [checkModelReady]);

  useEffect(() => {
    isTranslatingRef.current = isTranslating;
    if (isTranslating) {
      frameBufferRef.current = [];
      processingRef.current = false;
    }
  }, [isTranslating]);

  const translateWindow = async (sequence: number[][]) => {
    log.info("TRANSLATE API CALL STARTED");
    try {
      const res = await fetch(apiUrl("/translate"), {
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
        // Lỗi model sẽ hiển thị toast và set modelError nếu muốn
        showToast("Model is not loaded yet. Please try again.", "error");
        setModelError("Model not loaded. Please reload the page or try again.");
        stopTranslation();
      } else {
        setPrediction(data.sign);
        setConfidence(data.confidence);
        setError("");
      }
    } catch (err: any) {
      log.error(`Translation failed: ${err.message}`, err);
      showToast(`Translation error: ${err.message}`, "error");
      // Không set error inline để tránh rối giao diện
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
    if (modelError) {
      showToast("Model is not ready. Please try again later.", "error");
      return;
    }
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

  // Loading toàn trang
  if (pageLoading) {
    return <PageState type="loading" message="Loading translation model..." />;
  }

  // Lỗi model toàn trang (không có model thì không nên vào giao diện dịch)
  if (modelError) {
    return (
      <PageState
        type="error"
        title="Translation unavailable"
        message={modelError}
        onAction={checkModelReady}
        actionLabel="Retry"
      />
    );
  }

  // JSX chính (giữ nguyên cấu trúc nhưng bỏ error inline)
  return (
    <div className={`min-h-screen ${palette.pageBg} ${typography.fontFamily}`}>
      <TopNav active="translate" />
      <main className={`${spacing.container} !pt-6`}>
        {/* Tiêu đề */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-10">
          <div>
            <h1 className={`${typography.heading.pageTitle} ${palette.textPrimary}`}>
              Translate Sign Language
            </h1>
            <p className={`${palette.textMuted} mt-2`}>
              Translate sign language gestures into text in real-time.
            </p>
          </div>
        </div>

        {/* Layout 2 cột */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-5">
            <div className={`${borderRadius.card} border ${palette.cardBorder} ${palette.cardBg} ${spacing.cardPadding}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`${typography.heading.cardTitle} ${palette.textPrimary} flex items-center gap-2`}>
                  Camera
                </h2>
                <div className="flex items-center gap-2">
                  {isTranslating ? (
                    readyToSign ? (
                      <>
                        <CheckCircle2 size={16} className={palette.textPrimary} />
                        <span className={`text-sm font-medium ${palette.textPrimary}`}>Ready</span>
                      </>
                    ) : (
                      <>
                        <Loader2 size={16} className={`animate-spin ${palette.infoText}`} />
                        <span className={`text-sm font-medium ${palette.textMuted}`}>Warming up...</span>
                      </>
                    )
                  ) : (
                    <>
                      <Activity size={16} className={palette.textMuted} />
                      <span className={`text-sm ${palette.textMuted}`}>Idle</span>
                    </>
                  )}
                </div>
              </div>

              <div className={`w-full overflow-hidden ${borderRadius.button} ${palette.cameraBg}`}>
                <CameraView
                  isRecording={isTranslating}
                  mode="recognition"
                  onFrameDetected={handleFrameDetected}
                />
              </div>

              <div className="flex justify-center mt-5 gap-3">
                {!isTranslating ? (
                  <Button variant="primary" onClick={startTranslation}>
                    Start Translate
                  </Button>
                ) : (
                  <Button variant="primary" onClick={stopTranslation}>
                    Stop
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className={`${borderRadius.card} border ${palette.cardBorder} ${palette.cardBg} ${spacing.cardPadding}`}>
              <div className="flex items-center gap-2 mb-3">
                <Brain size={18} className={palette.textMuted} />
                <span className={`${typography.body.small} uppercase tracking-wider ${palette.textMuted}`}>
                  Prediction
                </span>
              </div>

              {/* Không còn error inline, thay bằng các trạng thái sạch */}
              {prediction === "unknown" ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={18} className={`animate-spin ${palette.infoText}`} />
                  <span className={`${typography.body.normal} italic ${palette.infoText}`}>
                    Analyzing – hold steady...
                  </span>
                </div>
              ) : prediction ? (
                <div>
                  <div className={`${typography.predictionValue} ${palette.textPrimary}`}>
                    {prediction}
                  </div>
                  <div className={`mt-1 text-sm ${palette.textMuted}`}>
                    {(confidence * 100).toFixed(1)}% confidence
                  </div>
                </div>
              ) : (
                <div className={`${typography.body.normal} ${palette.textMuted} italic`}>
                  Waiting for sign...
                </div>
              )}

              <hr className={`my-5 border-t ${palette.cardBorder}`} />

              <div className="flex items-center gap-2 mb-3">
                <MessageSquare size={18} className={palette.textMuted} />
                <span className={`${typography.body.small} uppercase tracking-wider ${palette.textMuted}`}>
                  Current Sentence
                </span>
              </div>
              <p className={`${typography.predictionValue} ${palette.textPrimary}`}>
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