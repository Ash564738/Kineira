// filepath: frontend/src/pages/index.tsx
import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import CameraView from "../components/camera/CameraView";
import { FrameLandmarks } from "../types/landmarks";
import TopNav from "../components/layout/TopNav";
import { PredictionResult, ScoringResult } from "../types/api";
import { recognizeSign } from "../services/api/client";

console.log("[INDEX] Module initialized");

const WINDOW_SIZE = 60;
const SEND_INTERVAL = 15;
const MIN_FRAMES_TO_SEND = 3;

const Home: React.FC = () => {
  console.log("[INDEX] Home render started");

  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [scoringResult, setScoringResult] = useState<ScoringResult | null>(null);
  const [isRecording, setIsRecording] = useState(false);


  const isRecordingRef = useRef(false);

  const [mode, setMode] = useState<"alphabet" | "word" | "sentence">("alphabet");
  const [currentSign, setCurrentSign] = useState("a");
  const [showScore, setShowScore] = useState(false);
  const [frameCount, setFrameCount] = useState(0);

  const framesRef = useRef<FrameLandmarks[]>([]);
  const frameCounterRef = useRef(0);
  const sendingRef = useRef(false);
  const modeRef = useRef(mode);
  const signRef = useRef(currentSign);


  console.log("[INDEX] Current state snapshot =", {
    isRecording,
    mode,
    currentSign,
    frameCount,
    bufferedFrames: framesRef.current.length,
    sending: sendingRef.current,
    hasPrediction: !!prediction,
  });

  useEffect(() => {
    try {
      console.log("[INDEX] mode useEffect triggered, old =", modeRef.current, "new =", mode);
      modeRef.current = mode;
      console.log("[INDEX] modeRef updated =", modeRef.current);
    } catch (error) {
      console.error("[INDEX] mode useEffect failed =", error);
    }
  }, [mode]);

  useEffect(() => {
    try {
      console.log("[INDEX] currentSign useEffect triggered, old =", signRef.current, "new =", currentSign);
      signRef.current = currentSign;
      console.log("[INDEX] signRef updated =", signRef.current);
    } catch (error) {
      console.error("[INDEX] currentSign useEffect failed =", error);
    }
  }, [currentSign]);

  const hasUsefulLandmarks = (frame: FrameLandmarks) => {
    try {
      const useful =
        frame.left_hand.length > 0 ||
        frame.right_hand.length > 0 ||
        frame.pose.length > 0 ||
        frame.face.length > 0;

      console.log("[INDEX] hasUsefulLandmarks =", {
        useful,
        left: frame.left_hand.length,
        right: frame.right_hand.length,
        pose: frame.pose.length,
        face: frame.face.length,
      });

      return useful;
    } catch (error) {
      console.error("[INDEX] hasUsefulLandmarks failed =", error);
      return false;
    }
  };

  const handleLandmarksDetected = (frame: FrameLandmarks) => {
    try {
      console.log("[INDEX] handleLandmarksDetected called");

      if (!isRecordingRef.current) {
        console.warn("[INDEX] Frame ignored because recording is false");
        return;
      }

      if (!hasUsefulLandmarks(frame)) {
        console.warn("[INDEX] Frame ignored because no useful landmarks");
        return;
      }

      frameCounterRef.current += 1;
      setFrameCount(frameCounterRef.current);

      console.log("[INDEX] Frame accepted =", {
        frameCounter: frameCounterRef.current,
        previousBufferSize: framesRef.current.length,
      });

      framesRef.current.push(frame);

      if (framesRef.current.length > WINDOW_SIZE) {
        console.warn("[INDEX] Buffer exceeded WINDOW_SIZE, removing oldest frame");
        framesRef.current.shift();
      }

      const shouldSend =
        framesRef.current.length >= MIN_FRAMES_TO_SEND &&
        frameCounterRef.current % SEND_INTERVAL === 0 &&
        !sendingRef.current;

      if (shouldSend) {
        console.log("[INDEX] Triggering sendToAPI");
        sendToAPI([...framesRef.current]);
      }
    } catch (error) {
      console.error("[INDEX] handleLandmarksDetected failed =", error);
    }
  };

  const sendToAPI = async (sequence: FrameLandmarks[]) => {
    try {
      console.log("[INDEX] sendToAPI entered with sequence length =", sequence.length);

      if (sendingRef.current) {
        console.warn("[INDEX] Request skipped because sendingRef.current is true");
        return;
      }

      if (sequence.length < MIN_FRAMES_TO_SEND) {
        console.warn("[INDEX] Request skipped because sequence too short =", sequence.length);
        return;
      }

      sendingRef.current = true;

      const data = await recognizeSign(sequence, modeRef.current);

      console.log("[INDEX] Normalized prediction =", data);

      setPrediction((prev) => {
        if (
          prev?.sign === data.sign &&
          prev?.confidence === data.confidence
        ) {
          return prev;
        }
        return data;
      });

      console.log("[INDEX] Prediction state updated");
    } catch (error) {
      console.error("[INDEX] sendToAPI failed =", error);
    } finally {
      sendingRef.current = false;
      console.log("[INDEX] sendingRef reset to false");
    }
  };

  const startRecording = () => {
    console.log("[INDEX] startRecording clicked");
    framesRef.current = [];
    frameCounterRef.current = 0;
    sendingRef.current = false;

    setFrameCount(0);
    setPrediction(null);
    setScoringResult(null);
    setShowScore(false);

    console.log("[INDEX] setIsRecording(true) about to execute");
    isRecordingRef.current = true;
    setIsRecording(true);
    console.log("[INDEX] Recording state initialized");
  };

  const stopRecording = () => {
    console.log("[INDEX] stopRecording clicked");
    isRecordingRef.current = false;
    setIsRecording(false);
    console.log("[INDEX] Recording stopped");
  };

  useEffect(() => {
    isRecordingRef.current = isRecording;
    console.log("[INDEX] isRecording state changed =", isRecording);
  }, [isRecording]);



  const changeSign = (sign: string) => {
    try {
      console.log("[INDEX] changeSign called from", currentSign, "to", sign);

      setCurrentSign(sign);
      setPrediction(null);
      setScoringResult(null);
      setShowScore(false);

      framesRef.current = [];
      frameCounterRef.current = 0;
      setFrameCount(0);

      console.log("[INDEX] Sign changed and buffers reset");
    } catch (error) {
      console.error("[INDEX] changeSign failed =", error);
    }
  };

  const alphabetSigns = "abcdefghijklmnopqrstuvwxyz".split("");

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <TopNav active="practice" />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
              <div className="flex justify-between items-center mb-4">
                <div className="flex bg-slate-800 rounded-lg p-1">
                  {["alphabet", "word", "sentence"].map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        console.log("[INDEX] Mode button clicked =", m);
                        setMode(m as "alphabet" | "word" | "sentence");
                      }}
                      className={`px-3 py-1.5 text-sm rounded-md capitalize ${
                        mode === m ? "bg-white text-black" : "text-white/60"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <div className="text-xs text-white/50">
                  {frameCount}/{WINDOW_SIZE}
                </div>
              </div>

              <CameraView
                onLandmarksDetected={handleLandmarksDetected}
                isRecording={isRecording}
              />

              <div className="flex justify-center mt-5 gap-3">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="px-5 py-2 rounded-lg bg-green-500 text-black"
                  >
                    Start
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="px-5 py-2 rounded-lg bg-red-500 text-white"
                  >
                    Stop
                  </button>
                )}
              </div>
            </div>
          </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
                <div className="text-sm text-white/50 mb-2">Prediction</div>
                {prediction && (
                  <div>
                    <div className="text-2xl font-semibold">{prediction.sign}</div>
                    <div className="text-sm text-white/60 mt-2">
                      Confidence: {(prediction.confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
              <div className="text-center text-5xl font-bold mb-4">
                {currentSign.toUpperCase()}
              </div>

              <div className="grid grid-cols-6 gap-1">
                {alphabetSigns.map((s) => (
                  <button
                    key={s}
                    onClick={() => changeSign(s)}
                    className={`p-2 rounded text-sm ${
                      currentSign === s
                        ? "bg-white text-black"
                        : "bg-slate-800 text-white/60"
                    }`}
                  >
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;