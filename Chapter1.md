Chương 1. TỔNG QUAN VỀ NGÔN NGỮ KÝ HIỆU VÀ CÔNG NGHỆ THỊ GIÁC MÁY TÍNH 

1.1. Tổng quan về ngôn ngữ ký hiệu và thách thức trong học tập 

Ngôn ngữ ký hiệu là phương tiện giao tiếp chính của cộng đồng người khiếm thính, sử dụng cử chỉ bàn tay, biểu cảm khuôn mặt và chuyển động cơ thể để truyền đạt thông tin. Mỗi quốc gia có hệ thống ngôn ngữ ký hiệu riêng (ASL – Mỹ, VSL – Việt Nam,…). Việc học ngôn ngữ ký hiệu truyền thống thường gặp nhiều rào cản: thiếu người hướng dẫn, chi phí cao, không có phản hồi tức thì về độ chính xác của động tác. Các ứng dụng học tập hiện có chủ yếu dựa trên video hoặc hình ảnh tĩnh, chưa tận dụng được sức mạnh của thị giác máy tính để nhận dạng và đánh giá cử chỉ theo thời gian thực. 

Kineira ra đời nhằm giải quyết các vấn đề trên bằng cách kết hợp: 

Phát hiện bàn tay, cơ thể và khuôn mặt thời gian thực qua webcam. 

Mô hình học sâu nhận dạng ký hiệu (bảng chữ cái, từ vựng, câu ngắn). 

Hệ thống chấm điểm và phản hồi giúp người học cải thiện ngay lập tức. 

Nền tảng web hiện đại cho phép truy cập mọi lúc, mọi nơi. 

1.2. Cơ sở lý thuyết về thị giác máy tính và nhận dạng cử chỉ 

1.2.1. MediaPipe – giải pháp phát hiện landmark 

MediaPipe là thư viện mã nguồn mở của Google cung cấp các pipeline học máy để xử lý dữ liệu đa phương thức (video, âm thanh). Trong đồ án, chúng em sử dụng Holistic đã tích hợp: 

Hand Landmarker: Phát hiện 21 điểm mốc (landmark) trên mỗi bàn tay, bao gồm tọa độ (x, y, z) được chuẩn hóa trong khung hình. Các điểm này mô tả chính xác cấu trúc bàn tay, khớp ngón tay và cổ tay. 

Pose Landmarker: Phát hiện 33 điểm trên cơ thể, trong đó chúng em chọn 23 

điểm quan trọng (vai, khuỷu tay, cổ tay) để hỗ trợ nhận dạng các ký hiệu có chuyển động toàn thân. 

Face Landmarker: Phát hiện 468 điểm trên khuôn mặt, chúng em chọn 37 điểm chính (mắt, mũi, miệng, trán, cằm) để bổ sung biểu cảm – yếu tố quan trọng trong ngôn ngữ ký hiệu. 

1.2.2. Trích xuất và chuẩn hóa landmark 

Đầu ra từ MediaPipe là các tọa độ chuẩn hóa theo kích thước khung hình. Để mô hình học sâu có thể học được các đặc trưng bất biến với vị trí của người dùng trong khung hình, chúng tôi thực hiện: 

 

 

Chuẩn hóa vị trí: Lấy cổ tay làm gốc (trừ đi tọa độ cổ tay) và chia tỷ lệ theo khoảng cách xa nhất, giúp mô hình chỉ quan tâm đến hình dáng bàn tay, không phải vị trí tuyệt đối. 

1.2.3. Mô hình học sâu cho nhận dạng chuỗi chuyển động 

Ngôn ngữ ký hiệu là chuỗi các khung hình theo thời gian, do đó cần mô hình xử lý dữ liệu tuần tự. 

LSTM (Long Short-Term Memory): Mạng nơ-ron hồi tiếp có khả năng ghi nhớ ngữ cảnh theo thời gian, phù hợp với các chuỗi landmark dài 30 frame. Mô hình trong đồ án gồm một lớp LSTM đơn hướng, theo dõi chuỗi frame có cấu trúc thời gian và trả về xác suất dự đoán cho mỗi ký hiệu.

1.3. Công nghệ web triển khai Kineira  

1.3.1. Frontend 

Next.js 14 (Pages Router) cung cấp cấu trúc thư mục rõ ràng cho các trang tĩnh và động, và frontend gọi backend qua REST API.

React xây dựng giao diện dạng component: CameraView quản lý video và canvas, TopNav điều hướng, các trang Translate, Progress, Lessons, Collect Data. 

TypeScript đảm bảo an toàn kiểu dữ liệu, đặc biệt quan trọng khi xử lý các cấu trúc landmark phức tạp (FrameLandmarks, LandmarkPoint). 

TailwindCSS tạo giao diện nhanh với các lớp tiện ích, hỗ trợ dark mode và hiệu ứng glassmorphism. 

1.3.2. Thư viện MediaPipe trên trình duyệt  

Sử dụng @mediapipe/tasks-vision với HolisticLandmarker để chạy trực tiếp các mô hình Hand/Pose/Face Landmarker trong trình duyệt thông qua WebAssembly. Lớp LandmarkTracker (TypeScript) đóng gói việc khởi tạo, gọi detectForVideo mỗi frame, và vẽ skeleton lên canvas. Dữ liệu landmark được gửi về component cha qua callback onLandmarksDetected.

1.3.3. Backend 

FastAPI cung cấp các endpoint RESTful: 

POST /translate: nhận chuỗi landmark, gọi mô hình LSTM suy luận, trả về ký hiệu dự đoán và độ tin cậy. 

POST /score: so sánh chuỗi landmark của người dùng với ký hiệu tham chiếu, tính điểm dựa trên độ tương tự (cosine similarity, Euclidean distance). 

GET /lessons, GET /users/{id}/progress, POST /users/{id}/progress: quản lý bài học và tiến trình. 

TensorFlow/Keras dùng để tải mô hình LSTM đã huấn luyện (action.h5) vào bộ nhớ, thực hiện forward pass trên GPU (nếu có) hoặc CPU. 

1.3.4. Pipeline dữ liệu và huấn luyện 

Dữ liệu thu thập thông qua ứng dụng: người dùng quay video qua webcam, MediaPipe trích xuất landmarks, lưu thành file .npy. Mỗi ký hiệu cần 100 videos để đủ dữ liệu training.

Tiền xử lý: Chuẩn hóa, cắt ngắn/đệm về số frame cố định 30, thêm nhiễu Gaussian trong quá trình huấn luyện để tăng độ bền vững.

Huấn luyện với các siêu tham số: batch size 32, learning rate 3e-4, optimizer Adam, sử dụng Early Stopping để lưu model tốt nhất dựa trên validation accuracy. 

1.4. Kết chương 1 

Chương này đã trình bày tổng quan về ngôn ngữ ký hiệu, các thách thức trong học tập, và cơ sở lý thuyết của các công nghệ được sử dụng trong Kineira: MediaPipe để phát hiện landmark, mô hình LSTM để nhận dạng chuỗi chuyển động, cùng các thành phần web hiện đại (Next.js, FastAPI, TensorFlow/Keras). Những kiến thức này là nền tảng để tiến hành phân tích và thiết kế hệ thống ở Chương 2.
