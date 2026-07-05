# Hướng Dẫn Thiết Lập & Sử Dụng Hệ Thống Quản Lý HNT Education (Phiên bản v2)

Tài liệu này hướng dẫn thầy Hoàng cách cài đặt và sử dụng các tính năng mới của phiên bản v2, bao gồm: **Tải ảnh đại diện trực tiếp lên Google Drive**, **Đổi mã học sinh tự động đồng bộ**, **Báo cáo tài chính chuyên sâu**, **Quản lý danh sách học sinh theo từng Ca/Buổi học để điểm danh**, và **Khôi phục dữ liệu từ bản backup**.

---

## PHẦN 1: CẬP NHẬT GOOGLE APPS SCRIPT (v2)

Phiên bản v2 bổ sung nhiều cột thông tin mới và tính năng tải ảnh, vì vậy thầy cần cập nhật mã code trên Google Sheets:

1. Mở file Google Sheet quản lý học sinh trên Google Drive của thầy.
2. Vào **Tiện ích mở rộng (Extensions)** > **Apps Script**.
3. Xóa toàn bộ code cũ và copy dán toàn bộ code mới từ file **[google_apps_script.js](google_apps_script.js)** vào trình soạn thảo.
4. Chỉnh sửa mật mã ở dòng 15: `var PASSCODE = "Mật_khẩu_của_thầy";` thành mật mã của thầy.
5. Bấm nút **Lưu (Save)**.
6. Bấm **Triển khai (Deploy)** > **Quản lý các bản triển khai (Manage deployments)**.
7. Chọn bản triển khai hiện tại, bấm biểu tượng **Bút chì (Edit)**, chọn phiên bản mới: **Phiên bản mới (New version)**. Bấm **Triển khai (Deploy)**.
   *   *(Lưu ý: Việc tạo Phiên bản mới rất quan trọng để Google cập nhật code mới chạy trên cùng 1 liên kết URL Web App).*
   *   *Nếu là lần đầu tiên triển khai, hoặc nếu URL bị thay đổi, hãy copy lại URL ứng dụng web mới.*

---

## PHẦN 2: HƯỚNG DẪN SỬ DỤNG CÁC TÍNH NĂNG MỚI (v2)

Thầy mở trang **[quanly.html](quanly.html)** trên trình duyệt để bắt đầu trải nghiệm các tính năng nâng cấp:

### 2.1. Đăng ký & Quản lý Ảnh đại diện (Avatar)
*   **Cách hoạt động**: Khi thêm hoặc sửa học sinh, thầy click vào hình tròn đại diện (mặc định hiện chữ cái đầu) để chọn ảnh từ máy tính hoặc điện thoại.
*   **Bảo mật & Lưu trữ**: Hệ thống tự động gửi ảnh này qua API bảo mật. Apps Script sẽ tự động tạo thư mục mang tên `HNT_Avatars` trên Google Drive của thầy, tải ảnh lên đó, thiết lập quyền xem công khai và lưu link ảnh trực tiếp vào Google Sheet. Thầy hoàn toàn không cần tốn chi phí thuê host ảnh bên ngoài.

### 2.2. Nhập học phí Linh hoạt & Phân biệt các loại Ngày
*   **Phân biệt ngày**:
    *   **Ngày đóng tiền**: Ngày thực tế thầy nhận tiền (mặc định là hôm nay, nhưng cho phép chọn ngày khác để ghi nhận hồi tố các ngày trước).
    *   **Chu kỳ đóng phí (Từ ngày - Đến ngày)**: Ngày tính hạn học của học sinh. Mặc định hệ thống tự điền nối tiếp từ hạn cũ của học sinh đó.
*   **Hình thức đóng**: Thầy có thể chọn nhanh hình thức **Chuyển khoản** hoặc **Tiền mặt** để phục vụ việc thống kê sổ sách.
*   **Thông tin lịch sử tức thời**: Khi thầy chọn một học sinh trong form nhập nhanh, panel bên phải sẽ hiện ngay tóm tắt 3 giao dịch đóng tiền gần đây nhất, giúp thầy đối chiếu số liệu đóng phí trước đó của bé chỉ trong 1 giây mà không cần vào bảng tra cứu.

### 2.3. Chỉnh sửa Mã học sinh (ID) & Đồng bộ Giao dịch
*   Khi sửa hồ sơ học sinh, ô nhập **Mã học sinh** sẽ được mở để thầy tự gõ thay đổi (ví dụ xếp theo khối, chọn số đẹp...).
*   **Đồng bộ tự động**: Khi phát hiện mã học sinh bị thay đổi, hệ thống sẽ tự động cập nhật mã mới vào hồ sơ học sinh, đồng thời quét toàn bộ bảng lịch sử đóng phí và đổi mã học sinh cũ sang mã mới cho toàn bộ các giao dịch trước đó, tránh việc mất liên kết dữ liệu cũ.

### 2.4. Dashboard Báo cáo Tài chính & Sinh nhật
Admin Portal được tích hợp tiểu tab **Báo Cáo & Thống Kê**:
*   **Biểu đồ doanh thu**: Vẽ trực quan bằng cột SVG hiển thị số tiền thu học phí trong 6 tháng gần nhất.
*   **Phân loại dòng tiền tháng này**: Thống kê số tiền thu được theo Hình thức đóng (Tiền mặt / Chuyển khoản), theo Khối lớp (6-12), và theo Buổi học đăng ký (hệ thống tự chia đều số tiền đóng cho các buổi học đăng ký của học sinh).
*   **Chúc mừng sinh nhật**: Lọc danh sách học sinh có sinh nhật trong tháng hiện tại kèm nút **Chúc mừng**. Khi click vào nút này, hệ thống sẽ tự động soạn sẵn lời chúc mừng sinh nhật ý nghĩa và copy vào khay nhớ tạm (Clipboard), thầy chỉ cần dán (Paste) gửi cho phụ huynh/học sinh qua Zalo/SMS.

### 2.5. Điểm danh theo Buổi học & Lớp học
Thầy chọn tiểu tab **Buổi Học & Điểm Danh** trong Admin Portal:
*   Chọn buổi học tại dropdown (ví dụ: *Cơ sở 1 - Thứ 3*). Danh sách dropdown này tự động chứa các buổi học cố định từ lịch học `class.html` và quét tự động tất cả các buổi học linh hoạt mà thầy tự thêm cho học sinh.
*   Hệ thống lọc toàn bộ học sinh đăng ký buổi đó và hiển thị dạng các thẻ thông tin (Card) trực quan gồm: **Ảnh đại diện**, **Mã số**, **Tên**, **Khối lớp**, **Trường**, **SĐT liên hệ nhanh của bố/mẹ** (click để gọi ngay trên điện thoại), và **Thẻ trạng thái học phí tô màu**.
*   Thầy có thể quan sát nhanh để biết học sinh nào trong ca hôm nay chưa đóng tiền (thẻ đỏ) để nhắc nhở phụ huynh.

### 2.6. Khôi phục Dữ liệu từ bản Backup JSON (Restore)
Nếu muốn chuyển dữ liệu từ máy tính lên Google Sheet trống hoặc khôi phục lại dữ liệu cũ:
1. Vào tab **Cấu Hình** > Di chuyển xuống phần **Khôi phục Dữ liệu (Restore JSON)**.
2. Bấm **Chọn tệp Backup JSON** và chọn file backup `.json` thầy đã tải về máy từ trước.
3. Hệ thống sẽ kiểm tra cấu trúc tệp. Nếu hợp lệ, nút **Khôi Phục (Ghi đè)** sẽ sáng lên.
4. Bấm nút và xác nhận cảnh báo. Toàn bộ dữ liệu cũ trên Google Sheet sẽ được xóa sạch và thay thế bằng dữ liệu từ file backup.
