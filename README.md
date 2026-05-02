# Kineira - Sign Language Learning Platform

A comprehensive EdTech platform for learning sign language using computer vision, AI, and real-time hand tracking.

## Features

- **Real-time Hand Tracking**: Uses MediaPipe for detecting 21 hand landmarks
- **Sign Recognition**: AI-powered recognition of sign language gestures
- **Scoring System**: Automated scoring and feedback for sign accuracy
- **Progress Tracking**: User progress and lesson management
- **Interactive Lessons**: Step-by-step sign language learning

## Tech Stack

### Frontend
- Next.js 14 with TypeScript
- TailwindCSS for styling
- MediaPipe Hands for hand tracking
- React for UI components

### Backend
- FastAPI (Python)
- PyTorch for AI models
- SQLAlchemy for database
- SQLite (development) / PostgreSQL (production)

## Project Structure

```
kineira/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── camera/
│       │   └── layout/
│       ├── lib/
│       │   └── landmarks/
│       ├── pages/
│       ├── services/
│       │   └── api/
│       └── types/
└── backend/
    ├── api/
    │   ├── routers/
    │   ├── schemas/
    │   └── services/
    ├── data_prep/
    │   └── wlasl/
    ├── db/
    ├── ml/
    │   └── training/
    ├── main.py
    └── requirements.txt
```

## Setup Instructions

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Run development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create a single project-local virtual environment:
```bash
python -m venv .venv
```

3. Activate virtual environment:
   - On Windows PowerShell: `.\.venv\Scripts\Activate.ps1`
   - On Unix/Linux: `source .venv/bin/activate`

4. Install dependencies:
```bash
pip install -r requirements.txt
```

5. Run the database setup:
```bash
python db/models.py
```

6. Seed the database with sample lessons and signs:
```bash
python db/seed.py
```

7. Start the API server:
```bash
python main.py
```

The API will be available at `http://localhost:8000`

## Usage

1. Open the frontend in your browser
2. Allow camera access when prompted
3. Start hand tracking by clicking "Start Hand Tracking"
4. Make sign language gestures in front of the camera
5. View real-time recognition and scoring

## API Endpoints

- `POST /recognize-sign` - Recognize sign from landmark sequence
- `POST /score-sign` - Score user sequence against reference sign
- `GET /lessons` - List lessons
- `GET /lessons/{lesson_id}` - Lesson detail
- `GET /users/{user_id}/progress` - Get user progress
- `POST /users/{user_id}/progress` - Save attempt + update progress
- `GET /users/{user_id}/attempts` - Recent attempts

## Development Roadmap

### Phase 1 (Current)
- Basic hand tracking with MediaPipe
- Simple rule-based sign recognition
- Basic scoring system
- Database schema for users and progress

### Phase 2
- Train ML model for sign recognition using WLASL landmark sequences
- Implement temporal gesture analysis
- Add more sign language signs
- Improve scoring accuracy

### Dataset and training
1. Download WLASL videos: `python data_prep/wlasl/video_downloader.py`
2. Preprocess WLASL videos: `python data_prep/wlasl/preprocess.py`
3. Extract canonical landmarks: `python data_prep/wlasl_to_landmarks.py`
4. Train alphabet model (hand-dominant): `python ml/training/train_alphabet.py`
5. Train word model: `python ml/training/train_word.py`
6. Train CTC sentence model: `python ml/training/train_ctc.py`

Note:
- Use only one backend environment (`backend/.venv`) to avoid version drift.
- If multiple `venv` folders exist, they are separate and not synchronized automatically.

### Phase 3
- Lesson system and curriculum
- Progress visualization
- Memory training exercises
- User authentication

### Phase 4
- Face and pose tracking
- Multi-language support
- Social features
- Advanced analytics

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details