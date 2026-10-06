# Cập nhật trang quản lý

## Cài bản nâng cấp lần đầu

1. Sao lưu dữ liệu bằng chức năng xuất backup và tạo một bản sao Google Sheet.
2. Trong Apps Script của Sheet, mở Project Settings → Script properties. Đặt `HNT_MASTER_PASSCODE` thành mật mã đang sử dụng. Có thể đặt riêng `HNT_MANAGER_PASSCODE` và `HNT_PUBLIC_SECRET`. Mã nguồn không còn mật mã mặc định; không lưu mật mã thật vào GitHub.
3. Thay mã Apps Script bằng nội dung `google_apps_script.js`. Lưu, chọn Deploy → Manage deployments → Edit → New version → Deploy. Giữ deployment hiện tại để URL `/exec` và liên kết phụ huynh tiếp tục hoạt động. Không chỉ bấm Save: web app chạy phiên bản đã triển khai.
4. Cập nhật `quanly.html` lên GitHub, tải lại trang trên máy tính và điện thoại. Đăng nhập lại nếu cần. Bản web mới chặn thao tác lưu khi backend chưa được nâng cấp.
5. Đồng bộ, thử một hồ sơ mẫu: đang học → tạm nghỉ → học lại. Chọn ngày có hiệu lực khi đổi trạng thái. Kiểm tra ngày nhập học giữ nguyên, lịch sử hiển thị và kỳ phí gợi ý bắt đầu từ ngày học lại (hoặc sau hạn phí đã đóng còn hiệu lực).

Tài liệu Google về cập nhật deployment: https://developers.google.com/apps-script/concepts/deployments

## Khi dùng hằng ngày

- Mức phí `0` hoặc `0đ` trong form nghĩa là miễn học phí. Học sinh vẫn thuộc số đang học, nhưng không tạo nhắc phí, báo trễ hạn hay doanh thu học phí dự kiến. Giao dịch cũ vẫn được giữ.
- Đổi mức phí trong Sửa thông tin học sinh và chọn ngày áp dụng. Khi đổi từ 0đ sang số dương, kỳ thu bắt đầu từ ngày đó (hoặc ngày học lại nếu học lại muộn hơn), không tính truy thu thời gian miễn phí. Ngày nhập học không bị sửa. Không hỗ trợ lên lịch đổi phí cho ngày tương lai.
- Lịch sử có dấu vết từng lần đổi mức phí; các tháng miễn phí được hiển thị riêng kể cả sau khi bắt đầu thu phí. Tháng đổi mức phí giữa tháng có thể có cả thời gian miễn và có phí; hệ thống không tự chia tiền theo ngày.
- Doanh thu lý thuyết là ước tính dùng mức phí hiện tại và các tháng từ ngày bắt đầu tính phí hiện tại, không phải sổ công nợ lịch sử. Báo cáo doanh thu thực thu vẫn dùng các giao dịch thực tế.

- Thanh kết nối hiển thị riêng số đang học, tạm nghỉ và tổng hồ sơ. Hồ sơ nghỉ được giữ để tra cứu; số đang học chỉ tính trạng thái Đang học.
- Đổi trạng thái trong Sửa thông tin học sinh. Không cần sửa ngày nhập học khi quay lại. Trạng thái áp dụng ngay nên ngày hiệu lực phải là hôm nay hoặc trước đó. Không tự động hẹn ngày học lại.
- Cột `tuition_start` được tự thêm cuối Sheet HocSinh; dữ liệu cũ dùng ngày nhập học khi cột này trống. Khoản phí cũ vẫn giữ nguyên. Đây là bắt đầu kỳ thu mới, không tự tính hoàn tiền hoặc chia phí theo số ngày nghỉ.
- Lịch sử nghỉ trước bản nâng cấp chưa có ngày thì cần bổ sung theo hồ sơ thực tế; phần mềm không suy đoán ngày đã nghỉ. Những lần học lại cũ từng ghi đè ngày nhập học cũng cần đối chiếu bản sao lưu để khôi phục.
- Mất mạng khi lưu: giữ nguyên form và nhóm học sinh rồi thử lại. Trình duyệt giữ mã yêu cầu, máy chủ trả lại kết quả cũ nếu đã ghi. Với nhóm, số tiền lẻ được phân vào học sinh chính để tổng giao dịch đúng tổng tiền thu.
- Sheet `YeuCauDongBo` lưu mã yêu cầu, dấu kiểm dữ liệu và kết quả. Không xóa sheet này: nó ngăn ghi lại khi mất phản hồi. Nếu một yêu cầu có kết quả trống sau khi Apps Script bị dừng giữa chừng, đồng bộ và đối chiếu các Sheet liên quan trước khi quyết định xử lý. Không xóa mã rồi gửi lại một cách tự động.
- Các dòng trùng đã tồn tại được giữ nguyên để đối chiếu; không tự xóa giao dịch tài chính.

## Cập nhật GitHub những lần sau

Chạy `node tools/check-management.cjs --web-only`, xem diff trong GitHub Desktop rồi commit các file web đã sửa. Push sẽ chạy workflow kiểm tra phần web, không cần file Apps Script. Giữ cấu hình GitHub Pages đang dùng; workflow này chỉ kiểm tra, không thay nguồn triển khai của toàn bộ website.

Backend `google_apps_script.js` giữ riêng trên máy và triển khai riêng lên Google, không đồng bộ lên GitHub. File `.gitignore` bỏ qua backend, `.env`, `.clasp.json`, workbook và bản backup. File `.gitattributes` thống nhất xuống dòng để diff dễ đọc. Nếu backend từng được Git theo dõi, thao tác bỏ theo dõi sẽ xuất hiện là xóa file trong commit tiếp theo; file trên máy vẫn giữ nguyên.

Mỗi khi sửa backend, phải cập nhật deployment Apps Script riêng. Push GitHub chỉ cập nhật phần website, không cập nhật code đang chạy trên Google.

Kiểm tra tự động mô phỏng Sheet, mất phản hồi và học lại; cần thử trên deployment Google thật sau khi cài. Chưa có kiểm thử mạng di động hoặc quota Apps Script thực tế trong bộ kiểm tra này.

Bản ghi chú và chi tiết giao dịch yêu cầu backend giao thức 5. Cập nhật cả Apps Script cục bộ và website rồi tải lại trang. Backend vẫn triển khai riêng, không đưa lên GitHub.

## Ghi chú và thu gộp nhiều kỳ / nhiều người

- Gợi ý ghi chú luôn theo tháng/năm, liệt kê các tháng dương lịch có trong khoảng thu. Ví dụ: “Đóng học phí tháng 2/2026, 3/2026 (tháng 3/2026: 01/03/2026–15/03/2026)”. Tháng lẻ ghi rõ khoảng ngày; kỳ qua năm ghi đúng năm của từng tháng. Đổi số tháng hoặc hạn cuối sẽ cập nhật gợi ý. Ghi chú đã sửa tay được giữ; nút “Dùng ghi chú gợi ý” cho phép thay lại khi muốn.
- Tiến trình tháng dùng ngày thực tế của các giao dịch: xanh “Đã đóng” khi các giao dịch bao phủ toàn bộ ngày có phí trong tháng; vàng “Đóng một phần” khi chỉ bao phủ một phần. Có thể cộng nhiều giao dịch để hoàn tất một tháng. Ngày chưa nhập học, nghỉ hoặc miễn phí theo lịch sử không được tính là ngày còn thiếu. Ghi chú là nhãn dễ đọc; không phân tích câu chữ trong ghi chú để tính tiến trình.
- 1,5 tháng được hiểu là một tháng rồi thêm 15 ngày. Cộng tháng xử lý ngày 29–31 và năm nhuận, không để ngày tràn ngoài tháng đích. Kỳ thu tính cả ngày đầu và ngày cuối, nên ngày cuối là ngày trước mốc bắt đầu kỳ tiếp theo.
- Gợi ý tiền theo mức phí từng học sinh và độ dài kỳ: chu kỳ 1,5 tháng gợi ý 1,5 lần mức tháng; khoảng tùy chọn dùng tỷ lệ số ngày trên độ dài kỳ tháng tương ứng. Đây là gợi ý phân bổ, không phải quy định hoàn tiền hoặc giảm học phí tự động. Có thể nhập tổng tiền khác hoặc sửa riêng từng học sinh trong bảng xem trước.
- Khi gộp người, từng em dùng kỳ chưa đóng riêng theo hạn phí/ngày học lại của mình; không áp chung ngày của học sinh chính. Tiền tổng nhập tay phân bổ theo tỷ lệ mức phí và độ dài kỳ. Tiền lẻ được phân bổ chính xác để tổng các dòng luôn bằng tổng tiền thu. Nhắc phí chỉ lấy khoản của học sinh chính, không lấy toàn bộ tiền nhóm.
- Mỗi học sinh có **một giao dịch thu riêng**, cùng mã đợt thu `group_id`. Cột `period_breakdown` lưu các kỳ tháng liên tiếp và kỳ lẻ với ngày, số ngày và tiền riêng; tổng chi tiết bằng tiền giao dịch. Không tạo thêm nhiều giao dịch tiền thật cho cùng một khoản thu, tránh cộng doanh thu nhiều lần. Lịch sử giao dịch và báo cáo phụ huynh có nút mở chi tiết từng kỳ.
- Với học sinh tạm nghỉ có ngày nghỉ, gợi ý chỉ đến ngày trước khi nghỉ nếu còn khoản chưa đóng. Kỳ giao với thời gian nghỉ hoặc miễn phí bị chặn, cần chọn riêng khoảng thực học/có phí. Học lại dùng ngày bắt đầu tính phí đã ghi nhận. Nghỉ chưa có ngày thì cần cập nhật lịch sử trước khi thu.
- Máy chủ kiểm tra toàn bộ nhóm trước khi ghi, rồi ghi các giao dịch thành một khối. Cập nhật hạn phí là bước tiếp theo; Apps Script bị dừng giữa chừng vẫn cần đối chiếu, không được coi đây là giao dịch cơ sở dữ liệu có khả năng tự hoàn tác.
- Khoản thu chưa xác nhận được lưu trên máy theo tài khoản và URL API. Sau khi tải lại trang, dùng “Kiểm tra / gửi lại cùng yêu cầu” để giữ nguyên dữ liệu và mã chống lặp. Yêu cầu chờ chặn tạo khoản mới; chỉ bỏ yêu cầu chờ sau khi đối chiếu Sheet.
- Giao dịch cho một kỳ ở xa được giữ riêng nhưng không kéo hạn “đã đóng đến” qua khoảng chưa đóng. Khi khoảng hở được đóng bổ sung, hạn phí nối tiếp các khoản đã đóng trước. Hạn phí cũ đã tồn tại không tự sửa lại.
- Dữ liệu cũ vẫn đọc được; không tự phân bổ lại giao dịch lịch sử vì thiếu thông tin về cách chia tiền lúc thu.

Để kiểm tra đầy đủ cả backend cục bộ và web trên máy, chạy `node tools/check-management.cjs`. Kiểm tra này mô phỏng Apps Script; không triển khai mã hoặc ghi vào Google Sheet thật. Backend cục bộ không bị kiểm tra mật mã bởi GitHub CI vì không nằm trong repo.
