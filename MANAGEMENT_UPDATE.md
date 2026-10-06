# Cập nhật trang quản lý

## Cài bản nâng cấp lần đầu

1. Sao lưu dữ liệu bằng chức năng xuất backup và tạo một bản sao Google Sheet.
2. Trong Apps Script của Sheet, mở Project Settings → Script properties. Đặt `HNT_MASTER_PASSCODE` thành mật mã đang sử dụng. Có thể đặt riêng `HNT_MANAGER_PASSCODE` và `HNT_PUBLIC_SECRET`. Mã nguồn không còn mật mã mặc định; không lưu mật mã thật vào GitHub.
3. Thay mã Apps Script bằng nội dung `google_apps_script.js`. Lưu, chọn Deploy → Manage deployments → Edit → New version → Deploy. Giữ deployment hiện tại để URL `/exec` và liên kết phụ huynh tiếp tục hoạt động. Không chỉ bấm Save: web app chạy phiên bản đã triển khai.
4. Cập nhật `quanly.html` lên GitHub, tải lại trang trên máy tính và điện thoại. Đăng nhập lại nếu cần. Bản web mới chặn thao tác lưu khi backend chưa được nâng cấp.
5. Đồng bộ, thử một hồ sơ mẫu: đang học → tạm nghỉ → học lại. Chọn ngày có hiệu lực khi đổi trạng thái. Kiểm tra ngày nhập học giữ nguyên, lịch sử hiển thị và kỳ phí gợi ý bắt đầu từ ngày học lại (hoặc sau hạn phí đã đóng còn hiệu lực).

Tài liệu Google về cập nhật deployment: https://developers.google.com/apps-script/concepts/deployments

## Khi dùng hằng ngày

- Thanh kết nối hiển thị riêng số đang học, tạm nghỉ và tổng hồ sơ. Hồ sơ nghỉ được giữ để tra cứu; số đang học chỉ tính trạng thái Đang học.
- Đổi trạng thái trong Sửa thông tin học sinh. Không cần sửa ngày nhập học khi quay lại. Trạng thái áp dụng ngay nên ngày hiệu lực phải là hôm nay hoặc trước đó. Không tự động hẹn ngày học lại.
- Cột `tuition_start` được tự thêm cuối Sheet HocSinh; dữ liệu cũ dùng ngày nhập học khi cột này trống. Khoản phí cũ vẫn giữ nguyên. Đây là bắt đầu kỳ thu mới, không tự tính hoàn tiền hoặc chia phí theo số ngày nghỉ.
- Lịch sử nghỉ trước bản nâng cấp chưa có ngày thì cần bổ sung theo hồ sơ thực tế; phần mềm không suy đoán ngày đã nghỉ. Những lần học lại cũ từng ghi đè ngày nhập học cũng cần đối chiếu bản sao lưu để khôi phục.
- Mất mạng khi lưu: giữ nguyên form và nhóm học sinh rồi thử lại. Trình duyệt giữ mã yêu cầu, máy chủ trả lại kết quả cũ nếu đã ghi. Với nhóm, số tiền lẻ được phân vào học sinh chính để tổng giao dịch đúng tổng tiền thu.
- Sheet `YeuCauDongBo` lưu mã yêu cầu, dấu kiểm dữ liệu và kết quả. Không xóa sheet này: nó ngăn ghi lại khi mất phản hồi. Nếu một yêu cầu có kết quả trống sau khi Apps Script bị dừng giữa chừng, đồng bộ và đối chiếu các Sheet liên quan trước khi quyết định xử lý. Không xóa mã rồi gửi lại một cách tự động.
- Các dòng trùng đã tồn tại được giữ nguyên để đối chiếu; không tự xóa giao dịch tài chính.

## Cập nhật GitHub những lần sau

Chạy `node tools/check-management.cjs`, xem diff trong GitHub Desktop rồi commit các file đã sửa. Push sẽ chạy workflow kiểm tra. Giữ cấu hình GitHub Pages đang dùng; workflow này chỉ kiểm tra, không thay nguồn triển khai của toàn bộ website.

Backend được quản lý cùng mã web. File `.gitignore` bỏ qua `.env`, `.clasp.json`, workbook và bản backup; kiểm tra không đưa dữ liệu học sinh hoặc mật mã vào commit. File `.gitattributes` thống nhất xuống dòng để diff dễ đọc.

Mỗi khi sửa backend, phải cập nhật deployment Apps Script riêng. Push GitHub chỉ cập nhật phần website, không cập nhật code đang chạy trên Google.

Kiểm tra tự động mô phỏng Sheet, mất phản hồi và học lại; cần thử trên deployment Google thật sau khi cài. Chưa có kiểm thử mạng di động hoặc quota Apps Script thực tế trong bộ kiểm tra này.
