/**
 * GOOGLE APPS SCRIPT BACKEND API FOR HNT EDUCATION (Phiên bản v2.1)
 * 
 * HƯỚNG DẪN THIẾT LẬP:
 * 1. Mở một Google Sheet mới hoặc có sẵn trên Google Drive của bạn.
 * 2. Vào Extensions (Tiện ích mở rộng) > Apps Script.
 * 3. Xóa mọi code có sẵn và dán toàn bộ đoạn code dưới đây vào.
 * 4. Thay đổi biến PASSCODE ở dưới thành mật mã bảo mật của bạn.
 * 5. Bấm nút Deploy (Triển khai) > New deployment (Triển khai mới).
 *    - Chọn loại triển khai: Web app (Ứng dụng web).
 *    - Execute as (Trình thực thi): Me (email_cua_ban@gmail.com).
 *    - Who has access (Ai có quyền truy cập): Anyone (Mọi người).
 * 6. Copy URL của Web App thu được và dán vào cấu hình trên web quản lý.
 */

// ĐỊNH NGHĨA MẬT MÃ BẢO MẬT (Hãy đổi mật mã này và giữ bí mật)
var PASSCODE = "HNT@2026"; 

// Khai báo tiêu đề cột của 2 trang tính (Sheets)
var STUDENT_HEADERS = [
  "id", "name", "birth_date", "gender", "school", 
  "grade", "class_school", "campuses_sessions", 
  "registration_date", "status", "tuition_rate", "paid_until", 
  "notes", "father_name", "father_phone", "mother_name", "mother_phone", 
  "social_links", "avatar_url"
];

var PAYMENT_HEADERS = [
  "payment_id", "student_id", "student_name", "amount", 
  "payment_date", "period_start", "period_end", "payment_method", "note"
];

function doGet(e) {
  return handleRequest(e, "GET");
}

function doPost(e) {
  return handleRequest(e, "POST");
}

function handleRequest(e, method) {
  // CORS setup
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  
  if (method === "OPTIONS" || (e && e.parameter && e.parameter.method === "OPTIONS")) {
    return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT);
  }

  try {
    var params = {};
    if (method === "GET") {
      params = e.parameter;
    } else {
      if (e.postData && e.postData.contents) {
        params = JSON.parse(e.postData.contents);
      }
    }
    
    var action = params.action;
    var isPublicAction = (action === "getPublicReport" || action === "getPublicSchedule");
    
    // 1. Xác thực Passcode (Bỏ qua nếu là public action)
    var clientPasscode = params.passcode;
    if (!isPublicAction && (!clientPasscode || clientPasscode !== PASSCODE)) {
      return createJSONResponse({
        success: false,
        error: "Unauthorized: Mật mã truy cập không chính xác."
      }, 403);
    }
    
    var result = {};
    
    // Tự động tạo các sheet / bổ sung các cột mới nếu thiếu
    initSheets();
    
    // 2. Phân tuyến Action
    if (action === "login") {
      result = { success: true, message: "Đăng nhập thành công." };
    } else if (action === "getPublicReport") {
      result = getPublicReport(params.studentId, params.token);
    } else if (action === "getPublicSchedule") {
      result = getPublicSchedule();
    } else if (action === "getData") {
      result = getData();
    } else if (action === "addStudent") {
      result = addStudent(params.studentData);
    } else if (action === "updateStudent") {
      result = updateStudent(params.studentId, params.studentData);
    } else if (action === "deleteStudent") {
      result = deleteStudent(params.studentId);
    } else if (action === "addPayment") {
      result = addPayment(params.paymentData);
    } else if (action === "massGradeUp") {
      result = massGradeUp();
    } else if (action === "uploadAvatar") {
      result = uploadAvatar(params.avatarData);
    } else if (action === "restoreBackup") {
      result = restoreBackup(params.backupData);
    } else {
      result = { success: false, error: "Action không hợp lệ: " + action };
    }
    
    return createJSONResponse(result, 200);
      
  } catch (err) {
    return createJSONResponse({
      success: false,
      error: "Lỗi hệ thống Apps Script: " + err.toString()
    }, 500);
  }
}

function createJSONResponse(data, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// Khởi tạo các Sheet và tiêu đề nếu chưa có (Hoặc bổ sung cột mới nếu có cập nhật v2)
function initSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("Không thể liên kết với bảng tính Google Sheet. Đảm bảo thầy tạo Apps Script bằng cách vào Extensions > Apps Script từ bên trong Google Sheet.");
  }
  
  // 1. Sheet HocSinh
  var studentSheet = ss.getSheetByName("HocSinh");
  if (!studentSheet) {
    studentSheet = ss.insertSheet("HocSinh");
    studentSheet.appendRow(STUDENT_HEADERS);
    studentSheet.getRange(1, 1, 1, STUDENT_HEADERS.length)
      .setFontWeight("bold")
      .setBackground("#d1e7dd");
  } else {
    // Kiểm tra nếu thiếu các cột v2 thì bổ sung vào cuối tiêu đề
    var lastCol = studentSheet.getLastColumn();
    var currentHeaders = [];
    if (lastCol > 0) {
      currentHeaders = studentSheet.getRange(1, 1, 1, lastCol).getValues()[0];
    }
    for (var i = 0; i < STUDENT_HEADERS.length; i++) {
      var headerName = STUDENT_HEADERS[i];
      if (currentHeaders.indexOf(headerName) === -1) {
        var nextCol = studentSheet.getLastColumn() + 1;
        studentSheet.getRange(1, nextCol).setValue(headerName)
          .setFontWeight("bold")
          .setBackground("#d1e7dd");
        currentHeaders.push(headerName);
      }
    }
  }
  
  // 2. Sheet HocPhi
  var paymentSheet = ss.getSheetByName("HocPhi");
  if (!paymentSheet) {
    paymentSheet = ss.insertSheet("HocPhi");
    paymentSheet.appendRow(PAYMENT_HEADERS);
    paymentSheet.getRange(1, 1, 1, PAYMENT_HEADERS.length)
      .setFontWeight("bold")
      .setBackground("#cfe2ff");
  } else {
    // Kiểm tra thiếu cột v2
    var lastPayCol = paymentSheet.getLastColumn();
    var currentPayHeaders = [];
    if (lastPayCol > 0) {
      currentPayHeaders = paymentSheet.getRange(1, 1, 1, lastPayCol).getValues()[0];
    }
    for (var j = 0; j < PAYMENT_HEADERS.length; j++) {
      var payHeaderName = PAYMENT_HEADERS[j];
      if (currentPayHeaders.indexOf(payHeaderName) === -1) {
        var nextPayCol = paymentSheet.getLastColumn() + 1;
        paymentSheet.getRange(1, nextPayCol).setValue(payHeaderName)
          .setFontWeight("bold")
          .setBackground("#cfe2ff");
        currentPayHeaders.push(payHeaderName);
      }
    }
  }
}

// 1. LẤY TOÀN BỘ DỮ LIỆU
function getData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var studentSheet = ss.getSheetByName("HocSinh");
  var paymentSheet = ss.getSheetByName("HocPhi");
  
  var students = getSheetRowsAsObjects(studentSheet, STUDENT_HEADERS);
  var payments = getSheetRowsAsObjects(paymentSheet, PAYMENT_HEADERS);
  
  return {
    success: true,
    students: students,
    payments: payments
  };
}

function getSheetRowsAsObjects(sheet, headers) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var result = [];
  
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var obj = {};
    var isEmpty = true;
    
    for (var j = 0; j < headers.length; j++) {
      var val = row[j];
      if (val instanceof Date) {
        val = formatDate(val);
      }
      obj[headers[j]] = val;
      if (val !== "") {
        isEmpty = false;
      }
    }
    
    if (!isEmpty) {
      result.push(obj);
    }
  }
  return result;
}

// 2. THÊM HỌC SINH MỚI & TỰ SINH MÃ (ID)
function addStudent(studentData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("HocSinh");
  
  // Trích xuất năm sinh từ ngày sinh birth_date (Định dạng: YYYY-MM-DD)
  var birthYear = 2011; 
  if (studentData.birth_date && studentData.birth_date.indexOf("-") > -1) {
    birthYear = parseInt(studentData.birth_date.split("-")[0]);
  } else if (studentData.birth_year) {
    birthYear = parseInt(studentData.birth_year);
  }
  var gender = studentData.gender === "Nữ" ? 1 : 0; 
  
  // Tự sinh ID
  var nextId = generateNextStudentId(sheet, birthYear, gender);
  studentData.id = nextId;
  
  var rowValues = [];
  for (var i = 0; i < STUDENT_HEADERS.length; i++) {
    var key = STUDENT_HEADERS[i];
    var val = studentData[key] !== undefined ? studentData[key] : "";
    rowValues.push(val);
  }
  
  sheet.appendRow(rowValues);
  
  return {
    success: true,
    message: "Thêm học sinh mới thành công.",
    student: studentData
  };
}

function generateNextStudentId(sheet, birthYear, gender) {
  var lastRow = sheet.getLastRow();
  var prefix = birthYear.toString() + gender.toString(); // e.g., 20110 hoặc 20111
  
  var maxSeq = 0;
  if (lastRow > 1) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      var idStr = ids[i][0].toString();
      if (idStr.indexOf(prefix) === 0 && idStr.length === 8) {
        var seqPart = idStr.substring(5);
        var seqNum = parseInt(seqPart, 10);
        if (seqNum > maxSeq) {
          maxSeq = seqNum;
        }
      }
    }
  }
  
  var nextSeq = maxSeq + 1;
  var seqStr = nextSeq.toString();
  while (seqStr.length < 3) {
    seqStr = "0" + seqStr;
  }
  
  return prefix + seqStr;
}

// 3. CẬP NHẬT THÔNG TIN HỌC SINH (HỖ TRỢ ĐỔI MÃ HS & ĐỒNG BỘ GIAO DỊCH)
function updateStudent(studentId, studentData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("HocSinh");
  var lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) {
    return { success: false, error: "Không tìm thấy học sinh." };
  }
  
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var rowIndex = -1;
  
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0].toString() === studentId.toString()) {
      rowIndex = i + 2; 
      break;
    }
  }
  
  if (rowIndex === -1) {
    return { success: false, error: "Không tìm thấy học sinh có mã cũ: " + studentId };
  }
  
  var newId = studentData.id ? studentData.id.toString().trim() : '';
  
  // A. Trường hợp Thay đổi mã học sinh
  if (newId && newId !== studentId.toString()) {
    // Kiểm tra xem mã mới có bị trùng với học sinh khác không
    for (var k = 0; k < ids.length; k++) {
      if (ids[k][0].toString() === newId && (k + 2) !== rowIndex) {
        return { success: false, error: "Mã học sinh mới " + newId + " đã bị trùng với một học sinh khác!" };
      }
    }
    
    // Đồng bộ mã học sinh mới sang tất cả lịch sử đóng học phí ở sheet HocPhi
    syncStudentIdInPayments(studentId, newId);
  }
  
  // B. Cập nhật tất cả các cột của Học sinh (Tối ưu hóa: Đọc và ghi toàn bộ hàng trong 1 cuộc gọi)
  var currentValues = sheet.getRange(rowIndex, 1, 1, STUDENT_HEADERS.length).getValues()[0];
  var newRowValues = [];
  for (var j = 0; j < STUDENT_HEADERS.length; j++) {
    var key = STUDENT_HEADERS[j];
    if (studentData[key] !== undefined) {
      newRowValues.push(studentData[key]);
    } else {
      newRowValues.push(currentValues[j]);
    }
  }
  sheet.getRange(rowIndex, 1, 1, STUDENT_HEADERS.length).setValues([newRowValues]);
  
  return {
    success: true,
    message: "Cập nhật thông tin học sinh và đồng bộ mã giao dịch thành công."
  };
}

// Đồng bộ mã học sinh ở sheet HocPhi
function syncStudentIdInPayments(oldId, newId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("HocPhi");
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  
  var colStudentId = 2; 
  var ids = sheet.getRange(2, colStudentId, lastRow - 1, 1).getValues();
  
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0].toString() === oldId.toString()) {
      sheet.getRange(i + 2, colStudentId).setValue(newId.toString());
    }
  }
}

// 4. NHẬP HỌC PHÍ & GIA HẠN THỜI HẠN DỮ LIỆU
function addPayment(paymentData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var paymentSheet = ss.getSheetByName("HocPhi");
  var studentSheet = ss.getSheetByName("HocSinh");
  
  // Sinh mã giao dịch mới
  var lastPayRow = paymentSheet.getLastRow();
  var nextPayId = 10001;
  if (lastPayRow > 1) {
    var lastId = paymentSheet.getRange(lastPayRow, 1).getValue();
    if (!isNaN(lastId)) {
      nextPayId = parseInt(lastId) + 1;
    } else {
      nextPayId = lastPayRow + 10000;
    }
  }
  paymentData.payment_id = nextPayId;
  
  // Ghi nhận vào bảng HocPhi
  var rowValues = [];
  for (var i = 0; i < PAYMENT_HEADERS.length; i++) {
    var key = PAYMENT_HEADERS[i];
    var val = paymentData[key] !== undefined ? paymentData[key] : "";
    rowValues.push(val);
  }
  paymentSheet.appendRow(rowValues);
  
  // Cập nhật trường `paid_until` ở sheet HocSinh
  var studentId = paymentData.student_id;
  var lastStudRow = studentSheet.getLastRow();
  if (lastStudRow > 1) {
    var ids = studentSheet.getRange(2, 1, lastStudRow - 1, 1).getValues();
    var studRowIndex = -1;
    for (var k = 0; k < ids.length; k++) {
      if (ids[k][0].toString() === studentId.toString()) {
        studRowIndex = k + 2;
        break;
      }
    }
    
    if (studRowIndex !== -1) {
      var colPaidUntil = STUDENT_HEADERS.indexOf("paid_until") + 1;
      studentSheet.getRange(studRowIndex, colPaidUntil).setValue(paymentData.period_end);
    }
  }
  
  return {
    success: true,
    message: "Ghi nhận học phí thành công.",
    payment_id: nextPayId
  };
}

// 5. CHUYỂN NIÊN KHÓA HÀNG LOẠT
function massGradeUp() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("HocSinh");
  var lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) {
    return { success: false, error: "Không có học sinh để thực hiện." };
  }
  
  var colGrade = STUDENT_HEADERS.indexOf("grade") + 1;
  var colStatus = STUDENT_HEADERS.indexOf("status") + 1;
  var colNotes = STUDENT_HEADERS.indexOf("notes") + 1;
  
  var grades = sheet.getRange(2, colGrade, lastRow - 1, 1).getValues();
  var statuses = sheet.getRange(2, colStatus, lastRow - 1, 1).getValues();
  
  var countUp = 0;
  var countGrad = 0;
  
  for (var i = 0; i < grades.length; i++) {
    var rowNum = i + 2;
    var currentStatus = statuses[i][0];
    
    if (currentStatus === "Đang học") {
      var currentGrade = parseInt(grades[i][0]);
      if (!isNaN(currentGrade)) {
        if (currentGrade >= 12) {
          // Lớp 12 tốt nghiệp -> chuyển trạng thái thành Nghỉ luôn
          sheet.getRange(rowNum, colStatus).setValue("Nghỉ luôn");
          sheet.getRange(rowNum, colNotes).setValue("Tự động chuyển tốt nghiệp niên khóa cũ");
          countGrad++;
        } else {
          // Dưới lớp 12 -> lên lớp 1
          sheet.getRange(rowNum, colGrade).setValue(currentGrade + 1);
          countUp++;
        }
      }
    }
  }
  
  return {
    success: true,
    message: "Chuyển niên khóa thành công! Lên lớp cho " + countUp + " học sinh; Đã nghỉ (Tốt nghiệp lớp 12) cho " + countGrad + " học sinh."
  };
}

// 6. TẢI ẢNH ĐẠI DIỆN LÊN GOOGLE DRIVE
function uploadAvatar(avatarData) {
  try {
    var base64String = avatarData.base64Data.split(",")[1];
    var decoded = Utilities.base64Decode(base64String);
    var blob = Utilities.newBlob(decoded, avatarData.mimeType, avatarData.filename);
    
    var folderName = "HNT_Avatars";
    var folder;
    
    // Sử dụng try-catch lồng nhau phòng trường hợp lỗi phân quyền Drive
    try {
      var folders = DriveApp.getFoldersByName(folderName);
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder(folderName);
      }
    } catch(folderErr) {
      Logger.log("Không thể tạo folder riêng, lưu tạm vào Drive Root: " + folderErr.toString());
      folder = DriveApp.getRootFolder();
    }
    
    var file = folder.createFile(blob);
    
    // Cố gắng chia sẻ public link, nếu tài khoản Google Workspace chặn thì bỏ qua vẫn lấy link
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch(shareErr) {
      Logger.log("Không thể bật chia sẻ: " + shareErr.toString());
    }
    
    var url = "https://lh3.googleusercontent.com/d/" + file.getId();
    
    return {
      success: true,
      url: url,
      fileId: file.getId()
    };
  } catch (err) {
    return {
      success: false,
      error: "Lỗi tải ảnh lên Google Drive: " + err.toString()
    };
  }
}

// 7. KHÔI PHỤC DỮ LIỆU ĐÈ TỪ FILE BACKUP JSON
function restoreBackup(backupData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var studentSheet = ss.getSheetByName("HocSinh");
  var paymentSheet = ss.getSheetByName("HocPhi");
  
  if (studentSheet.getLastRow() > 1) {
    studentSheet.deleteRows(2, studentSheet.getLastRow() - 1);
  }
  if (paymentSheet.getLastRow() > 1) {
    paymentSheet.deleteRows(2, paymentSheet.getLastRow() - 1);
  }
  
  var students = backupData.students || [];
  var payments = backupData.payments || [];
  
  for (var i = 0; i < students.length; i++) {
    var s = students[i];
    var row = [];
    for (var j = 0; j < STUDENT_HEADERS.length; j++) {
      var key = STUDENT_HEADERS[j];
      row.push(s[key] !== undefined ? s[key] : "");
    }
    studentSheet.appendRow(row);
  }
  
  for (var k = 0; k < payments.length; k++) {
    var p = payments[k];
    var rowPay = [];
    for (var m = 0; m < PAYMENT_HEADERS.length; m++) {
      var keyPay = PAYMENT_HEADERS[m];
      rowPay.push(p[keyPay] !== undefined ? p[keyPay] : "");
    }
    paymentSheet.appendRow(rowPay);
  }
  
  return {
    success: true,
    message: "Khôi phục dữ liệu thành công! Đã phục hồi " + students.length + " học sinh và " + payments.length + " giao dịch đóng học phí."
  };
}

// XÓA HỌC SINH & LỊCH SỬ HỌC PHÍ LIÊN QUAN
function deleteStudent(studentId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var studentSheet = ss.getSheetByName("HocSinh");
  var lastRow = studentSheet.getLastRow();
  
  if (lastRow <= 1) {
    return { success: false, error: "Không tìm thấy học sinh để xóa." };
  }
  
  var ids = studentSheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var rowIndex = -1;
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0].toString() === studentId.toString()) {
      rowIndex = i + 2;
      break;
    }
  }
  
  if (rowIndex === -1) {
    return { success: false, error: "Không tìm thấy học sinh với mã: " + studentId };
  }
  
  // Xóa hàng học sinh
  studentSheet.deleteRow(rowIndex);
  
  // Xóa cả học phí liên quan đến học sinh này
  var paymentSheet = ss.getSheetByName("HocPhi");
  var lastPayRow = paymentSheet.getLastRow();
  if (lastPayRow > 1) {
    var payIds = paymentSheet.getRange(2, 2, lastPayRow - 1, 1).getValues(); // student_id ở cột 2
    // Duyệt ngược từ dưới lên để chỉ số hàng không bị dịch chuyển khi xóa
    for (var j = payIds.length - 1; j >= 0; j--) {
      if (payIds[j][0].toString() === studentId.toString()) {
        paymentSheet.deleteRow(j + 2);
      }
    }
  }
  
  return {
    success: true,
    message: "Xóa học sinh và lịch sử giao dịch liên quan thành công."
  };
}

// Helper định dạng ngày YYYY-MM-DD
function formatDate(date) {
  var d = new Date(date);
  var month = "" + (d.getMonth() + 1);
  var day = "" + d.getDate();
  var year = d.getFullYear();

  if (month.length < 2) month = "0" + month;
  if (day.length < 2) day = "0" + day;

  return [year, month, day].join("-");
}

// Hàm test kiểm tra và kích hoạt yêu cầu cấp quyền Google Drive (DriveApp)
function testDrive() {
  var rootName = DriveApp.getRootFolder().getName();
  Logger.log("Đã kết nối Google Drive thành công! Thư mục gốc của thầy là: " + rootName);
}

// Hàm test kiểm tra quyền GHI vào Google Drive
function testDriveWrite() {
  var folder = DriveApp.createFolder("HNT_Test_Folder");
  var file = folder.createFile("test.txt", "Hello World");
  Logger.log("Đã tạo thư mục và file test thành công: " + file.getUrl());
  file.setTrashed(true);
  folder.setTrashed(true);
}

// BÁO CÁO PHỤ HUYNH BẢO MẬT & ĐỘNG (v2.4)
function generateParentToken(studentId, passcode) {
  var str = studentId + "_" + passcode;
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    var char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function getPublicReport(studentId, token) {
  if (!studentId || !token) {
    return { success: false, error: "Thiếu mã học sinh hoặc chữ ký bảo mật." };
  }
  
  var expectedToken = generateParentToken(studentId, PASSCODE);
  if (token !== expectedToken) {
    return { success: false, error: "Chữ ký bảo mật không hợp lệ hoặc đã hết hạn." };
  }
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var studentSheet = ss.getSheetByName("HocSinh");
  var paymentSheet = ss.getSheetByName("HocPhi");
  
  var students = getSheetRowsAsObjects(studentSheet, STUDENT_HEADERS);
  var student = students.find(function(s) {
    return s.id.toString() === studentId.toString();
  });
  
  if (!student) {
    return { success: false, error: "Không tìm thấy học sinh." };
  }
  
  // Chỉ trả về thông tin cần thiết, ẩn SĐT động và Ghi chú nhạy cảm để bảo mật
  var publicStudent = {
    name: student.name,
    id: student.id,
    grade: student.grade,
    school: student.school,
    paid_until: student.paid_until,
    registration_date: student.registration_date
  };
  
  var payments = getSheetRowsAsObjects(paymentSheet, PAYMENT_HEADERS);
  var studentPayments = payments.filter(function(p) {
    return p.student_id.toString() === studentId.toString();
  }).map(function(p) {
    return {
      payment_date: p.payment_date,
      amount: p.amount,
      payment_method: p.payment_method,
      period_start: p.period_start,
      period_end: p.period_end,
      note: p.note
    };
  });
  
  return {
    success: true,
    student: publicStudent,
    payments: studentPayments
  };
}

// BÁO CÁO THỜI KHÓA BIỂU CÔNG KHAI NỘI BỘ (ANONYMIZED)
function getPublicSchedule() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var studentSheet = ss.getSheetByName("HocSinh");
  var students = getSheetRowsAsObjects(studentSheet, STUDENT_HEADERS);
  
  var publicStudents = [];
  for (var i = 0; i < students.length; i++) {
    var s = students[i];
    if (s.status === "Đang học") {
      publicStudents.push({
        grade: s.grade,
        school: s.school,
        campuses_sessions: s.campuses_sessions
      });
    }
  }
  
  return {
    success: true,
    students: publicStudents
  };
}
