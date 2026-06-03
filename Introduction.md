MỞ ĐẦU 

1. Giới thiệu 

1.1. Tổng quan đề tài 

Ngôn ngữ ký hiệu là công cụ giao tiếp thiết yếu cho cộng đồng người khiếm thính, nhưng việc tiếp cận và học tập ngôn ngữ này còn nhiều rào cản. Các phương pháp học truyền thống (giáo trình, video, lớp học trực tiếp) thường thiếu tính tương tác, không có phản hồi tức thì về độ chính xác của động tác, đồng thời chi phí cao và hạn chế về không gian, thời gian. 

Đề tài hướng tới xây dựng một hệ thống web Kineira – Nền tảng học ngôn ngữ ký hiệu tương tác, ứng dụng thị giác máy tính và trí tuệ nhân tạo để nhận dạng cử chỉ bàn tay theo thời gian thực. Hệ thống hoạt động theo mô hình client–server, cho phép người dùng học mọi lúc, mọi nơi chỉ với một trình duyệt và camera. 

Hệ thống sử dụng kiến trúc client–server: 

Client (frontend web): Giao diện người dùng được xây dựng bằng Next.js 14 (TypeScript), TailwindCSS. Sử dụng thư viện MediaPipe Tasks Vision với HolisticLandmarker để phát hiện landmarks tay, cơ thể và khuôn mặt từ luồng camera. Client đảm nhận việc hiển thị bài học, thu nhận khung hình, trích xuất landmark và gửi lên server để nhận dạng.

Server (backend web): Cung cấp API bằng FastAPI (Python), tích hợp mô hình học sâu TensorFlow/Keras để nhận dạng ký hiệu từ chuỗi landmark theo thời gian. Server quản lý cơ sở dữ liệu (PostgreSQL), lưu trữ tiến trình học tập, điểm số và lịch sử luyện tập.

Bên cạnh chức năng nhận dạng cơ bản, hệ thống tích hợp các tính năng nâng cao: 

Theo dõi bàn tay thời gian thực: Phát hiện 21 landmark của mỗi bàn tay với MediaPipe, hiển thị khung xương trực tiếp lên giao diện. 

Nhận dạng ký hiệu bằng AI: Mô hình học sâu nhận diện chính xác từng ký hiệu dựa trên chuỗi chuyển động, hỗ trợ cả ký tự (bảng chữ cái) và từ vựng. 

Chấm điểm và phản hồi thông minh: Hệ thống tự động chấm điểm độ chính xác so với ký hiệu chuẩn, đưa ra gợi ý sửa lỗi (ví dụ: góc độ bàn tay, hướng chuyển động). 

Theo dõi tiến trình: Lưu lại lịch sử luyện tập, thống kê điểm số, gợi ý bài học cần ôn tập. 

Việc triển khai dưới dạng web application cho phép người dùng truy cập từ mọi thiết bị có trình duyệt và camera, không cần cài đặt thêm phần mềm, đồng thời dễ dàng cập nhật, mở rộng kho ký hiệu và cải tiến mô hình AI. 

1.2. Mục tiêu đề tài 

Dự án này được thực hiện với mục tiêu xây dựng một web application học ngôn ngữ ký hiệu tương tác bằng AI và thị giác máy tính. Chương trình được phát triển bằng các công nghệ hiện đại: Next.js, TypeScript, TailwindCSS cho giao diện người dùng; FastAPI, TensorFlow/Keras, MediaPipe cho backend và frontend; và PostgreSQL để lưu trữ dữ liệu. Cụ thể gồm:

Xác thực và quản lý người dùng: Đăng ký, đăng nhập, quản lý phiên và lưu trữ tiến trình cá nhân. 

Phát hiện bàn tay thời gian thực: Sử dụng MediaPipe để phát hiện 21 điểm mốc bàn tay từ camera, tối ưu hiệu suất để hoạt động mượt mà trên trình duyệt. 

Nhận dạng ký hiệu bằng AI: Huấn luyện mô hình TensorFlow/Keras trên bộ dữ liệu thu thập từ webcam, hỗ trợ nhận dạng cả ký hiệu tĩnh (chữ cái) và động (từ vựng có chuyển động).

Chấm điểm và phản hồi trực tiếp: So sánh chuỗi landmark của người dùng với ký hiệu chuẩn, đưa ra điểm số và gợi ý cải thiện. 

Hệ thống bài học có cấu trúc: Cung cấp các bài học theo trình tự (bảng chữ cái → từ đơn → câu ngắn), kèm video minh họa và hướng dẫn chi tiết. 

Theo dõi tiến trình và thống kê: Hiển thị biểu đồ tiến bộ, điểm trung bình, số ký hiệu đã thành thục, gợi ý ôn tập. 

2. Nội dung và kế hoạch thực hiện 

2.1. Đồ án tập trung thực hiện các nội dung chính 

Giới thiệu. 

Nghiên cứu tổng quan về đề tài. 

Nghiên cứu cơ sở lý thuyết của đề tài. 

Tiến hành phân tích và thiết kế. 

Xây dựng Giao diện người dùng (GUI). 

Xây dựng các chức năng cho ứng dụng. 

Thử nghiệm. 

Hoàn thiện và viết báo cáo. 

2.2. Kế hoạch thực hiện 

Thời gian 

Nội dung thực hiện 

Người thực hiện 

Ngày 17/03/2026 

Sinh viên chỉnh sửa và nộp đề cương chi tiết theo mẫu quy định. 

Đặng Kiều Trang 

Lê Văn Mẩn 

Tuần 2 từ ngày 23/03 đến 29/03 

Phân tích yêu cầu hệ thống, xác định chức năng chính của ứng dụng và kiến trúc tổng thể của hệ thống 

Đặng Kiều Trang 

Lê Văn Mẩn 

Tuần 3 từ ngày 30/03 đến 05/ 

Thiết kế hệ thống: thiết kế sơ đồ kiến trúc, sơ đồ hoạt động và luồng xử lý dữ liệu 

Đặng Kiều Trang 

Lê Văn Mẩn 

Tuần 4 từ ngày 06/04 đến 12/04 

Thu thập và chuẩn bị dataset ngôn ngữ ký hiệu, thực hiện tiền xử lý dữ liệu 

Đặng Kiều Trang 

Lê Văn Mẩn 

Tuần 5 từ ngày 13/04 đến 19/04 

Xây dựng và huấn luyện mô hình AI nhận diện cử chỉ tay 

Đặng Kiều Trang 

Lê Văn Mẩn 

Tuần 6 từ ngày 20/04 đến 26/04 

Xây dựng chức năng nhận diện ngôn ngữ ký hiệu từ camera thời gian thực 

Đặng Kiều Trang 

Lê Văn Mẩn 

Tuần 7 từ ngày 27/04 đến 03/05 

Xây dựng giao diện ứng dụng và tích hợp với hệ thống AI 

Đặng Kiều Trang 

Lê Văn Mẩn 

Tuần 8 từ ngày 04/05 đến 10/05 

Kiểm thử hệ thống, cải thiện độ chính xác của mô hình và hoàn thiện chức năng 

Đặng Kiều Trang 

Lê Văn Mẩn 

Tuần 9 từ ngày 11/05 đến 14/05 

Hoàn thiện báo cáo, chỉnh sửa theo góp ý của giảng viên. Nộp bài làm. 

Đặng Kiều Trang 

Lê Văn Mẩn 

Bảng 1. Kế hoạch thực hiện 

3. Bố cục báo cáo 

Sau phần Mở đầu, báo cáo được trình bày trong bốn chương, cụ thể như sau: 

Chương 1. Tổng quan về ngôn ngữ ký hiệu và công nghệ thị giác máy tính. Trình bày tầm quan trọng của ngôn ngữ ký hiệu, các thách thức trong học tập, tổng quan về MediaPipe, mô hình học sâu cho nhận dạng cử chỉ, và các công trình liên quan. 

Chương 2. Phân tích và thiết kế hệ thống. Trình bày yêu cầu chức năng/phi chức năng, thiết kế kiến trúc client–server, thiết kế cơ sở dữ liệu, thiết kế giao diện người dùng, và thiết kế pipeline huấn luyện mô hình. 

Chương 3. Xây dựng hệ thống website. Trình bày các module đã cài đặt: module phát hiện bàn tay, module gọi API nhận dạng, module bài học và chấm điểm, module theo dõi tiến trình, kết quả đánh giá độ chính xác của mô hình. 

Chương 4. Kết luận và hướng phát triển. Chương này trình bày những điều đã học được về kiến thức, kinh nghiệm và dự định dự kiến tiếp theo. 

Cuối cùng là Tài liệu tham khảo và Phụ lục liên quan đến đề tài. 