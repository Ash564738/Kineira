Chương 4. KẾT QUẢ VÀ HƯỚNG PHÁT TRIỂN 

4.1. Kết quả đạt được 

4.1.1. Về kiến thức 

Qua quá trình xây dựng Kineira, chúng em học hỏi được nhiều kỹ năng và kiến thức: 

Cơ sở lý thuyết về thị giác máy tính và nhận dạng cử chỉ qua MediaPipe. 

Xây dựng mô hình LSTM để xử lý chuỗi dữ liệu thời gian (time series). 

Thiết kế kiến trúc phần mềm phân tầng, tích hợp frontend và backend. 

Quản lý cơ sở dữ liệu PostgreSQL thông qua SQLAlchemy ORM. 

Phát triển web application hiện đại với Next.js và FastAPI. 

4.1.2. Về ứng dụng 

Qua dự án trên, chúng em đạt được một số kết quả sau: 

Website giao diện người dùng được xây dựng bằng Next.js 14 với TypeScript, có responsive design qua TailwindCSS. 

Backend API với FastAPI cung cấp các endpoint cho nhận dạng ký hiệu, tính điểm, quản lý bài học và tiến độ. 

Mô hình LSTM được train trên dữ liệu landmarks do MediaPipe trích xuất, có khả năng dự đoán ký hiệu với độ tin cậy cao. 

Database PostgreSQL lưu trữ người dùng, bài học, tiến độ, lịch sử thực hành. 

Tích hợp MediaPipe trực tiếp trong frontend (WebAssembly) để phát hiện landmarks real-time trên webcam. 

Công cụ thu thập dữ liệu (data collection) giúp admin tập hợp dữ liệu training cho việc huấn luyện model mới. 

Hệ thống tính điểm dựa trên cosine similarity giữa embedding vector của người dùng và reference embedding, cung cấp phản hồi chi tiết. 

4.2. Hạn chế 

Mặc dù đạt được nhiều kết quả, Kineira vẫn tồn tại một số hạn chế do thời gian phát triển có giới hạn: 

Giới hạn về số lượng ký hiệu: Hiện tại chỉ có 6 ký hiệu trong bộ dữ liệu (A, B, HELLO, LOVE, ME, YOU). Để mở rộng, cần thu thập thêm dữ liệu cho các ký hiệu khác. 

Hiệu năng trích xuất landmark: Trên một số máy tính cấu hình thấp, tốc độ xử lý frame có thể chậm, ảnh hưởng đến trải nghiệm real-time. 

Độ chính xác nhận dạng: Mô hình LSTM hiện tại đạt độ chính xác tốt trên dữ liệu trong bộ training, nhưng có thể giảm khi gặp các gesture có biến thể, hoặc điều kiện ánh sáng xấu. 

Thiếu tính năng advanced, chưa có tính năng như: 

Video recording để lưu lại video thực hành. 

Social features (share progress, compete với bạn). 

Hỗ trợ multiple languages cho ASL, VSL, BSL, v.v. 

Deployment: Hiện tại ứng dụng chỉ chạy locally. Để deploy lên production, cần cấu hình Docker, CI/CD pipeline, và cloud hosting. 

Performance optimization: Chưa optimize được việc load model LSTM lần đầu (cold start), caching embeddings, hoặc sử dụng quantization để giảm kích thước model. 

4.3. Hướng nghiên cứu 

Để hoàn thiện hệ thống, những hướng phát triển tiếp theo bao gồm: 

Nâng cao chất lượng model ML: 

Collect thêm dữ liệu (ít nhất 100 videos per ký hiệu) để cải thiện generalization. 

Thử các kiến trúc model khác (CNN+LSTM, Transformer, GRU). 

Áp dụng data augmentation (rotation, scaling, noise injection). 

Tuning hyperparameters để giảm overfit. 

Mở rộng phạm vi ứng dụng: 

Hỗ trợ nhiều hệ thống ngôn ngữ ký hiệu (ASL, VSL, BSL, JSL). 

Thêm các bài học về câu phức, cuộc hội thoại. 

Tích hợp phản hồi giọng nói (text-to-speech) để hướng dẫn người dùng. 

Cải thiện UX/UI: 

Thêm animation để hướng dẫn trực quan cách thực hiện gesture. 

Hiển thị skeleton overlay có màu sắc (xanh = đúng, đỏ = sai). 

Thêm leaderboard, achievement badges để động viên người dùng. 

Support mobile app (React Native hoặc Flutter). 

Optimize performance: 

Sử dụng model quantization (TensorFlow Lite) để giảm kích thước model. 

Implement server-side caching cho embeddings reference. 

Tối ưu SQL queries trong database. 

Implement lazy loading cho danh sách lessons. 

Deploy và scale: 

Containerize backend bằng Docker. 

Deploy frontend lên Vercel hoặc Netlify. 

Deploy backend lên Cloud (AWS EC2, Google Cloud Run, Azure Container Instances). 

Sử dụng database-as-a-service (AWS RDS, Google Cloud SQL). 

Implement CI/CD pipeline với GitHub Actions hoặc GitLab CI. 

Tính năng bổ sung: 

Video recording và playback để review lại gesture.  

Export tiến độ dưới dạng PDF hoặc CSV. 

Tích hợp OAuth để đăng nhập bằng Google, Facebook. 

Notification system để nhắc nhở người dùng luyện tập. 

Offline mode cho phép người dùng học khi không có internet. 

Nghiên cứu thêm: 

Phân tích feedback người dùng để cải thiện bài học. 

A/B testing các chiến lược scoring khác nhau. 

Collaborative learning features (group lessons, peer review). 

Với những cải tiến này, Kineira sẽ trở thành một nền tảng học ngôn ngữ ký hiệu toàn diện, hỗ trợ người khiếm thính và những người quan tâm học ký hiệu với trải nghiệm hiệu quả và hấp dẫn. 