Chương 3. XÂY DỰNG HỆ THỐNG WEBSITE 

3.1. Cài đặt môi trường 

Website được phát triển trong môi trường gồm các công cụ sau: 

Python 3.9+ với FastAPI để xây dựng backend API và các dịch vụ machine learning. 

Node.js 18+ kết hợp với Next.js 14 cho frontend, sử dụng TypeScript để đảm bảo type safety. 

PostgreSQL 14+ lưu trữ dữ liệu người dùng, bài học, tiến độ học tập và kết quả thực hành. 

Visual Studio Code làm trình soạn thảo chính. 

Chrome/Edge để kiểm thử giao diện và chức năng real-time. 

Cấu trúc thư mục dự án chia thành hai phần độc lập: thư mục backend chứa 	FastAPI server, các router xử lý API, services Machine Learning và database models; thư mục frontend chứa Next.js application với các pages, components React, và tích hợp với MediaPipe. 

3.2. Phân tầng kiến trúc 

Để đảm bảo tính module, dễ bảo trì, mở rộng và tái sử dụng code, dự án được tổ chức theo mô hình phân tầng kiến trúc. Các tầng được thiết kế để hoạt động độc lập với nhau, mỗi tầng có trách nhiệm cụ thể và tương tác thông qua các giao diện rõ ràng. Điều này giúp giảm thiểu sự phụ thuộc giữa các phần của ứng dụng, nâng cao khả năng phát triển và bảo trì. Dưới đây là mô tả chi tiết các tầng trong dự án: 

Tầng Giao diện người dùng (Presentation Layer) 

Công nghệ: Next.js 14 (Pages Router), React 18, TypeScript, TailwindCSS

Chức năng: 

Hiển thị giao diện web cho người dùng. 

Tích hợp MediaPipe để phát hiện landmark bàn tay, cơ thể và khuôn mặt trong real-time. 

Quản lý camera feed, canvas drawing và hiển thị skeleton overlay. 

Xử lý thao tác người dùng (click button, select lesson, start practice). 

Gửi dữ liệu landmark đến backend để nhận dạng và tính điểm. 

Các trang chính: 

/auth/login, /auth/register - xác thực người dùng. 

/lessons - danh sách bài học theo độ khó. 

/practice/[lessonId] - giao diện thực hành với camera, scoring real-time. 

/progress - thống kê tiến độ, biểu đồ điểm số. 

/collect - công cụ thu thập dữ liệu training cho admin. 

Tầng Ứng dụng/Logic nghiệp vụ (Application/Business Logic Layer) 

Công nghệ: FastAPI (Python), Uvicorn 

Chức năng: 

Xử lý các endpoint API cho nhận dạng ký hiệu, tính điểm. 

Quản lý bài học, tiến độ người dùng, lịch sử thực hành. 

Tích hợp với dịch vụ ML (LSTM inference, embedding comparison). 

Xử lý yêu cầu từ frontend và gửi response tương ứng. 

Các router chính: 

/auth/register, /auth/login - đăng ký và đăng nhập. 

/translate - dự đoán ký hiệu từ keypoints sequence. 

/score - tính điểm bằng cách so sánh với reference embedding. 

/lessons, /users/me/progress, /users/{user_id}/progress - quản lý bài học và tiến độ. 

/data-collection/start/{action}/{video_num} - khởi tạo phiên ghi hình và /data-collection/frame-vector/{action}/{video_num} - lưu batch frames training. 

Tầng Dịch vụ Machine Learning (ML Services Layer) 

Công nghệ: TensorFlow/Keras, MediaPipe, NumPy, scikit-learn 

Chức năng: 

Tải mô hình LSTM đã train (action.h5) để nhận dạng ký hiệu. 

Thư viện MediaPipe được sử dụng ở frontend để trích xuất landmarks; backend nhận dữ liệu landmarks đã tiền xử lý và tập trung vào inference, embedding và so sánh.

Tính embedding vector từ chuỗi keypoints bằng embedding layers. 

So sánh cosine similarity hoặc Euclidean distance với reference embeddings (*.npy files). 

Chuẩn hóa dữ liệu, xử lý chuỗi keypoints trước khi đưa vào model. 

Các dịch vụ chính: 

inference.py - load model LSTM, thực hiện prediction. 

scoring.py - tính điểm dựa trên similarity score. 

hand_utils.py, data_collection.py - xử lý landmark, chuẩn hóa. 

Tầng Dữ liệu (Data Layer) 

Công nghệ: PostgreSQL, SQLAlchemy 

Chức năng: 

Lưu trữ bảng User, Lesson, Progress, Attempt (kết quả thực hành). 

Quản lý schema, migration, truy vấn dữ liệu. 

Đảm bảo tính toàn vẹn dữ liệu thông qua foreign keys, constraints. 

Các bảng chính: 

users - thông tin người dùng (id, username, password_hash, created_at). 

lessons - danh sách bài học (id, name, difficulty, description). 

progress - tiến độ mỗi người dùng cho từng ký hiệu (user_id, sign_id, best_score, attempts_count). 

attempts - lịch sử mỗi lần thực hành (id, user_id, lesson_id, sign_id, score, feedback). 

Tầng Assets & Trained Models 

Công nghệ: NumPy (.npy files), TensorFlow Saved Models, JSON 

Chức năng: 

Lưu trữ mô hình LSTM đã train (action.h5) để sử dụng trong inference. 

Lưu reference embeddings cho các ký hiệu (ref_A_left.npy, ref_HELLO_both.npy, v.v.). 

Lưu reference landmarks để so sánh (ref_A_left_embed.npy). 

Lưu scaler.json để chuẩn hóa dữ liệu input trước prediction. 

Lưu actions.json mapping từ class index sang tên ký hiệu (0 → 'A', 1 → 'B', etc.). 

Tầng Dữ liệu Training 

Công nghệ: NumPy arrays, folder structure 

Chức năng: 

Lưu trữ dữ liệu training thu thập từ người dùng (backend/datasets/MP_Data/). 

Tổ chức theo structure: MP_Data/[SIGN]/[VIDEO_NUMBER]/{frame_num}.npy

Mỗi ký hiệu có 100 videos, mỗi video là chuỗi 30 frames landmark. 

Được sử dụng trong huấn luyện LSTM model trong train_holistic.py. 

 

3.3. Kết quả thực nghiệm 

3.3.1. Giao diện đăng nhập 

Người dùng mới có thể tạo tài khoản với username và password. Hệ thống hash password bằng bcrypt, lưu vào database, và tạo JWT token để duy trì session. Người dùng đã có tài khoản có thể đăng nhập và truy cập các trang được bảo vệ. 

 

3.3.2. Giao diện danh sách bài học 

Hiển thị các bài học được phân loại theo độ khó (beginner, intermediate, advanced). Mỗi bài học gồm tên ký hiệu, mô tả, video minh họa tham chiếu, và số lần người dùng đã thực hành. Người dùng có thể click để vào trang practice. 

 

3.3.3. Giao diện thực hành 

Thành phần chính của trang này là camera feed real-time với skeleton overlay từ MediaPipe. Bên cạnh là video tham chiếu (reference) và hướng dẫn bàn tay. Khi người dùng thực hiện gesture: 

Frontend ghi lại chuỗi landmarks dài 30 frames mỗi lần gửi.

Gửi lên backend để nhận dạng ký hiệu (endpoint /translate). 

Nhận kết quả dự đoán (sign name, confidence score). 

Tính điểm bằng cách so sánh embeddings (endpoint /score). 

Hiển thị score (0-100), feedback chi tiết (accuracy, hand position, speed), và buttons để retry hoặc next lesson. 

 

3.3.4. Giao diện tiến độ 

Hiển thị thống kê tiến độ học tập của người dùng: 

Bảng danh sách các ký hiệu đã học với best_score, attempts_count, last_attempt_at. 

Biểu đồ hoặc thống kê tổng quan (tổng số ký hiệu đã thành thục, tổng lần thực hành). 

Chi tiết mỗi lần thực hành (attempt history) với timestamp, score, feedback. 

 

3.3.5. Giao diện thu thập dữ liệu 

Công cụ để admin/developer thu thập dữ liệu training: 

Chọn ký hiệu (A, B, HELLO, LOVE, ME, YOU, v.v.) và số video (1-100). 

Nhấn "Start Recording", camera bật và ghi 30 frames. 

MediaPipe trích xuất landmarks mỗi frame, lưu vào file .npy. 

Dashboard hiển thị tiến độ thu thập (x/100 videos per sign), status để biết ký hiệu nào đủ dữ liệu. 

3.4. Kết chương 3 

Chương này trình bày quá trình xây dựng hệ thống Kineira từ cài đặt môi trường, phân tầng kiến trúc, đến kết quả thực nghiệm. Các công cụ được lựa chọn (Next.js, FastAPI, PostgreSQL, TensorFlow) phù hợp với yêu cầu của ứng dụng học ngôn ngữ ký hiệu theo thời gian thực. Kiến trúc phân tầng rõ ràng giúp dễ bảo trì và mở rộng, trong khi phần ML services đảm bảo độ chính xác của nhận dạng cử chỉ. 