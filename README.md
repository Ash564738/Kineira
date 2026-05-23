# Kineira - Sign Language Learning Platform

A comprehensive EdTech platform for learning sign language using computer vision and AI with real-time hand, face, and pose tracking via MediaPipe Holistic.

## Features

- **Real-time Holistic Tracking**: MediaPipe Holistic for face, hand, and pose landmarks
- **Data Collection**: Web-based UI for collecting 30 videos × 30 frames per letter/word
- **Automated Training**: Train LSTM models on collected data (automatic via UI, no manual scripts needed)
- **Sign Translation**: AI-powered translation of sign language gestures to text in real-time
- **Interactive Lessons**: Learn sign language with guided lessons and feedback
- **Performance Scoring**: Score and provide feedback for users learning sign language
- **Progress Tracking**: Dashboard showing user learning progress

## System Architecture

### Page Structure

1. **Translate (index.tsx)** - Main page for real-time sign-to-text translation
   - Captures video from webcam using holistic landmarks
   - Sends 30-frame sequences to `/translate` endpoint
   - Displays predicted sign and confidence in real-time

2. **Lessons (lessons.tsx)** - Catalog of available sign language lessons
   - Browse all lessons by difficulty
   - Click to start a specific lesson

3. **Lesson Practice ([lessonId].tsx)** - Practice specific sign with scoring
   - Displays the sign to learn
   - Records your attempt (30 frames)
   - Calls `/score` endpoint to compare with reference gesture
   - Provides feedback and corrections

4. **Collect (collect.tsx)** - Data collection for training the model
   - Collect 30 videos × 30 frames per action (36 total actions)
   - Each frame saved as 1692-dim keypoint vector
   - Data stored in `datasets/MP_Data/{action}/{video}/{frame}.npy`
   - Click "Start Training" to automatically train the model

5. **Progress (progress.tsx)** - User dashboard
   - Shows completion status for each action/lesson
   - Displays learning statistics and achievements

### Data Flow

#### Training Workflow (One-time Setup)
```
1. User navigates to Collect page
2. Clicks "Collect" on each action (A-Z + 10 words)
3. Performs sign 30 times (30 videos)
4. Each video captures 30 frames automatically
5. Frontend sends 1692-dim keypoint vectors to /data-collection/frame-vector
6. Saves frames as .npy files in datasets/MP_Data/{action}/{video}/{frame}.npy
7. User clicks "Start Training"
8. Backend automatically:
   - Loads all collected .npy files from datasets/MP_Data
   - Trains single Keras LSTM model on all actions (200 epochs)
   - Saves trained model to assets/models/action.h5
9. Model is now ready for inference (translate page works!)
```

#### Translation (Real-time Inference)
```
1. User on Translate page performs sign in front of camera
2. Frontend captures video with holistic landmarks
3. Extracts 1692-dim keypoint vector per frame
4. Buffers 30 frames
5. Every 0.5 seconds, sends 30-frame sequence to /translate
6. Backend loads assets/models/action.h5
7. Runs inference through Keras LSTM
8. Returns predicted sign + confidence
9. Frontend displays result (updates every 0.5s)
```

#### Lesson Practice (Learning with Feedback)
```
1. User navigates to Lessons → selects a lesson → [lessonId] page loads
2. Reference gesture is displayed
3. User performs the sign while recording
4. Records 30 frames of user gesture
5. Frontend sends user_sequence to /score endpoint
6. Backend also retrieves reference_sequence from database
7. Computes similarity scores (cosine, DTW, transformer)
8. Generates feedback with specific corrections
9. Frontend displays:
   - Overall score (0-100)
   - Feedback and suggestions for improvement
   - Detailed metrics (accuracy, completeness, timing)
10. User can retry to improve score
```

## Technical Stack

### Frontend
- **Next.js 14** with TypeScript
- **TailwindCSS** for styling
- **MediaPipe Holistic** for landmark detection (client-side)
- **React** for UI components

### Backend
- **FastAPI** (Python) - REST API framework
- **TensorFlow/Keras** - LSTM model for sign recognition and scoring
- **MediaPipe** - Landmark detection utilities
- **SQLAlchemy** - Database ORM for lessons/progress
- **SQLite** - Development database (can use PostgreSQL)

### Data & Models
- **holistic_landmarker.task** - MediaPipe model for landmark extraction
- **action.h5** - Trained Keras LSTM model (generated during training)
- **datasets/MP_Data/** - Training data (collected user videos)

## Directory Structure

```
|-- .vscode
    |-- settings.json
|-- backend
    |-- api
        |-- routers
            |-- data_collection.py
            |-- lessons.py
            |-- progress.py
            |-- recognition.py
            |-- training.py
            |-- __init__.py
        |-- schemas
            |-- common.py
            |-- __init__.py
        |-- services
            |-- inference.py
            |-- scoring.py
            |-- __init__.py
        |-- main.py
        |-- __init__.py
    |-- assets
        |-- data
            |-- kineira.db
            |-- payload.json
        |-- metrics
            |-- model_metrics.json
        |-- models
            |-- action.h5
            |-- holistic_landmarker.task
    |-- datasets
        |-- MP_Data
            |-- A
            |-- B
            |-- C
            |-- HELLO
        |-- WLASL
            |-- code
            |-- start_kit
            |-- .gitignore
            |-- index.md
            |-- README.md
            |-- _config.yml
    |-- db
        |-- models.py
        |-- repository.py
        |-- seed.py
        |-- __init__.py
    |-- ml
        |-- training
            |-- train_holistic.py
            |-- __init__.py
        |-- data_collection.py
        |-- orientation.py
        |-- preprocess.py
        |-- __init__.py
    |-- .env
    |-- config.py
    |-- main.py
    |-- package-lock.json
    |-- package.json
    |-- requirements.txt
    |-- testing.py
|-- frontend
    |-- src
        |-- components
            |-- camera
                |-- CameraView.tsx
            |-- layout
                |-- TopNav.tsx
        |-- lib
            |-- landmarks
                |-- LandmarkTracker.ts
        |-- pages
            |-- collect.tsx
            |-- index.tsx
            |-- lessons.tsx
            |-- progress.tsx
            |-- [lessonId].tsx
            |-- _app.tsx
        |-- services
            |-- api
                |-- client.ts
                |-- collectionService.ts
                |-- config.ts
                |-- trainingService.ts
        |-- styles
            |-- globals.css
        |-- types
            |-- api.ts
            |-- landmarks.ts
    |-- next-env.d.ts
    |-- package-lock.json
    |-- package.json
    |-- postcss.config.js
    |-- tailwind.config.js
    |-- tsconfig.json
|-- .gitignore
|-- README.md
|-- structure.txt
|-- tree.ps1

```

## API Endpoints

### Translation (Main)
- **POST /translate** - Translate 30-frame keypoint sequence to sign
  - Request: `{ keypoints_sequence: number[][] }` (30 × 1692)
  - Response: `{ sign: string, confidence: number }`

### Scoring & Feedback
- **POST /score** - Score user gesture vs reference gesture
  - Request: `{ user_sequence: number[][], reference_sequence: number[][] }`
  - Response: `{ score: number, feedback: string, accuracy: number, completeness: number, timing: number }`

### Data Collection
- **GET /data-collection/actions** - List all 36 actions
- **GET /data-collection/status** - Collection progress for all actions
- **GET /data-collection/status/{action}** - Progress for single action
- **POST /data-collection/start/{action}/{video_num}** - Start collecting
- **POST /data-collection/frame-vector/{action}/{video_num}/{frame_num}** - Save frame keypoints
- **POST /data-collection/validate/{action}** - Validate collected data
- **DELETE /data-collection/reset/{action}** - Clear collection for action

### Training
- **POST /training/start** - Start automatic model training
- **GET /training/status** - Get training progress
- **POST /training/cancel** - Cancel ongoing training
- **GET /training/metrics** - Get final training metrics

### Lessons & Progress
- **GET /lessons** - List all lessons
- **GET /lessons/{lesson_id}** - Get specific lesson
- **GET /users/{user_id}/progress** - Get user progress
- **POST /users/{user_id}/progress** - Save lesson attempt

## Setup Instructions

### Prerequisites
- Python 3.9+
- Node.js 18+
- 4GB+ RAM recommended
- Webcam required for tracking

### Backend Setup

1. Create backend directory structure:
```bash
cd backend
mkdir -p datasets/MP_Data
```

2. Create virtual environment:
```bash
python -m venv venv
# On Windows:
.\venv\Scripts\Activate.ps1
# On Unix/Linux:
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Initialize database:
```bash
python db/models.py
python db/seed.py
```

5. Start backend server:
```bash
python main.py
```
Backend runs on `http://localhost:8000`

### Frontend Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Run development server:
```bash
npm run dev
```
Frontend runs on `http://localhost:3000`

## Usage Guide

### For Learning (End User)

1. **First Time**: Go to **Collect** page
   - Follow on-screen instructions to collect data (50 videos per action)
   - Or skip if pre-trained model exists

2. **Train Model**: Click "Start Training" on Collect page
   - **Automatic training starts - no manual scripts needed!**
   - Wait for completion (~5-10 minutes depending on data)
   - Model saved automatically

3. **Practice**: Go to **Lessons** page
   - Browse available sign language lessons
   - Click on a lesson to practice
   - System provides score and feedback
   - Try again to improve

4. **Translate**: Go to **Translate** page (index.tsx)
   - Perform sign language gestures in front of camera
   - Real-time translation appears on screen
   - Works automatically (no clicking needed)

5. **Track Progress**: Go to **Progress** page
   - See which actions/lessons you've completed
   - View learning statistics

### For Developers

#### Adding New Training Data
1. Collect more videos via Collect page
2. Click "Start Training" - model automatically retrains
3. Old model is replaced with new trained version

#### Modifying Training Parameters
Edit `backend/config.py`:
```python
VIDEOS_PER_ACTION = 30      # Videos collected per action
FRAMES_PER_VIDEO = 30       # Frames per video
```

#### Understanding the Scoring System

The `/score` endpoint uses three similarity metrics:
1. **Cosine Similarity** (40% weight) - Frame position matching
2. **DTW Similarity** (35% weight) - Temporal alignment
3. **Transformer Similarity** (25% weight) - Movement velocity matching

Score range: 0-100
- 90+: Excellent form
- 80-89: Great job, minor adjustments
- 70-79: Good work, focus on details
- 60-69: Getting there, practice more
- <60: Keep practicing

## File Naming Explanation

**Note**: Project contains files with same names in different directories - this is intentional:

- `backend/main.py` - Backend entry point (starts FastAPI server)
- `backend/api/main.py` - FastAPI app setup and routing
- `backend/ml/data_collection.py` - DataCollector utility class (internal)
- `backend/api/routers/data_collection.py` - API endpoints for data collection
- `backend/config.py` - Configuration file (single source of truth)

These files serve different purposes and do not duplicate functionality.

## Training Details

### Automatic Training Flow (No Manual Scripts!)
1. User collects data via Collect page
2. Clicks "Start Training" button
3. Backend automatically:
   - Loads `datasets/MP_Data/{action}/**/*.npy` files
   - Trains Keras LSTM for 200 epochs
   - Validates on 20% of data
   - Saves best model to `assets/models/action.h5`
   - Returns training metrics

### Trained Model Details
- **Architecture**: LSTM (2 layers, 256 units)
- **Input**: 30 frames × 1692 dimensions
- **Output**: 36 classes (26 letters + 10 words)
- **Training Time**: ~5-10 minutes on 1800 videos
- **Accuracy**: ~95% on test set (varies with data quality)

## Troubleshooting

### Model not loading
- Check `assets/models/action.h5` exists
- Check `assets/models/holistic_landmarker.task` exists
- Verify backend started without errors

### Training fails
- Ensure `datasets/MP_Data/` has complete 50 videos per action
- Check disk space (training needs ~500MB)
- Monitor backend logs for errors

### No landmarks detected
- Ensure good lighting
- Camera should be at least 1 meter away
- Ensure full body is visible (at least shoulders to waist)
- Check MediaPipe holistic_landmarker.task loads correctly

### Slow inference
- Close other applications
- Reduce screen resolution
- Check GPU availability (if installed)

## Performance Notes

- **Data Collection**: ~2 seconds per video
- **Training**: ~5-10 minutes for 1800 videos
- **Inference**: ~50ms per frame (25 fps realtime)
- **Memory Usage**: ~2GB during training, ~500MB running

## Configuration Files

### Important Paths (in backend/config.py)
```python
DATA_PATH = "backend/datasets/MP_Data"           # Training data
MODEL_PATH = "backend/assets/models/action.h5"   # Trained model
HOLISTIC_MODEL_PATH = "backend/assets/models/holistic_landmarker.task"
```

### Ensure directories exist:
```bash
backend/datasets/MP_Data/        # Stores collected training videos
backend/assets/models/           # Stores trained action.h5
backend/assets/data/             # Stores database files
```

## Contributing

1. Fork repository
2. Create feature branch
3. Make changes
4. Test end-to-end (collect → train → translate → lessons)
5. Submit pull request

## License

MIT License - See LICENSE file for details

## Support

For issues:
1. Check troubleshooting section above
2. Review backend logs
3. Verify all directories and files exist
4. Check database: `backend/assets/data/kineira.db`