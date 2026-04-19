import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import CameraView from '../components/CameraView';
import { HandLandmarks } from '../types/landmarks';
import { ScoringEngine, ScoringResult } from '../lib/scoringEngine';
import { SignProcessor, SignResult } from '../lib/signProcessor';

interface APIPrediction {
  sign: string;
  confidence: number;
  score: number;
}

// Utility helpers: mirroring, normalization and flattening
function mirrorHand(hand: HandLandmarks): HandLandmarks {
  return hand.map(p => ({ x: 1 - p.x, y: p.y, z: p.z }));
}

function normalizeHand(hand: HandLandmarks): HandLandmarks {
  const wrist = hand[0];
  const tipIdx = [4, 8, 12, 16, 20];
  const distances = tipIdx.map(i => Math.hypot(hand[i].x - wrist.x, hand[i].y - wrist.y));
  const maxDist = Math.max(...distances, 1e-6);
  return hand.map(p => ({ x: (p.x - wrist.x) / maxDist, y: (p.y - wrist.y) / maxDist, z: (p.z - wrist.z) / maxDist }));
}

function flattenHand(hand: HandLandmarks): number[] {
  const out: number[] = [];
  for (const p of hand) {
    out.push(p.x, p.y, p.z);
  }
  return out;
}

// Simple client-side KNN classifier that stores examples in localStorage
class KNNClassifier {
  private key = 'kineira_knn_v1';
  samples: Array<{ label: string; vector: number[] }> = [];
  k: number;
  constructor(k = 3) {
    this.k = k;
    this.load();
  }

  addSample(label: string, vector: number[]) {
    this.samples.push({ label, vector });
    this.save();
  }

  clear() {
    this.samples = [];
    this.save();
  }

  save() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.samples));
    } catch (e) {
      // ignore
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) this.samples = JSON.parse(raw);
    } catch (e) {
      this.samples = [];
    }
  }

  getCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const s of this.samples) counts[s.label] = (counts[s.label] || 0) + 1;
    return counts;
  }

  classify(vector: number[]) {
    if (this.samples.length === 0) return { label: 'unknown', confidence: 0, neighbors: [] as any };
    const distances = this.samples.map(s => {
      if (s.vector.length !== vector.length) return { label: s.label, dist: Infinity };
      let sum = 0;
      for (let i = 0; i < vector.length; i++) sum += (vector[i] - s.vector[i]) ** 2;
      return { label: s.label, dist: Math.sqrt(sum) };
    }).filter(d => Number.isFinite(d.dist));

    distances.sort((a, b) => a.dist - b.dist);
    const k = Math.min(this.k, distances.length);
    const neighbors = distances.slice(0, k);
    const weights = neighbors.map(n => 1 / (n.dist + 1e-6));
    const labelWeights: Record<string, number> = {};
    neighbors.forEach((n, i) => { labelWeights[n.label] = (labelWeights[n.label] || 0) + weights[i]; });
    const total = weights.reduce((a, b) => a + b, 0);
    let best = 'unknown';
    let bestW = 0;
    for (const l of Object.keys(labelWeights)) {
      if (labelWeights[l] > bestW) { best = l; bestW = labelWeights[l]; }
    }
    const confidence = total > 0 ? bestW / total : 0;
    return { label: best, confidence, neighbors };
  }
}

// Module-level processors to avoid re-instantiation on each render
const scoringEngine = new ScoringEngine();
const signProcessor = new SignProcessor();

const Home = () => {
  const [currentLandmarks, setCurrentLandmarks] = useState([] as HandLandmarks[]);
  const [scoringResult, setScoringResult] = useState(null as ScoringResult | null);
  const [signResult, setSignResult] = useState(null as SignResult | null);
  const [apiPrediction, setApiPrediction] = useState(null as APIPrediction | null);
  const [isRecording, setIsRecording] = useState(false);
  const landmarkBuffer = useRef([] as HandLandmarks[]);
  // Debug / classifier state
  const [mirror, setMirror] = useState(false);
  const [normalize, setNormalize] = useState(true);
  const [sendNormalizedToAPI, setSendNormalizedToAPI] = useState(false);
  const [knnLabel, setKnnLabel] = useState('');
  const [knnResult, setKnnResult] = useState<{ label: string; confidence: number } | null>(null);
  const [knnCounts, setKnnCounts] = useState<Record<string, number>>({});
  const knnRef = useRef<KNNClassifier | null>(null);

  useEffect(() => {
    // instantiate classifier client-side
    knnRef.current = new KNNClassifier(3);
    setKnnCounts(knnRef.current.getCounts());
  // run once
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLandmarksDetected = async (landmarks: HandLandmarks[]) => {
    // raw landmarks from tracker
    setCurrentLandmarks(landmarks);

    // debug log incoming frames
    // eslint-disable-next-line no-console
    console.debug('handleLandmarksDetected: hands=', landmarks.length, 'firstFramePoints=', landmarks[0]?.length);

    if (landmarks.length > 0) {
      const result = scoringEngine.scoreGesture(landmarks);
      setScoringResult(result);

      const sign = signProcessor.recognizeSign(landmarks[0]);
      setSignResult(sign);

      // update KNN live classification on single frame (if samples exist)
      if (knnRef.current && knnRef.current.samples.length > 0) {
        try {
          let processed = landmarks[0];
          if (mirror) processed = mirrorHand(processed);
          if (normalize) processed = normalizeHand(processed);
          const vec = flattenHand(processed);
          const r = knnRef.current.classify(vec);
          setKnnResult({ label: r.label, confidence: r.confidence });
        } catch (e) {
          // ignore
        }
      }

      if (isRecording) {
        landmarkBuffer.current.push(landmarks[0]);
        if (landmarkBuffer.current.length >= 30) {
          await sendToAPI(landmarkBuffer.current);
          landmarkBuffer.current = [];
        }
      }
    } else {
      setScoringResult(null);
      setSignResult(null);
    }
  };

  const sendToAPI = async (landmarksSequence: HandLandmarks[]) => {
    try {
      // debug: log sequence length and a small sample of coordinates
      // eslint-disable-next-line no-console
      console.debug('sendToAPI: sequence length=', landmarksSequence.length, 'firstFramePoints=', landmarksSequence[0]?.length);

      // decide whether to send normalized/mirrored data to API (useful for debugging)
      const payloadSequence = landmarksSequence.map(ls => {
        let frame = ls;
        if (mirror) frame = mirrorHand(frame);
        if (sendNormalizedToAPI) frame = normalize ? normalizeHand(frame) : frame;
        return { landmarks: frame.map(p => ({ x: p.x, y: p.y, z: p.z })) };
      });

      // debug: show a sample of what we send
      // eslint-disable-next-line no-console
      console.debug('sendToAPI: sending sample=', payloadSequence[0]?.landmarks?.slice?.(0,3));

      const response = await fetch('http://localhost:8001/recognize-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landmarks_sequence: payloadSequence })
      });

      if (response.ok) {
        const result = await response.json() as APIPrediction;
        setApiPrediction(result);
      }
    } catch (error) {
      console.error('API call failed:', error);
    }
  };

  const startRecording = () => {
    setIsRecording(true);
    landmarkBuffer.current = [];
    setApiPrediction(null);
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (landmarkBuffer.current.length > 0) {
      sendToAPI(landmarkBuffer.current);
      landmarkBuffer.current = [];
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-lg">
        <div className="max-w-6xl mx-auto px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-8">
              <Link href="/" className="text-2xl font-bold text-blue-600">Kineira</Link>
              <div className="hidden md:flex space-x-6">
                <Link href="/" className="text-gray-700 hover:text-blue-600 font-medium">Practice</Link>
                <Link href="/lessons" className="text-gray-700 hover:text-blue-600 font-medium">Lessons</Link>
                <Link href="/progress" className="text-gray-700 hover:text-blue-600 font-medium">Progress</Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="p-8">
        <h1 className="text-4xl font-bold text-center mb-8">Sign Language Learning</h1>

        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">Hand Tracking</h2>
              <div className="flex gap-2">
                  {!isRecording ? (
                    <button onClick={startRecording} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">Start Recording</button>
                  ) : (
                    <button onClick={stopRecording} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">Stop Recording</button>
                  )}
                  <div className="ml-4 flex items-center space-x-2">
                    <label className="text-sm">Mirror</label>
                    <input type="checkbox" checked={mirror} onChange={e => setMirror(e.target.checked)} />
                    <label className="text-sm ml-2">Normalize</label>
                    <input type="checkbox" checked={normalize} onChange={e => setNormalize(e.target.checked)} />
                  </div>
              </div>
            </div>
              <div className="relative">
                <CameraView onLandmarksDetected={handleLandmarksDetected} isRecording={isRecording} />

                {/* Debug overlay */}
                <div className="absolute top-2 right-2 bg-white/90 p-2 rounded shadow text-xs w-64">
                  <div><strong>Debug</strong></div>
                  <div>Recording: {isRecording ? 'yes' : 'no'}</div>
                  <div>Buffered frames: {landmarkBuffer.current.length}</div>
                  <div>Hands: {currentLandmarks.length}</div>
                  <div>Local: {signResult ? signResult.sign : '-'}</div>
                  <div>API: {apiPrediction ? apiPrediction.sign : '-'}</div>
                  <div>KNN: {knnResult ? `${knnResult.label} (${(knnResult.confidence*100).toFixed(1)}%)` : '-'}</div>
                  <div>Mirror: {mirror ? 'on' : 'off'}</div>
                  <div>Normalize: {normalize ? 'on' : 'off'}</div>
                  <div className="mt-1 text-[10px] text-gray-600">Samples: {Object.keys(knnCounts).length}</div>
                </div>
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Current Landmarks</h3>
              <div className="text-sm text-gray-600">
                Hands detected: {currentLandmarks.length}
                {currentLandmarks.length > 0 && (
                  <div className="mt-2">
                    <p>Hand 1: {currentLandmarks[0].length} points</p>
                    <p>Mirror applied: {mirror ? 'yes' : 'no'}</p>
                    <p>Normalize applied: {normalize ? 'yes' : 'no'}</p>
                    <div className="mt-2">
                      <input className="border p-1 text-sm" placeholder="Sample label (e.g., 'C')" value={knnLabel} onChange={e=>setKnnLabel(e.target.value)} />
                      <button className="ml-2 px-2 py-1 bg-blue-500 text-white text-sm rounded" onClick={() => {
                        if (!currentLandmarks[0]) return;
                        const hand = mirror ? mirrorHand(currentLandmarks[0]) : currentLandmarks[0];
                        const processed = normalize ? normalizeHand(hand) : hand;
                        const vec = flattenHand(processed);
                        if (knnRef.current) {
                          knnRef.current.addSample(knnLabel || 'unknown', vec);
                          setKnnCounts(knnRef.current.getCounts());
                        }
                      }}>Save sample</button>
                      <button className="ml-2 px-2 py-1 bg-red-500 text-white text-sm rounded" onClick={() => { if (knnRef.current) { knnRef.current.clear(); setKnnCounts({}); setKnnResult(null); } }}>Clear samples</button>
                      <button className="ml-2 px-2 py-1 bg-green-600 text-white text-sm rounded" onClick={() => {
                        if (!currentLandmarks[0] || !knnRef.current) return;
                        const hand = mirror ? mirrorHand(currentLandmarks[0]) : currentLandmarks[0];
                        const processed = normalize ? normalizeHand(hand) : hand;
                        const vec = flattenHand(processed);
                        const r = knnRef.current.classify(vec);
                        setKnnResult({label: r.label, confidence: r.confidence});
                      }}>Classify Now</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Local Recognition</h3>
              {signResult ? (
                <div>
                  <div className="text-3xl font-bold text-blue-600 mb-2">{signResult.sign.toUpperCase()}</div>
                  <p className="text-gray-700">Confidence: {(signResult.confidence * 100).toFixed(1)}%</p>
                  {knnResult && (
                    <div className="mt-2 text-sm text-gray-600">KNN: {knnResult.label} ({(knnResult.confidence*100).toFixed(1)}%)</div>
                  )}
                </div>
              ) : (
                <div className="text-gray-500">No sign recognized</div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4">API Prediction</h3>
              {apiPrediction ? (
                        <div>
                          <div className="text-3xl font-bold text-purple-600 mb-2">{apiPrediction.sign.toUpperCase()}</div>
                          <p className="text-gray-700">Confidence: {(apiPrediction.confidence * 100).toFixed(1)}%</p>
                          <p className="text-gray-700">Score: {apiPrediction.score.toFixed(1)}%</p>
                        </div>
              ) : (
                <div className="text-gray-500">{isRecording ? 'Recording...' : 'Start recording to get API prediction'}</div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Score</h3>
              {scoringResult ? (
                <div>
                  <div className="text-3xl font-bold text-green-600 mb-2">{scoringResult.score}%</div>
                  <p className="text-gray-700">{scoringResult.feedback}</p>
                  <div className="mt-2 text-sm text-gray-600">
                    <p>Accuracy: {scoringResult.details.accuracy.toFixed(1)}%</p>
                    <p>Completeness: {scoringResult.details.completeness.toFixed(1)}%</p>
                    <p>Timing: {scoringResult.details.timing.toFixed(1)}%</p>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500">No score yet</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;