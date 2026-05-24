# Kineira – Nền tảng học Ngôn ngữ Ký hiệu bằng AI

Nền tảng EdTech toàn diện giúp học ngôn ngữ ký hiệu thông qua thị giác máy tính và trí tuệ nhân tạo.
Sử dụng **MediaPipe Holistic** để theo dõi chuyển động tay, khuôn mặt và tư thế theo thời gian thực, kết hợp mô hình **LSTM** để nhận dạng và chấm điểm cử chỉ.

## Tính năng chính

- **Theo dõi toàn diện (Holistic)**: MediaPipe Holistic trích xuất 329 đặc trưng mỗi khung hình (tay trái, tay phải, tư thế thân trên, khuôn mặt).
- **Thu thập dữ liệu thông minh**: Giao diện web cho phép thu thập **100 video × 30 khung hình** cho mỗi ký hiệu, với chế độ nghỉ giữa các video và chuyển tay (50 video tay trái, 50 video tay phải).
- **Huấn luyện tự động**: Huấn luyện mô hình LSTM chỉ bằng một nút bấm – không cần chạy script thủ công.
- **Dịch cử chỉ thời gian thực**: Nhận dạng ký hiệu ngay khi bạn thực hiện trước camera.
- **Bài học tương tác**: Luyện tập từng ký hiệu với phản hồi chi tiết.
- **Chấm điểm thông minh**: Điểm số dựa trên độ tương đồng của tay (80%), tư thế (15%) và khuôn mặt (5%), tự động xác định tay đang sử dụng.
- **Theo dõi tiến độ**: Bảng điều khiển hiển thị quá trình học tập.

## Kiến trúc hệ thống

### Các trang chính (Frontend)

1. **Translate (index.tsx)** – Nhận dạng ký hiệu thời gian thực  
   - Gửi chuỗi 30 khung hình đến `/translate`.
2. **Lessons (lessons.tsx)** – Danh mục bài học theo độ khó.
3. **Lesson Practice ([lessonId].tsx)** – Luyện tập một ký hiệu  
   - Ghi lại 30 khung hình, gửi lên `/score` để so sánh với cử chỉ mẫu.
4. **Collect (collect.tsx)** – Thu thập dữ liệu huấn luyện  
   - Hỗ trợ nghỉ giữa video, chuyển tay, làm lại video lỗi.
5. **Progress (progress.tsx)** – Bảng theo dõi tiến độ người dùng.

### Luồng dữ liệu chính

#### Thu thập dữ liệu & Huấn luyện
Vào Collect → chọn ký hiệu (A, B, HELLO, LOVE).

Hệ thống yêu cầu thực hiện 50 video tay trái, sau đó đổi tay 50 video tay phải.

Mỗi video gồm 30 khung hình, mỗi khung là vector 329 chiều.

Dữ liệu lưu vào datasets/MP_Data/{action}/{video_num}/*.npy.

Nhấn "Start Training" → Backend tự động:

Chuẩn hóa tọa độ tay về gốc cổ tay (relative normalization)

Tăng cường dữ liệu (nhiễu Gaussian, biến dạng thời gian)

Chuẩn hóa max‑abs scaling

Huấn luyện LSTM 64 units, 2000 epoch với EarlyStopping

Lưu model và file tham chiếu (ref_{action}_{hand}.npy) vào assets/models/

text

#### Dịch cử chỉ (Inference)
Camera ghi nhận 329 keypoints/khung.

Mỗi 0.5 giây gửi 30 khung hình đến /translate.

Backend: relative hand → max‑abs scale → LSTM dự đoán → smoother.

Trả về ký hiệu và độ tin cậy.

text

#### Luyện tập & Chấm điểm
Người dùng chọn bài học → thực hiện ký hiệu.

Gửi chuỗi 30 khung hình lên /score kèm target_sign.

Backend xác định tay đang dùng (trái/phải), tải reference tương ứng.

Chuẩn hóa user sequence giống hệt pipeline huấn luyện.

Tính điểm: cosine similarity tay (80%) + tư thế (15%) + mặt (5%).

Nếu ký hiệu dự đoán khác target → phạt ×0.3.

Trả về điểm tổng, phản hồi, độ tương đồng từng ngón tay.

text

## Công nghệ sử dụng

### Frontend
- **Next.js 14** + TypeScript
- **TailwindCSS**
- **MediaPipe Holistic** (client‑side)
- **React** hooks & refs

### Backend
- **FastAPI** (Python)
- **TensorFlow / Keras** – LSTM
- **NumPy** – xử lý vector
- **SQLAlchemy** – ORM (SQLite/phát triển)

### Dữ liệu & Mô hình
- `holistic_landmarker.task` – MediaPipe
- `action.h5` – Mô hình LSTM đã huấn luyện
- `scaler.json` – Tham số max‑abs scaling
- `ref_{action}_{hand}.npy` – Các chuỗi tham chiếu

## Cấu trúc thư mục
├── backend/
│ ├── api/
│ │ ├── routers/
│ │ │ ├── data_collection.py
│ │ │ ├── lessons.py
│ │ │ ├── progress.py
│ │ │ ├── recognition.py
│ │ │ └── training.py
│ │ ├── schemas/
│ │ │ └── common.py
│ │ ├── services/
│ │ │ ├── inference.py
│ │ │ └── scoring.py
│ │ └── main.py
│ ├── assets/models/ # Mô hình & tham chiếu
│ ├── datasets/MP_Data/ # Dữ liệu huấn luyện thu thập
│ ├── db/ # Models & seed
│ ├── ml/
│ │ ├── train_holistic.py
│ │ ├── hand_utils.py
│ │ └── data_collection.py
│ └── config.py
├── frontend/
│ └── src/
│ ├── components/
│ ├── lib/landmarks/
│ ├── pages/
│ ├── services/api/
│ └── types/
└── README.md

text

## API Endpoints

### Dịch
- **POST /translate**  
  Body: `{ "keypoints_sequence": number[][] }` (30×329)  
  Response: `{ "sign": string, "confidence": number }`

### Chấm điểm
- **POST /score**  
  Body: `{ "user_sequence": number[][], "target_sign": string }`  
  Response: `{ "score": float, "feedback": string, "hand_similarity": float, "finger_details": {...} }`

### Thu thập dữ liệu
- **GET /data-collection/actions** – Danh sách ký hiệu
- **GET /data-collection/status** – Tiến độ tất cả
- **POST /data-collection/start/{action}/{video_num}?overwrite=true** – Bắt đầu video
- **POST /data-collection/frame-vector/{action}/{video_num}** – Lưu batch frame
- **DELETE /data-collection/video/{action}/{video_num}** – Xoá video lỗi
- **GET /data-collection/next-video/{action}** – Số video kế tiếp

### Huấn luyện
- **POST /training/start** – Bắt đầu huấn luyện
- **GET /training/status** – Trạng thái (epoch, loss, accuracy)
- **POST /training/cancel**

### Bài học & Tiến độ
- **GET /lessons**
- **GET /lessons/{id}**
- **POST /users/{id}/progress** – Lưu kết quả luyện tập

## Hướng dẫn cài đặt

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python db/models.py
python db/seed.py
python main.py             # http://localhost:8000
Frontend
bash
cd frontend
npm install
npm run dev                # http://localhost:3000
Quy trình sử dụng
Thu thập dữ liệu (bắt buộc lần đầu)
Vào Collect, chọn ký hiệu → hệ thống hướng dẫn thực hiện 50 video tay trái, nghỉ, 50 video tay phải. Video lỗi sẽ được yêu cầu quay lại.

Huấn luyện mô hình
Nhấn Start Training trên trang Collect → chờ vài phút. Model được lưu tự động.

Dịch cử chỉ
Vào Translate, thực hiện ký hiệu trước camera, kết quả hiển thị ngay.

Luyện tập & Chấm điểm
Vào Lessons → chọn bài → thực hiện ký hiệu → nhận điểm, phản hồi và gợi ý cải thiện từng ngón tay.

Theo dõi tiến độ
Xem lịch sử luyện tập và điểm số cao nhất trong Progress.

Chi tiết huấn luyện
Dữ liệu: 100 video × 30 frame cho mỗi action (tổng 400 video gốc, sau augmentation ×3).

Tiền xử lý:

Chuẩn hóa tay về gốc cổ tay (wrist‑centric).
Augmentation: Gaussian noise (std=0.02), time warping (max 10%).
Max‑abs scaling (lưu scaler chỉ từ tập huấn luyện, không ghi đè khi tạo reference).
Kiến trúc LSTM:

LSTM(64) → Dropout(0.3) → Dense(32) → Dropout(0.3) → Softmax

Optimizer: Adam(lr=0.0003), clipnorm=1.0, L2=0.001

EarlyStopping: val_loss, patience=10

Kết quả: độ chính xác trên tập test ~95‑100% (tùy chất lượng dữ liệu).

Hệ thống chấm điểm
Công thức:
hand_similarity = cosine_sim(user_hand, ref_hand)
pose_similarity = cosine_sim(user_pose, ref_pose)
face_similarity = cosine_sim(user_face, ref_face)
base_score = hand × 0.80 + pose × 0.15 + face × 0.05
Nếu dự đoán ≠ target → penalty = 0.3.
final_score = max(0, base_score × penalty) × 100

Phân tích ngón tay: cosine similarity riêng cho từng ngón (thumb, index, middle, ring, pinky) cùng gợi ý cải thiện.

Cấu hình quan trọng (config.py)
python
ACTIONS = ["A", "B", "HELLO", "LOVE"]
VIDEOS_PER_ACTION = 100
FRAMES_PER_VIDEO = 30
N_HAND = 21
N_POSE = 23
N_FACE = 37
FEATURE_SIZE = 329  # 63+63+92+111
LSTM_EPOCHS = 2000
LSTM_BATCH_SIZE = 32
SEQUENCE_LENGTH = 30
Xử lý sự cố
Model không tải được: Kiểm tra assets/models/action.h5 và scaler.json.

Huấn luyện thất bại: Đảm bảo mỗi action có đủ 100 video, không thiếu frame.

Điểm thấp / âm: Đảm bảo cả inference và scoring đều áp dụng normalize_relative_hand.

Không phát hiện tay: Cải thiện ánh sáng, đảm bảo camera thấy toàn bộ thân trên.

Thiếu reference: Mỗi action cần có ít nhất một file ref_{action}_left.npy, ref_{action}_right.npy hoặc ref_{action}_both.npy.