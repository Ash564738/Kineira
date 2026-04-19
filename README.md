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
├── frontend/          # Next.js frontend
│   ├── src/
│   │   ├── components/
│   │   ├── lib/       # HandTracker, ScoringEngine, SignProcessor
│   │   ├── pages/
│   │   └── types/
│   ├── package.json
│   └── tailwind.config.js
└── backend/           # FastAPI backend
    ├── main.py        # API endpoints
    ├── models.py      # Database models
    ├── database.py    # Database operations
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

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the database setup:
```bash
python models.py
```

5. Start the API server:
```bash
python main.py
```

The API will be available at `http://localhost:8001`

## Usage

1. Open the frontend in your browser
2. Allow camera access when prompted
3. Start hand tracking by clicking "Start Hand Tracking"
4. Make sign language gestures in front of the camera
5. View real-time recognition and scoring

## API Endpoints

- `GET /` - API status
- `POST /recognize-sign` - Recognize sign from landmark sequence
- `POST /score-gesture` - Score gesture accuracy
- `POST /users` - Create new user
- `GET /users/{user_id}` - Get user info
- `GET /signs` - Get all signs
- `GET /lessons` - Get all lessons
- `POST /attempts` - Record learning attempt
- `GET /users/{user_id}/progress` - Get user progress

## Development Roadmap

### Phase 1 (Current)
- Basic hand tracking with MediaPipe
- Simple rule-based sign recognition
- Basic scoring system
- Database schema for users and progress

### Phase 2
- Train ML model for sign recognition
- Implement temporal gesture analysis
- Add more sign language signs
- Improve scoring accuracy

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