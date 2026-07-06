# Hướng Dẫn Thiết Lập & Sử Dụng Hệ Thống Quản Lý HNT Education (Phiên bản v2.7)

Tài liệu này hướng dẫn thầy Hoàng cách cài đặt và sử dụng các tính năng mới của phiên bản v2.7, bao gồm: **Tải ảnh đại diện trực tiếp lên Google Drive**, **Album ảnh nội bộ học sinh**, **Đổi mã học sinh tự động đồng bộ**, **Báo cáo tài chính chuyên sâu**, **Quản lý danh sách học sinh theo từng Ca/Buổi học để điểm danh**, **Chia sẻ thời khóa biểu public đã ẩn danh**, và **Khôi phục dữ liệu từ bản backup**.

---

## PHẦN 1: CẬP NHẬT GOOGLE APPS SCRIPT (v2.7)

Phiên bản v2.7 bổ sung nhiều cột thông tin mới, tính năng tải ảnh và cơ chế public view an toàn hơn, vì vậy thầy cần cập nhật mã code trên Google Sheets:

1. Mở file Google Sheet quản lý học sinh trên Google Drive của thầy.
2. Vào **Tiện ích mở rộng (Extensions)** > **Apps Script**.
3. Xóa toàn bộ code cũ và copy dán toàn bộ code mới từ file **[google_apps_script.js](google_apps_script.js)** vào trình soạn thảo.
4. Không nhập pass thật trực tiếp vào code. Vào **Project Settings** > **Script properties** và tạo 3 khóa: `HNT_MASTER_PASSCODE` (pass toàn quyền), `HNT_MANAGER_PASSCODE` (pass quản lý giới hạn, có thể để trống lúc đầu), `HNT_PUBLIC_SECRET` (secret ký link public).
5. Bấm nút **Lưu (Save)**.
6. Bấm **Triển khai (Deploy)** > **Quản lý các bản triển khai (Manage deployments)**.
7. Chọn bản triển khai hiện tại, bấm biểu tượng **Bút chì (Edit)**, chọn phiên bản mới: **Phiên bản mới (New version)**. Bấm **Triển khai (Deploy)**.
   *   *(Lưu ý: Việc tạo Phiên bản mới rất quan trọng để Google cập nhật code mới chạy trên cùng 1 liên kết URL Web App).*
   *   *Nếu là lần đầu tiên triển khai, hoặc nếu URL bị thay đổi, hãy copy lại URL ứng dụng web mới.*

---

## BẢO MẬT & PHÂN QUYỀN

Hệ thống dùng 3 lớp bí mật:

* `HNT_MASTER_PASSCODE`: pass toàn quyền, xem/sửa/xóa toàn bộ dữ liệu, restore backup, nâng niên khóa và quản lý các pass/quyền thấp hơn.
* `HNT_MANAGER_PASSCODE`: pass quản lý giới hạn. Master cấu hình quyền trong tab **Cấu Hình > Phân quyền & bảo mật**. Mặc định pass này được xem dữ liệu, thêm học sinh, nhập học phí, tải avatar; không được sửa/xóa học sinh, restore, nâng niên khóa, xem/sửa album riêng tư.
* `HNT_PUBLIC_SECRET`: secret riêng để ký token link public cho phụ huynh/lịch học. Secret này không phải pass đăng nhập và không cấp quyền quản trị.

Trang quản lý không lưu pass vào `localStorage`; sau khi đăng nhập, Apps Script trả về session token có hạn dùng. Nếu muốn xóa pass quản lý, đăng nhập bằng pass toàn quyền rồi nhập `DELETE` vào ô pass quản lý giới hạn và bấm lưu.

---

## PHẦN 2: HƯỚNG DẪN SỬ DỤNG CÁC TÍNH NĂNG MỚI (v2.7)

Thầy mở trang **[quanly.html](quanly.html)** trên trình duyệt để bắt đầu trải nghiệm các tính năng nâng cấp:

### 2.1. Đăng ký & Quản lý Ảnh đại diện (Avatar)
*   **Cách hoạt động**: Khi thêm hoặc sửa học sinh, thầy click vào hình tròn đại diện (mặc định hiện chữ cái đầu) để chọn ảnh từ máy tính hoặc điện thoại.
*   **Bảo mật & Lưu trữ**: Hệ thống tự động gửi ảnh này qua API bảo mật. Apps Script sẽ tự động tạo thư mục mang tên `HNT_Avatars` trên Google Drive của thầy, tải ảnh lên đó, thiết lập quyền xem công khai và lưu link ảnh trực tiếp vào Google Sheet. Thầy hoàn toàn không cần tốn chi phí thuê host ảnh bên ngoài.

### 2.2. Album Ảnh Nội Bộ (Internal Album) của Học Sinh (v2.7)
*   **Cách hoạt động**: Trong Modal Chi tiết học sinh, thầy click vào nút **"Thêm ảnh"** tại phần Album ảnh nội bộ. Hệ thống cho phép chọn một hoặc nhiều ảnh để tải trực tiếp từ thiết bị.
*   **Quản lý trên Drive**: Apps Script tự động gom nhóm, tạo thư mục con chứa ảnh của học sinh đó nằm trong thư mục `HNT_Albums` trên Google Drive của thầy. Link ảnh được đồng bộ và lưu trữ trực tiếp vào cột `notes` theo marker `===ALBUM===` kèm JSON danh sách ảnh.
*   **Xem ảnh linh hoạt**: Các ảnh được hiển thị dưới dạng lưới thumbnail tải theo từng đợt để nhẹ máy khi album lớn. Khi click vào ảnh, thầy có thể lướt qua lại bằng nút hoặc phím mũi tên, xem thumbnail lân cận, ghi chú riêng cho từng ảnh và chọn ảnh trong album làm avatar học sinh.

### 2.3. Nhập học phí Linh hoạt & Phân biệt các loại Ngày
*   **Phân biệt ngày**:
    *   **Ngày đóng tiền**: Ngày thực tế thầy nhận tiền (mặc định là hôm nay, nhưng cho phép chọn ngày khác để ghi nhận hồi tố các ngày trước).
    *   **Chu kỳ đóng phí (Từ ngày - Đến ngày)**: Ngày tính hạn học của học sinh. Mặc định hệ thống tự điền nối tiếp từ hạn cũ của học sinh đó.
*   **Quy ước màu học phí**: Sau ngày `paid_until`, hệ thống mở kỳ cần đóng kế tiếp dạng `Từ ngày -> Đến ngày` và hiển thị màu vàng trong toàn bộ kỳ này, để phù hợp cả phụ huynh đóng đầu kỳ lẫn cuối kỳ. Chỉ khi quá ngày cuối kỳ cần đóng mới chuyển màu đỏ/trễ hạn.
*   **Hình thức đóng**: Thầy có thể chọn nhanh hình thức **Chuyển khoản** hoặc **Tiền mặt** để phục vụ việc thống kê sổ sách.
*   **Thông tin lịch sử tức thời**: Khi thầy chọn một học sinh trong form nhập nhanh, panel bên phải sẽ hiện ngay tóm tắt 3 giao dịch đóng tiền gần đây nhất, giúp thầy đối chiếu số liệu đóng phí trước đó của bé chỉ trong 1 giây mà không cần vào bảng tra cứu.

### 2.4. Chỉnh sửa Mã học sinh (ID) & Đồng bộ Giao dịch
*   Khi sửa hồ sơ học sinh, ô nhập **Mã học sinh** sẽ được mở để thầy tự gõ thay đổi (ví dụ xếp theo khối, chọn số đẹp...).
*   **Đồng bộ tự động**: Khi phát hiện mã học sinh bị thay đổi, hệ thống sẽ tự động cập nhật mã mới vào hồ sơ học sinh, đồng thời quét toàn bộ bảng lịch sử đóng phí và đổi mã học sinh cũ sang mã mới cho toàn bộ các giao dịch trước đó, tránh việc mất liên kết dữ liệu cũ.

### 2.5. Dashboard Báo cáo Tài chính & Sinh nhật
Admin Portal được tích hợp tiểu tab **Báo Cáo & Thống Kê**:
*   **Biểu đồ doanh thu**: Vẽ trực quan bằng cột SVG hiển thị số tiền thu học phí trong 6 tháng gần nhất.
*   **Phân loại dòng tiền tháng này**: Thống kê số tiền thu được theo Hình thức đóng (Tiền mặt / Chuyển khoản), theo Khối lớp (6-12), và theo Buổi học đăng ký (hệ thống tự chia đều số tiền đóng cho các buổi học đăng ký của học sinh).
*   **Chúc mừng sinh nhật**: Lọc danh sách học sinh có sinh nhật trong tháng hiện tại kèm nút **Chúc mừng**. Khi click vào nút này, hệ thống sẽ tự động soạn sẵn lời chúc mừng sinh nhật ý nghĩa và copy vào khay nhớ tạm (Clipboard), thầy chỉ cần dán (Paste) gửi cho phụ huynh/học sinh qua Zalo/SMS.

### 2.6. Điểm danh theo Buổi học & Lớp học (Đồng bộ học phí & giới tính)
Thầy chọn tiểu tab **Buổi Học & Điểm Danh** trong Admin Portal:
*   Chọn buổi học tại dropdown (ví dụ: *Cơ sở 1 - Thứ 3*). Danh sách dropdown này tự động chứa các buổi học cố định từ lịch học `class.html` và quét tự động tất cả các buổi học linh hoạt mà thầy tự thêm cho học sinh.
*   **Gom nhóm Khối + Trường học**: Học sinh được gom nhóm gọn gàng để thầy tiện thống kê sĩ số.
*   **Cảnh báo học phí chi tiết**:
    *   Mỗi học sinh được gắn chấm màu trạng thái học phí: 🟢 Đã đóng, 🟡 Chưa đóng tháng này, 🔴 Trễ hạn.
    *   Hiển thị chi tiết Ngày nhập học, Hạn đóng tiếp theo, và thông tin Kỳ đóng gần nhất (Chu kỳ và Ngày thực đóng).
*   **Biểu tượng giới tính Mars/Venus**:
    *   Học sinh Nữ sẽ hiển thị biểu tượng Venus hồng (♀).
    *   Học sinh Nam sẽ hiển thị biểu tượng Mars xanh dương (♂).
*   **Bảng Giao dịch gần nhất trong ca học**: Đã được nâng cấp lên 6 cột chi tiết đồng bộ (`Học sinh` | `Số tiền` | `Ngày đóng` | `Chu kỳ đóng` | `Hình thức` | `Ghi chú`).
*   **Chế độ chia sẻ Public**:
    *   Tự động ẩn danh tên học sinh (dạng viết tắt: `Nguyễn V. A.`).
    *   Ẩn hoàn toàn hạn đóng tiếp theo, nợ phí, hay các cảnh báo học phí. Chỉ hiển thị thông tin đóng phí gần nhất của em đó (không hiển thị nợ nần) để tôn trọng tính riêng tư.
    *   Link động public không chứa passcode quản trị; dữ liệu lịch public được lấy qua action riêng chỉ trả về thông tin đã ẩn danh. Link cũng kèm snapshot dự phòng đã ẩn danh để vẫn hiển thị đủ tên viết tắt và kỳ đóng gần nhất nếu backend chưa kịp deploy bản mới.

### 2.7. Chi tiết Lịch sử đóng phí trong Hồ sơ học sinh
*   Khi click vào tên học sinh trong tab Quản lý học sinh, modal chi tiết sẽ hiện lên.
*   Bảng **"Chi tiết lịch sử đóng phí"** ở dưới cùng hiển thị đầy đủ lịch sử đóng phí từ trước đến nay của em đó, gồm 5 cột: `Ngày đóng` | `Số tiền` | `Chu kỳ đóng` | `Hình thức` | `Ghi chú`.

### 2.8. Khôi phục Dữ liệu từ bản Backup JSON (Restore)
Nếu muốn chuyển dữ liệu từ máy tính lên Google Sheet trống hoặc khôi phục lại dữ liệu cũ:
1. Vào tab **Cấu Hình** > Di chuyển xuống phần **Khôi phục Dữ liệu (Restore JSON)**.
2. Bấm **Chọn tệp Backup JSON** và chọn file backup `.json` thầy đã tải về máy từ trước.
3. Hệ thống sẽ kiểm tra cấu trúc tệp. Nếu hợp lệ, nút **Khôi Phục (Ghi đè)** sẽ sáng lên.
4. Bấm nút và xác nhận cảnh báo. Toàn bộ dữ liệu cũ trên Google Sheet sẽ được xóa sạch và thay thế bằng dữ liệu từ file backup.
