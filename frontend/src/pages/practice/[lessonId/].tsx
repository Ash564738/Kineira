import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import CameraView from '../components/CameraView';
import { HandLandmarks } from '../types/landmarks';

interface Lesson {
  id: number;
  title: string;
  description: string;
  sign_id: number;
  difficulty: string;
}

interface Sign {
  id: number;
  name: string;
  description: string;
}

const PracticeLesson: React.FC = () => {
  const router = useRouter();
  const { lessonId } = router.query;
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [sign, setSign] = useState<Sign | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [landmarksBuffer, setLandmarksBuffer] = useState<HandLandmarks[]>([]);
  const [prediction, setPrediction] = useState<string>('');
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (lessonId) {
      fetchLesson();
    }
  }, [lessonId]);

  const fetchLesson = async () => {
    try {
      const response = await fetch(`http://localhost:8001/lessons/${lessonId}`);
      if (response.ok) {
        const lessonData = await response.json();
        setLesson(lessonData);

        // Fetch the sign information
        const signResponse = await fetch(`http://localhost:8001/signs/${lessonData.sign_id}`);
        if (signResponse.ok) {
          const signData = await signResponse.json();
          setSign(signData);
        }
      }
    } catch (error) {
      console.error('Failed to fetch lesson:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLandmarksDetected = (landmarks: HandLandmarks) => {
    if (isRecording) {
      setLandmarksBuffer(prev => {
        const newBuffer = [...prev, landmarks];
        // Send to API every 30 frames (about 1 second at 30fps)
        if (newBuffer.length >= 30) {
          sendToAPI(newBuffer);
          return []; // Reset buffer
        }
        return newBuffer;
      });
    }
  };

  const sendToAPI = async (landmarks: HandLandmarks[]) => {
    try {
      const response = await fetch('http://localhost:8001/recognize-sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          landmarks_sequence: landmarks.map(landmark => ({
            landmarks: landmark.map(point => ({
              x: point.x,
              y: point.y,
              z: point.z
            }))
          }))
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setPrediction(result.sign || 'Unknown');
        setScore(result.score || 0);
        setFeedback('Practice completed!'); // Placeholder feedback

        // Save attempt to database
        if (result.score !== undefined) {
          await saveAttempt(result.score, 'Practice completed!');
        }
      }
    } catch (error) {
      console.error('API call failed:', error);
    }
  };

  const saveAttempt = async (attemptScore: number, attemptFeedback: string) => {
    try {
      await fetch('http://localhost:8001/attempts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: 1, // Demo user
          lesson_id: parseInt(lessonId as string),
          sign_id: lesson?.sign_id,
          score: attemptScore,
          feedback: attemptFeedback
        }),
      });
    } catch (error) {
      console.error('Failed to save attempt:', error);
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      // Starting recording
      setLandmarksBuffer([]);
      setPrediction('');
      setScore(null);
      setFeedback('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Loading lesson...</div>
      </div>
    );
  }

  if (!lesson || !sign) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-red-600">Lesson not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold">{lesson.title}</h1>
            <p className="text-gray-600 mt-2">{lesson.description}</p>
          </div>
          <div className="flex gap-4">
            <Link href="/lessons" className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
              Back to Lessons
            </Link>
            <Link href="/" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
              Home
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Camera and Practice Area */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Practice Area</h2>
            <div className="mb-4">
              <h3 className="text-lg font-medium mb-2">Target Sign: {sign.name}</h3>
              <p className="text-gray-600">{sign.description}</p>
            </div>

            <CameraView onLandmarksDetected={handleLandmarksDetected} />

            <div className="mt-4 flex justify-center">
              <button
                onClick={toggleRecording}
                className={`px-6 py-3 rounded-lg font-semibold text-white ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {isRecording ? 'Stop Recording' : 'Start Recording'}
              </button>
            </div>

            {isRecording && (
              <div className="mt-4 text-center">
                <div className="inline-block animate-pulse bg-red-500 text-white px-3 py-1 rounded">
                  Recording... ({landmarksBuffer.length} frames)
                </div>
              </div>
            )}
          </div>

          {/* Results and Feedback */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Results</h2>

            {prediction && (
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-2">Prediction</h3>
                <div className="text-2xl font-bold text-blue-600">{prediction}</div>
              </div>
            )}

            {score !== null && (
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-2">Score</h3>
                <div className={`text-3xl font-bold ${
                  score >= 80 ? 'text-green-600' :
                  score >= 60 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {score}%
                </div>
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className={`h-4 rounded-full transition-all duration-300 ${
                        score >= 80 ? 'bg-green-500' :
                        score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${score}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            {feedback && (
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-2">Feedback</h3>
                <p className="text-gray-700 bg-gray-50 p-3 rounded">{feedback}</p>
              </div>
            )}

            {!prediction && !isRecording && (
              <div className="text-center text-gray-500 py-8">
                <p>Start recording to see your results!</p>
              </div>
            )}

            {/* Practice Tips */}
            <div className="mt-8">
              <h3 className="text-lg font-medium mb-3">Practice Tips</h3>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>Make sure your hand is clearly visible in the camera</li>
                <li>Hold the sign steady for a few seconds</li>
                <li>Practice in good lighting conditions</li>
                <li>Try different angles and distances</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticeLesson;