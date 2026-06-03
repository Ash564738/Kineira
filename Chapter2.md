Chương 2. PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG 

2.1. Phân tích yêu cầu 

Trong quá trình thực hiện, việc phân tích các yêu cầu là phần quan trọng giúp định hướng phát triển hệ thống học ngôn ngữ ký hiệu Kineira một cách chính xác và hiệu quả. 

2.1.1. Yêu cầu chức năng 

Nhóm chức năng phát hiện và nhận dạng 

Phát hiện bàn tay thời gian thực: Sử dụng MediaPipe để xác định 21 điểm mốc (landmark) trên mỗi bàn tay, cũng như các điểm trên cơ thể và khuôn mặt. 

Nhận dạng ký hiệu: Hệ thống nhận dạng các ký hiệu ngôn ngữ ký hiệu (bảng chữ cái, từ vựng, câu ngắn) từ chuỗi landmark theo thời gian. 

Chấm điểm và phản hồi: So sánh động tác của người dùng với ký hiệu chuẩn, đưa ra điểm số (0–100) và gợi ý cải thiện. 

Nhóm chức năng bài học và tiến trình 

Quản lý bài học: Hệ thống cung cấp các bài học theo chủ đề (bảng chữ cái, gia đình, chào hỏi, v.v.) với cấu trúc từ dễ đến khó. 

Theo dõi tiến trình: Lưu lại lịch sử luyện tập, điểm số, số lần thực hành, và đề xuất ôn tập. 

Hiển thị thống kê: Biểu đồ tiến bộ, điểm trung bình, số ký hiệu đã thành thục. 

Nhóm chức năng người dùng 

Đăng ký, đăng nhập, đăng xuất. 

Xác thực an toàn (có thể mở rộng OAuth sau này). 

Lưu trữ tiến trình cá nhân và cài đặt. 

2.1.2. Yêu cầu phi chức năng 

Hiệu năng: Độ trễ nhận dạng dưới 200ms, xử lý tối thiểu 30 khung hình/giây trên trình duyệt thông thường. 

Tính sẵn sàng: Hệ thống hoạt động ổn định, hỗ trợ đồng thời 50 người dùng. 

Bảo mật: Dữ liệu landmark chỉ gửi lên server khi cần nhận dạng, không lưu trữ video thô. 

Khả năng mở rộng: Dễ dàng bổ sung thêm ký hiệu mới, ngôn ngữ ký hiệu khác (VSL, BSL). 

Trải nghiệm người dùng: Giao diện trực quan, hướng dẫn chi tiết, phản hồi rõ ràng. 

2.2. Biểu đồ Use Case hệ thống 

Use Case: Đăng ký tài khoản 

Mục tiêu: Người dùng mới có thể tạo tài khoản để bắt đầu học 

Tác nhân: Người dùng mới (New User) 

Điều kiện tiên quyết: Ứng dụng đang chạy, người dùng chưa có tài khoản 

Điều kiện sau: User được tạo trong DB, token được lưu, user đăng nhập thành công 

Mô tả: Người dùng truy cập trang đăng ký, nhập username và password, hệ thống kiểm tra username có tồn tại chưa. Nếu chưa, tạo user mới với mật khẩu được hash, tạo access token, và redirect người dùng về trang chính. 

Use Case: Đăng nhập tài khoản 

Mục tiêu: Người dùng đã có tài khoản có thể truy cập vào ứng dụng 

Tác nhân: Người dùng đã có tài khoản (Existing User) 

Điều kiện tiên quyết: Ứng dụng đang chạy, user có tài khoản hợp lệ 

Điều kiện sau: Token được lưu ở client, user session được tạo, redirect về trang chính 

Mô tả: Người dùng nhập username và password, hệ thống xác thực credentials. Nếu đúng, tạo access token và lưu vào client. Nếu sai, hiển thị lỗi "Invalid username or password” 

Use Case: Bật camera và theo dõi bàn tay 

Mục tiêu: Hệ thống tự động detect, phân tích các gesture bàn tay của người dùng khi thực hành 

Tác nhân: Hệ thống Computer Vision + Mediapipe (AI Engine) 

Điều kiện tiên quyết: User đã chọn bài học, có camera/webcam, quyền truy cập camera được cấp 

Điều kiện sau: Landmarks được detect, keypoints được extract, gửi tới API để dự đoán ký hiệu 

Mô tả: Sau khi user nhấn "Start Practice", hệ thống bật camera và sử dụng Mediapipe để detect landmarks (hand keypoints) từ mỗi frame. Hệ thống phân tích 21 điểm trên mỗi bàn tay, normalize theo tỷ lệ, và lưu sequence keypoints. Gửi dữ liệu tới API /translate để dự đoán ký hiệu. 

Use Case: dự đoán ký hiệu (Recognition) 

Use Case: Dự đoán ký hiệu từ gesture bàn tay 

Mục tiêu: Hệ thống tự động nhận dạng ký hiệu mà user thực hiện 

Tác nhân: Model LSTM (AI Engine) 

Điều kiện tiên quyết: Model đã được train, landmarks được detect thành công, có dữ liệu keypoints sequence 

Điều kiện sau: Ký hiệu được dự đoán, confidence score được tính, feedback được sinh ra 

Mô tả: Hệ thống nhận keypoints sequence từ camera, đưa vào LSTM model để dự đoán ký hiệu. Model trả về tên ký hiệu (A, B, HELLO, v.v.) và confidence score (0-1). Nếu confidence < ngưỡng, yêu cầu user thử lại. Nếu dự đoán chính xác, chuyển sang tính điểm chi tiết. 

Use Case: Xem danh sách bài học 

Use Case: Xem danh sách bài học theo mức độ khó 

Mục tiêu: User có thể dễ dàng tìm và chọn bài học phù hợp 

Tác nhân: Người dùng đã đăng nhập (Authenticated User) 

Điều kiện tiên quyết: User đã đăng nhập, token hợp lệ, hệ thống có lesson data 

Điều kiện sau: Danh sách lessons được hiển thị, user có thể chọn lesson để tập 

Mô tả: User mở trang "Lessons", hệ thống fetch danh sách lessons từ API. Hiển thị lessons được phân loại theo difficulty level (beginner, intermediate, advanced, expert). Mỗi lesson hiển thị tên, mô tả, video minh họa, độ khó. User có thể filter theo độ khó để tìm bài phù hợp. 

Use Case: Xem lịch sử cố gắng (Attempt History) 

Use Case: Xem lịch sử tất cả lần thực hành 

Mục tiêu: User theo dõi được tất cả các lần cố gắng, điểm số, và feedback 

Tác nhân: Người dùng (Learner) 

Điều kiện tiên quyết: User đã đăng nhập, có ít nhất 1 lần thực hành 

Điều kiện sau: Lịch sử được hiển thị, user có thể xem chi tiết mỗi attempt 

Mô tả: User mở trang "Progress", hệ thống fetch dữ liệu attempts từ API /users/me/progress. Hiển thị chi tiết mỗi attempt gồm: ký hiệu, bài học, điểm số, confidence, thời gian thực hành, feedback. Sắp xếp theo thời gian mới nhất trước. 

Use Case: Theo dõi tiến độ học tập (Progress Tracking) 

Use Case: Theo dõi tiến độ học tập theo từng ký hiệu 

Mục tiêu: User có thể thấy được mức độ tiến bộ, điểm cao nhất, và lần gần nhất thực hành 

Tác nhân: Người dùng (Learner) 

Điều kiện tiên quyết: User đã đăng nhập, đã thực hành ít nhất 1 bài 

Điều kiện sau: Progress được hiển thị, user hiểu được tiến độ của mình 

Mô tả: User xem trang Progress, hệ thống hiển thị tiến độ cho mỗi ký hiệu bao gồm: best_score (điểm cao nhất), attempts_count (tổng số lần cố gắng), last_attempt_at (lần gần nhất thực hành khi nào), completed (đã hoàn thành hay chưa). Hiển thị thống kê tổng quan về tiến độ học tập. 

Use Case: Thu thập dữ liệu training 

Use Case: Thu thập dữ liệu gesture để training model 

Mục tiêu: Hệ thống tự động ghi hình, detect landmarks, và lưu dữ liệu training 

Tác nhân: Hệ thống Data Collection (AI Engine) 

Điều kiện tiên quyết: Admin/Developer bật data collection, có camera, định nghĩa sẵn các action cần collect 

Điều kiện sau: 100 videos được collect, mỗi video là 30 frame landmark, data ready cho training

Mô tả: Admin chọn action cần collect (A, B, HELLO, v.v.) và video number (1-100). Hệ thống bật camera và ghi 30 frames mỗi video. Detect landmarks mỗi frame, normalize dữ liệu, lưu vào file .npy. Gửi batch frames tới endpoint /data-collection/frame-vector/{action}/{video_num}. Sau khi hoàn thành 100 videos cho 1 action, dữ liệu sẵn sàng cho training.

Use Case: Kiểm tra trạng thái data collection 

Use Case: Kiểm tra tiến độ thu thập dữ liệu 

Mục tiêu: Admin biết được bao nhiêu videos đã collect cho mỗi action 

Tác nhân: Admin/Developer 

Điều kiện tiên quyết: Đang trong quá trình thu thập dữ liệu 

Điều kiện sau: Status dashboard được hiển thị, admin biết tiến độ collection 

Mô tả: Admin mở trang Data Collection, gọi API /data-collection/status. Hệ thống trả về số video đã collect cho mỗi action, progress % (x/100 video). Hiển thị status dashboard để admin theo dõi.

Use Case: Training model LSTM 

Use Case: Training LSTM model từ dữ liệu collected 

Mục tiêu: Hệ thống tự động train model để cải thiện độ chính xác dự đoán 

Tác nhân: Training Engine (TensorFlow + LSTM) 

Điều kiện tiên quyết: Đã collect đủ data (100 videos/action), data được preprocess thành .npy files

Điều kiện sau: Model được train xong, loss & accuracy cải thiện, model được lưu 

Mô tả: Admin nhấn "Start Training", hệ thống gọi API /training/start. Training chạy background, load dữ liệu từ /datasets/MP_Data/, build LSTM model, train trên mỗi epoch. Cập nhật training_state (progress, loss, accuracy). Admin có thể monitor qua /training/status. Sau khi hoàn thành, model được lưu vào /assets/models/action.h5. 

Use Case: Lưu kết quả attempt 

Use Case: Lưu kết quả thực hành vào database 

Mục tiêu: Hệ thống ghi nhận mỗi lần thực hành của user để tracking tiến độ 

Tác nhân: Hệ thống Backend 

Điều kiện tiên quyết: User hoàn thành một practice session, có score & feedback 

Điều kiện sau: Attempt lưu trong DB, Progress cập nhật (best_score, attempts_count, last_attempt_at) 

Mô tả: Sau khi tính điểm xong, hệ thống gọi POST /users/{user_id}/progress gửi dữ liệu: user_id, lesson_id, sign_id, score, feedback, landmarks_data. Tạo record Attempt mới. Cập nhật Progress record: best_score = max(hiện tại, điểm mới), attempts_count += 1, last_attempt_at = bây giờ. Hiển thị kết quả cho user. 

 

Hình 1 Biểu đồ Use case 

2.3. Sequence Diagram 

Mục đích: User tạo tài khoản mới hoặc đăng nhập vào hệ thống. 

Các bước: 

User nhập username và password vào form 

Frontend gửi POST /auth/register tới backend 

Backend kiểm tra username có tồn tại trong database chưa 

Nếu username chưa tồn tại, backend hash password (dùng bcrypt) 

Backend INSERT user mới vào database → nhận user_id 

Auth Service tạo JWT token với payload {sub: username} 

Backend trả response: {access_token, token_type: "bearer"} 

Frontend lưu token vào localStorage 

Frontend redirect user tới trang home → User đã đăng nhập 

 

Hình 2 Sequence diagram đăng kí & đăng nhập 

Sequence Diagram: Thực hành bài học 

Mục đích: User thực hành gesture, hệ thống tính điểm và lưu kết quả. 

Các bước: 

User chọn lesson từ danh sách, nhấn "Start Practice" 

Frontend khởi tạo CameraView component → bật camera 

CameraView khởi tạo LandmarkTracker (Mediapipe) 

Hiển thị live camera feed + reference video (mẫu gesture chuẩn) 

User thực hiện gesture trước camera 

Mỗi frame, Mediapipe detect 21 keypoints trên mỗi bàn tay (42 tổng) 

LandmarkTracker normalize keypoints và callback onFrameDetected() 

Frontend tích lũy keypoints từ 30 frames thành sequence 

Frontend POST /translate với keypoints sequence → LSTM predict sign 

Frontend POST /score → Backend tính accuracy, completeness, timing → sinh feedback 

Frontend hiển thị score, feedback và chi tiết metrics 

Frontend POST /users/me/progress → Backend INSERT attempt + UPDATE progress (best_score, attempts_count) 

Hiển thị "Attempt saved!" 

 

Hình 3 Sequence diagram thực hành bài học 

Sequence Diagram: Dự đoán ký hiệu Real-time 

Mục tiêu: Dự đoán ký hiệu từ gesture real-time 

Các bước: 

Camera capture frame liên tục (640×480) 

Mediapipe detect 21 keypoints trên mỗi bàn tay (42 tổng) 

Keypoints được normalize relative tới bounding box bàn tay (tránh phụ thuộc vị trí) 

Frontend POST /translate với normalized keypoints sequence 

Backend gửi keypoints tới LSTM model. 

LSTM xử lý qua hidden layers, output softmax probabilities. 

Backend lấy top-1 prediction + confidence. 

Trả response: {sign: "A", confidence: 0.92} 

Camera hiển thị: 

Nếu confidence > 0.8 → Hiển thị sign name 

Nếu confidence < 0.8 → Hiển thị "Uncertain - Try again" 

 

Hình 4 Dự đoán ký hiệu Real-time 

Sequence Diagram: Thu thập dữ liệu 

Mục tiêu: Ghi hình gesture, detect landmarks, lưu dữ liệu để training model. 

Các bước: 

Admin chọn action (ví dụ: "A") và video number (1-100) 

Frontend gửi POST /data-collection/start/A/1 → backend validate 

Frontend bật camera, bắt đầu ghi hình 

Mỗi frame: 

Capture frame từ camera 

Mediapipe detect landmarks 

Normalize keypoints 

Callback onFrameDetected() 

Frontend tích lũy 4-5 frames thành batch 

Frontend POST /data-collection/frame-vector/A/1 với batch frames 

Backend gọi save_vector_frame() → lưu keypoints vào file .npy 

File path: /datasets/MP_Data/A/1/0-xyz.npy 

Lặp cho 30 frames → video 1 hoàn thành 

Admin nhấn "Next Video" → repeat cho video 2, 3, ..., 100 

Sau 100 videos → Frontend hiển thị "All 100 videos collected! Ready for training" 

 

Hình 5 Sequence diagram thu thập dữ liệu 

Sequence Diagram: Training model LSTM 

Mục tiêu: Training LSTM model từ collected data để cải thiện accuracy. 

Các bước: 

Admin click "Start Training" → POST /training/start 

Backend spawn background thread (không block) 

HolisticTrainer load tất cả 100 .npy files từ /datasets/MP_Data/ 

Combine thành array: [100 videos × 30 frames × 84 keypoints] 

Preprocess data: 

Split 80/20 train/test (40 train, 10 test) 

Normalize, shuffle 

Build LSTM model với TensorFlow: 

Input: 30×84 

Hidden: 128 units 

Output: softmax (number of sign classes) 

Training loop (ví dụ 50 epochs): 

Mỗi epoch: forward pass → compute loss → backward pass → update weights 

Update training_state: progress = (epoch/50)×100 

Frontend polling GET /training/status mỗi 1 giây 

Hiển thị progress bar: "Training... 45%" 

Sau training xong: 

Evaluate trên test set → tính final_accuracy 

Save model vào /assets/models/action.h5 

 

Hình 6 Sequence diagram training model LSTM 

Sequence Diagram: Xem tiến độ học tập 

Các bước: 

User click vào "Progress" page 

Frontend extract user_id từ JWT token (stored in localStorage) 

Frontend GET /users/me/progress → nhận progress data 

Mỗi sign gồm: best_score, attempts_count, last_attempt_at, completed 

Frontend render progress table: 

Sign A: Best 92, Attempts 15, Last 2h ago 

Sign B: Best 88, Attempts 12, Last 1d ago 

Frontend GET /users/me/progress/attempts → nhận attempt history 

Query: SELECT * FROM attempts ORDER BY created_at DESC 

Frontend render attempts history table: 

Hiển thị: sign_name, score, feedback, timestamp 

Sorted từ mới nhất trước 

Frontend hiển thị tổng hợp stats: 

Total signs: X 

Total attempts: Y 

Average score: Z 

 

Hình 7 Sequence diagram xem tiến độ học tập 

2.4. Thiết kế hệ thống 

2.4.1. Thiết kế giao diện 

2.4.1.1. Phác thảo giao diện đăng kí & đăng nhập 

Hình 8 Thể hiện giao diện đăng kí & đăng nhập cho người dùng 

 

Hình 8 Phác thảo giao diện đăng nhập 

 

Hình 9 Phác thảo giao diện đăng kí 

2.4.1.2. Phác thảo giao diện chính 

Phác thảo giao diện của ứng dụng web 

 

 

Hình 9 Phác thảo giao diện chính 

2.4.2. Thiết kế Cơ sở dữ liệu (CSDL)  

 

Hình 10 Mô hình diagram CSDL 

2.5. Kết chương 2 

Việc phân tích yêu cầu chi tiết và thiết kế hệ thống cẩn thận không chỉ giúp định hướng rõ ràng cho các bước tiếp theo mà còn đảm bảo rằng sản phẩm cuối cùng sẽ đáp ứng tốt các nhu cầu của người dùng. Trên cơ sở các thiết kế và phân tích này để tiến hành xây dựng ứng dụng trong chương 3, nhằm hiện thực hóa các yêu cầu và chức năng đã được đề ra.  

 