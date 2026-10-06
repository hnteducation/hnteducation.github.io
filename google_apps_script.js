/**
 * GOOGLE APPS SCRIPT BACKEND API FOR HNT EDUCATION (Phiên bản v2.7)
 *
 * HƯỚNG DẪN THIẾT LẬP:
 * 1. Mở một Google Sheet mới hoặc có sẵn trên Google Drive của bạn.
 * 2. Vào Extensions (Tiện ích mở rộng) > Apps Script.
 * 3. Xóa mọi code có sẵn và dán toàn bộ đoạn code dưới đây vào.
 * 4. Lưu pass thật trong Script Properties: HNT_MASTER_PASSCODE,
 *    HNT_MANAGER_PASSCODE, HNT_PUBLIC_SECRET. Không đưa pass thật vào code.
 * 5. Bấm nút Deploy (Triển khai) > New deployment (Triển khai mới).
 *    - Chọn loại triển khai: Web app (Ứng dụng web).
 *    - Execute as (Trình thực thi): Me (email_cua_ban@gmail.com).
 *    - Who has access (Ai có quyền truy cập): Anyone (Mọi người).
 * 6. Copy URL của Web App thu được và dán vào cấu hình trên web quản lý.
 */

// ĐỊNH NGHĨA MẬT MÃ BẢO MẬT (Hãy đổi mật mã này và giữ bí mật)
// BẢO MẬT: Không đưa pass thật lên web/repo. Hãy lưu pass trong Apps Script
// Project Settings > Script properties:
// HNT_MASTER_PASSCODE, HNT_MANAGER_PASSCODE, HNT_PUBLIC_SECRET.
// Các giá trị dưới đây chỉ là fallback để thiết lập lần đầu.
var PASSCODE = "";
var MANAGER_PASSCODE = "";
var PUBLIC_SECRET = "";

var SESSION_TTL_SECONDS = 12 * 60 * 60;
var REMEMBER_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

var DEFAULT_MANAGER_PERMISSIONS = {
  canViewStudents: true,
  canViewPayments: true,
  canViewAllPayments: true,
  canAddStudent: true,
  canEditStudent: false,
  canDeleteStudent: false,
  canAddPayment: true,
  canRestoreBackup: false,
  canMassGradeUp: false,
  canUploadAvatar: true,
  canViewPrivateAlbum: false,
  canEditPrivateAlbum: false,
  canSharePublicLinks: true,
  canManageSecurity: false
};

// Khai báo tiêu đề cột của 2 trang tính (Sheets)
var STUDENT_HEADERS = [
  "id", "name", "birth_date", "gender", "school",
  "grade", "class_school", "campuses_sessions",
  "registration_date", "status", "tuition_rate", "paid_until",
  "notes", "father_name", "father_phone", "mother_name", "mother_phone",
  "social_links", "avatar_url", "study_start", "study_start_precision", "tuition_start"
];

var PAYMENT_HEADERS = [
  "payment_id", "student_id", "student_name", "amount",
  "payment_date", "period_start", "period_end", "payment_method", "note"
];

var ALBUM_HEADERS = [
  "photo_id", "student_id", "student_name", "url", "file_id",
  "note", "created_at", "note_updated_at", "uploaded_by", "status"
];

var JOURNAL_HEADERS = [
  "journal_id", "student_id", "student_name", "date", "title",
  "note", "created_at", "updated_at", "status"
];

function getSecurityProperties() {
  var props = PropertiesService.getScriptProperties();
  var masterPass = props.getProperty("HNT_MASTER_PASSCODE") || PASSCODE;
  if (!masterPass) throw new Error("Hãy cấu hình HNT_MASTER_PASSCODE trong Script Properties.");
  var managerPass = props.getProperty("HNT_MANAGER_PASSCODE") || MANAGER_PASSCODE;
  var publicSecret = props.getProperty("HNT_PUBLIC_SECRET") || PUBLIC_SECRET || masterPass;
  var managerPermissions = DEFAULT_MANAGER_PERMISSIONS;
  var managerAccounts = [];

  try {
    var savedPermissions = props.getProperty("HNT_MANAGER_PERMISSIONS");
    if (savedPermissions) {
      managerPermissions = Object.assign({}, DEFAULT_MANAGER_PERMISSIONS, JSON.parse(savedPermissions));
    }
  } catch (err) {
    managerPermissions = DEFAULT_MANAGER_PERMISSIONS;
  }

  try {
    var savedAccounts = props.getProperty("HNT_MANAGER_ACCOUNTS");
    if (savedAccounts) {
      managerAccounts = JSON.parse(savedAccounts).map(function(account, index) {
        return normalizeManagerAccount(account, index);
      }).filter(function(account) {
        return account && account.passcode;
      });
    }
  } catch (errAccounts) {
    managerAccounts = [];
  }

  if (managerAccounts.length === 0 && managerPass) {
    managerAccounts = [{
      id: "manager_default",
      name: "Quản lý giới hạn",
      passcode: managerPass,
      permissions: Object.assign({}, DEFAULT_MANAGER_PERMISSIONS, managerPermissions),
      active: true
    }];
  }

  return {
    masterPass: masterPass,
    managerPass: managerPass,
    publicSecret: publicSecret,
    managerPermissions: managerAccounts.length ? managerAccounts[0].permissions : managerPermissions,
    managerAccounts: managerAccounts
  };
}

function normalizeManagerAccount(account, index, existingById) {
  account = account || {};
  var id = account.id ? account.id.toString() : "";
  if (!id) id = "manager_" + Date.now() + "_" + index;
  var existing = existingById && existingById[id] ? existingById[id] : {};
  var passcode = account.passcode !== undefined ? account.passcode.toString() : (existing.passcode || "");
  var permissions = Object.assign({}, DEFAULT_MANAGER_PERMISSIONS, existing.permissions || {}, account.permissions || {});
  permissions.canManageSecurity = false;
  return {
    id: id,
    name: account.name ? account.name.toString() : (existing.name || ("Quản lý " + (index + 1))),
    passcode: passcode,
    permissions: permissions,
    active: account.active !== false
  };
}

function getManagerSignatureSeed(security) {
  var accounts = security.managerAccounts || [];
  if (accounts.length === 0) return security.managerPass || "";
  return accounts.map(function(account) {
    return account.id + ":" + account.passcode + ":" + (account.active !== false ? "1" : "0");
  }).join("|");
}

function signText(text, secret) {
  var digest = Utilities.computeHmacSha256Signature(text, secret);
  return Utilities.base64EncodeWebSafe(digest).replace(/=+$/, "");
}

function createSession(role, accountId, remember) {
  var security = getSecurityProperties();
  var ttl = remember ? REMEMBER_SESSION_TTL_SECONDS : SESSION_TTL_SECONDS;
  var expiresAt = Math.floor(Date.now() / 1000) + ttl;
  var payload = role + "." + (accountId || "master") + "." + expiresAt;
  return {
    token: payload + "." + signText(payload, security.masterPass + "|" + getManagerSignatureSeed(security)),
    expiresAt: expiresAt
  };
}

function parseSessionToken(token) {
  if (!token) return null;
  var parts = token.toString().split(".");
  if (parts.length !== 3 && parts.length !== 4) return null;

  var role = parts[0];
  var accountId = parts.length === 4 ? parts[1] : "";
  var expiresAt = parseInt(parts.length === 4 ? parts[2] : parts[1], 10);
  var signature = parts.length === 4 ? parts[3] : parts[2];
  if (!role || !expiresAt || expiresAt < Math.floor(Date.now() / 1000)) return null;

  var security = getSecurityProperties();
  var payload = parts.length === 4 ? (role + "." + accountId + "." + expiresAt) : (role + "." + expiresAt);
  var expected = signText(payload, security.masterPass + "|" + getManagerSignatureSeed(security));
  var legacyExpected = signText(payload, security.masterPass + "|" + security.managerPass);
  if (signature !== expected && signature !== legacyExpected) return null;

  return buildAuth(role, token, expiresAt, accountId);
}

function buildAuth(role, token, expiresAt, accountId) {
  var security = getSecurityProperties();
  var managerAccount = null;
  if (role === "manager") {
    var accounts = security.managerAccounts || [];
    for (var i = 0; i < accounts.length; i++) {
      if ((!accountId && i === 0) || accounts[i].id === accountId) {
        managerAccount = accounts[i];
        break;
      }
    }
    if (!managerAccount || managerAccount.active === false) return null;
  }

  var permissions = role === "master"
    ? {
        canViewStudents: true,
        canViewPayments: true,
        canViewAllPayments: true,
        canAddStudent: true,
        canEditStudent: true,
        canDeleteStudent: true,
        canAddPayment: true,
        canRestoreBackup: true,
        canMassGradeUp: true,
        canUploadAvatar: true,
        canViewPrivateAlbum: true,
        canEditPrivateAlbum: true,
        canSharePublicLinks: true,
        canManageSecurity: true
      }
    : managerAccount.permissions;

  return {
    role: role,
    accountId: managerAccount ? managerAccount.id : "",
    accountName: managerAccount ? managerAccount.name : "Toàn quyền",
    token: token || "",
    expiresAt: expiresAt || 0,
    permissions: permissions
  };
}

function authenticate(params) {
  var session = parseSessionToken(params.sessionToken);
  if (session) return session;

  var security = getSecurityProperties();
  var passcode = params.passcode ? params.passcode.toString() : "";
  var remember = params.rememberLogin === true || params.rememberLogin === "true";
  if (passcode && passcode === security.masterPass) {
    var masterSession = createSession("master", "master", remember);
    return buildAuth("master", masterSession.token, masterSession.expiresAt, "master");
  }
  var accounts = security.managerAccounts || [];
  for (var i = 0; i < accounts.length; i++) {
    if (passcode && accounts[i].active !== false && accounts[i].passcode === passcode) {
      var managerSession = createSession("manager", accounts[i].id, remember);
      return buildAuth("manager", managerSession.token, managerSession.expiresAt, accounts[i].id);
    }
  }
  return null;
}

function requirePermission(auth, permissionName) {
  if (!auth || !auth.permissions || !auth.permissions[permissionName]) {
    return {
      success: false,
      error: "Unauthorized: Tai khoan hien tai khong co quyen thuc hien thao tac nay."
    };
  }
  return null;
}

function getPublicSecret() {
  return getSecurityProperties().publicSecret;
}

function getSecurityConfig() {
  var security = getSecurityProperties();
  return {
    success: true,
    managerPassConfigured: (security.managerAccounts || []).length > 0,
    publicSecretConfigured: !!security.publicSecret,
    managerPermissions: security.managerPermissions,
    managerAccounts: (security.managerAccounts || []).map(function(account) {
      return {
        id: account.id,
        name: account.name,
        active: account.active !== false,
        passConfigured: !!account.passcode,
        permissions: account.permissions
      };
    })
  };
}

function updateSecurityConfig(securityConfig) {
  securityConfig = securityConfig || {};
  var props = PropertiesService.getScriptProperties();

  if (securityConfig.masterPasscode) {
    props.setProperty("HNT_MASTER_PASSCODE", securityConfig.masterPasscode.toString());
  }
  if (securityConfig.managerPasscode !== undefined) {
    var managerPass = securityConfig.managerPasscode ? securityConfig.managerPasscode.toString() : "";
    if (managerPass === "DELETE") {
      props.deleteProperty("HNT_MANAGER_PASSCODE");
    } else if (managerPass) {
      props.setProperty("HNT_MANAGER_PASSCODE", managerPass);
    }
  }
  if (securityConfig.publicSecret) {
    props.setProperty("HNT_PUBLIC_SECRET", securityConfig.publicSecret.toString());
  }
  if (securityConfig.managerPermissions) {
    var merged = Object.assign({}, DEFAULT_MANAGER_PERMISSIONS, securityConfig.managerPermissions);
    merged.canManageSecurity = false;
    props.setProperty("HNT_MANAGER_PERMISSIONS", JSON.stringify(merged));
  }
  if (securityConfig.managerAccounts) {
    var existingSecurity = getSecurityProperties();
    var existingById = {};
    (existingSecurity.managerAccounts || []).forEach(function(account) {
      existingById[account.id] = account;
    });
    var normalizedAccounts = securityConfig.managerAccounts.map(function(account, index) {
      return normalizeManagerAccount(account, index, existingById);
    }).filter(function(account) {
      return account.passcode;
    });
    props.setProperty("HNT_MANAGER_ACCOUNTS", JSON.stringify(normalizedAccounts));
    props.deleteProperty("HNT_MANAGER_PASSCODE");
    if (normalizedAccounts.length > 0) {
      props.setProperty("HNT_MANAGER_PERMISSIONS", JSON.stringify(normalizedAccounts[0].permissions));
    }
  }

  return getSecurityConfig();
}

function doGet(e) {
  return handleRequest(e, "GET");
}

function doPost(e) {
  return handleRequest(e, "POST");
}

function handleRequest(e, method) {
  if (method === "OPTIONS" || (e && e.parameter && e.parameter.method === "OPTIONS")) {
    return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT);
  }

  var requestLock;
  try {
    var params = {};
    if (method === "GET") {
      params = e.parameter;
    } else if (e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    }

    var action = params.action;
    var isPublicAction = (action === "getPublicReport" || action === "getPublicSchedule");
    var auth = isPublicAction ? null : authenticate(params);

    if (!isPublicAction && !auth) {
      return createJSONResponse({
        success: false,
        error: "Unauthorized: Mat ma hoac phien dang nhap khong hop le."
      }, 403);
    }

    requestLock = LockService.getScriptLock();
    if (!requestLock.tryLock(10000)) {
      return createJSONResponse({ success: false, retryable: true, error: "Máy chủ đang bận. Vui lòng thử lại." });
    }
    var result = {};
    initSheets();
    var readActions = ["login", "getData", "getPublicReport", "getPublicSchedule", "getSecurityConfig", "createParentToken", "createPublicScheduleToken"];
    var receipt = null;
    if (readActions.indexOf(action) === -1) {
      if (!params.requestId) return createJSONResponse({ success: false, error: "Vui lòng tải lại website để dùng phiên bản đồng bộ mới." });
      receipt = beginRequestReceipt(params, auth);
      if (receipt.result) return createJSONResponse(receipt.result);
    }

    if (action === "login") {
      result = {
        success: true,
        message: "Dang nhap thanh cong.",
        role: auth.role,
        sessionToken: auth.token,
        expiresAt: auth.expiresAt,
        permissions: auth.permissions
      };
    } else if (action === "getPublicReport") {
      result = getPublicReport(params.studentId, params.token);
    } else if (action === "getPublicSchedule") {
      result = getPublicSchedule(params.token);
    } else if (action === "getData") {
      result = requirePermission(auth, "canViewStudents") || getData(auth);
    } else if (action === "addStudent") {
      result = requirePermission(auth, "canAddStudent") || addStudent(params.studentData);
    } else if (action === "updateStudent") {
      result = requirePermission(auth, "canEditStudent") || updateStudent(params.studentId, params.studentData);
    } else if (action === "deleteStudent") {
      result = requirePermission(auth, "canDeleteStudent") || deleteStudent(params.studentId);
    } else if (action === "addPayment") {
      result = requirePermission(auth, "canAddPayment") || addPayment(params.paymentData);
    } else if (action === "massGradeUp") {
      result = requirePermission(auth, "canMassGradeUp") || massGradeUp(params.gradeUpData || params.options || {});
    } else if (action === "uploadAvatar") {
      result = requirePermission(auth, "canUploadAvatar") || uploadAvatar(params.avatarData);
    } else if (action === "uploadAlbumPhoto") {
      result = requirePermission(auth, "canEditPrivateAlbum") || uploadAlbumPhoto(params.albumData);
    } else if (action === "updateAlbumPhoto") {
      result = requirePermission(auth, "canEditPrivateAlbum") || updateAlbumPhoto(params.photoId, params.photoData || {});
    } else if (action === "deleteAlbumPhoto") {
      result = requirePermission(auth, "canEditPrivateAlbum") || deleteAlbumPhoto(params.photoId);
    } else if (action === "addStudentJournal") {
      result = requirePermission(auth, "canEditStudent") || addStudentJournal(params.journalData || {});
    } else if (action === "updateStudentJournal") {
      result = requirePermission(auth, "canEditStudent") || updateStudentJournal(params.journalId, params.journalData || {});
    } else if (action === "deleteStudentJournal") {
      result = requirePermission(auth, "canEditStudent") || deleteStudentJournal(params.journalId);
    } else if (action === "restoreBackup") {
      result = requirePermission(auth, "canRestoreBackup") || restoreBackup(params.backupData);
    } else if (action === "createParentToken") {
      result = requirePermission(auth, "canSharePublicLinks") || createParentToken(params.studentId);
    } else if (action === "createPublicScheduleToken") {
      result = requirePermission(auth, "canSharePublicLinks") || createPublicScheduleToken();
    } else if (action === "getSecurityConfig") {
      result = requirePermission(auth, "canManageSecurity") || getSecurityConfig();
    } else if (action === "updateSecurityConfig") {
      result = requirePermission(auth, "canManageSecurity") || updateSecurityConfig(params.securityConfig);
    } else {
      result = { success: false, error: "Action khong hop le: " + action };
    }

    if (receipt) {
      SpreadsheetApp.flush();
      receipt.sheet.getRange(receipt.row, 3).setValue(JSON.stringify(result));
      SpreadsheetApp.flush();
    }
    result.protocolVersion = 3;
    return createJSONResponse(result, 200);

  } catch (err) {
    return createJSONResponse({
      success: false,
      uncertain: !!receipt,
      error: "Loi he thong Apps Script: " + err.toString()
    }, 500);
  } finally {
    if (requestLock && requestLock.hasLock()) requestLock.releaseLock();
  }
}
// Durable receipts survive a lost HTTP response and browser reload.
// A pending receipt after a terminated execution requires inspection, never blind replay.
function beginRequestReceipt(params, auth) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("YeuCauDongBo");
  if (!sheet) {
    sheet = ss.insertSheet("YeuCauDongBo");
    sheet.appendRow(["request_key", "fingerprint", "result", "created_at"]);
  }
  var key = (auth.accountId || auth.role) + ":" + params.requestId;
  var data = Object.assign({}, params);
  delete data.sessionToken;
  delete data.passcode;
  delete data.requestId;
  var fingerprint = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(data)));
  var rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues() : [];
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] !== key) continue;
    if (rows[i][1] !== fingerprint) return { result: { success: false, error: "Mã yêu cầu đã được dùng cho dữ liệu khác." } };
    if (rows[i][2]) return { result: JSON.parse(rows[i][2]) };
    return { result: { success: false, uncertain: true, error: "Yêu cầu chưa xác nhận hoàn tất. Hãy đồng bộ và kiểm tra Sheet trước khi tạo giao dịch khác. Mã: " + params.requestId } };
  }
  sheet.appendRow([key, fingerprint, "", new Date().toISOString()]);
  SpreadsheetApp.flush();
  return { sheet: sheet, row: sheet.getLastRow() };
}

function validateEffectiveDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "") || isNaN(new Date(value).getTime()) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new Error("Ngày thay đổi trạng thái không hợp lệ.");
  }
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  if (value > today) throw new Error("Chọn ngày hôm nay hoặc ngày trước đó; chưa hỗ trợ đổi trạng thái trong tương lai.");
  return value;
}

function recordStudyTransition(studentData, current) {
  var nextStatus = studentData.status || current.status;
  if (nextStatus === current.status) {
    if (studentData.notes !== undefined) studentData.notes = buildNotesWithAcademicMeta(studentData.notes, parseAcademicMeta(current.notes));
    return;
  }
  if (["Đang học", "Tạm nghỉ", "Nghỉ luôn"].indexOf(nextStatus) === -1) throw new Error("Trạng thái không hợp lệ.");
  var date = validateEffectiveDate(studentData.status_effective_date);
  var meta = parseAcademicMeta(current.notes);
  var last = meta.status_changes.length ? meta.status_changes[meta.status_changes.length - 1].effective_date : "";
  var anchor = current.tuition_start || current.registration_date;
  if (anchor instanceof Date) anchor = formatDate(anchor);
  if ((last && date < last) || (anchor && date < anchor)) throw new Error("Ngày thay đổi phải sau ngày bắt đầu học và lần thay đổi gần nhất.");
  meta.status_changes.push({ type: nextStatus === "Đang học" ? "return_to_study" : (nextStatus === "Tạm nghỉ" ? "pause" : "graduate_leave"), from_status: current.status, to_status: nextStatus, effective_date: date, school_year: inferSchoolYearForDate(date), registration_date: current.registration_date instanceof Date ? formatDate(current.registration_date) : current.registration_date, created_at: new Date().toISOString() });
  studentData.notes = buildNotesWithAcademicMeta(studentData.notes !== undefined ? studentData.notes : current.notes, meta);
  if (nextStatus === "Đang học") studentData.tuition_start = date;
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

  // 3. Sheet AlbumAnh: mỗi ảnh album là một dòng riêng để tránh giới hạn độ dài ô notes
  var albumSheet = ss.getSheetByName("AlbumAnh");
  if (!albumSheet) {
    albumSheet = ss.insertSheet("AlbumAnh");
    albumSheet.appendRow(ALBUM_HEADERS);
    albumSheet.getRange(1, 1, 1, ALBUM_HEADERS.length)
      .setFontWeight("bold")
      .setBackground("#f8d7da");
  } else {
    var lastAlbumCol = albumSheet.getLastColumn();
    var currentAlbumHeaders = [];
    if (lastAlbumCol > 0) {
      currentAlbumHeaders = albumSheet.getRange(1, 1, 1, lastAlbumCol).getValues()[0];
    }
    for (var a = 0; a < ALBUM_HEADERS.length; a++) {
      var albumHeaderName = ALBUM_HEADERS[a];
      if (currentAlbumHeaders.indexOf(albumHeaderName) === -1) {
        var nextAlbumCol = albumSheet.getLastColumn() + 1;
        albumSheet.getRange(1, nextAlbumCol).setValue(albumHeaderName)
          .setFontWeight("bold")
          .setBackground("#f8d7da");
        currentAlbumHeaders.push(albumHeaderName);
      }
    }
  }

  // 4. Sheet NhatKyHocSinh: mỗi dòng nhật ký là một record riêng để lưu số lượng lớn
  var journalSheet = ss.getSheetByName("NhatKyHocSinh");
  if (!journalSheet) {
    journalSheet = ss.insertSheet("NhatKyHocSinh");
    journalSheet.appendRow(JOURNAL_HEADERS);
    journalSheet.getRange(1, 1, 1, JOURNAL_HEADERS.length)
      .setFontWeight("bold")
      .setBackground("#dbeafe");
  } else {
    var lastJournalCol = journalSheet.getLastColumn();
    var currentJournalHeaders = [];
    if (lastJournalCol > 0) {
      currentJournalHeaders = journalSheet.getRange(1, 1, 1, lastJournalCol).getValues()[0];
    }
    for (var n = 0; n < JOURNAL_HEADERS.length; n++) {
      var journalHeaderName = JOURNAL_HEADERS[n];
      if (currentJournalHeaders.indexOf(journalHeaderName) === -1) {
        var nextJournalCol = journalSheet.getLastColumn() + 1;
        journalSheet.getRange(1, nextJournalCol).setValue(journalHeaderName)
          .setFontWeight("bold")
          .setBackground("#dbeafe");
        currentJournalHeaders.push(journalHeaderName);
      }
    }
  }
}

// 1. LẤY TOÀN BỘ DỮ LIỆU
function redactStudentsForRole(students, auth) {
  if (!auth || auth.role === "master") return students;
  if (auth.permissions && auth.permissions.canViewPrivateAlbum) return students;

  return students.map(function(student) {
    var copy = Object.assign({}, student);
    if (copy.notes) {
      copy.notes = getStudentNoteWithoutAlbum(copy.notes);
    }
    return copy;
  });
}

function getStudentNoteWithoutAlbum(notes) {
  if (!notes) return "";
  return notes.toString().replace(/===ALBUM===[\s\S]*?(?=(===JOURNAL===|===ACADEMIC===|$))/g, "").trim();
}

function getData(auth) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var studentSheet = ss.getSheetByName("HocSinh");
  var paymentSheet = ss.getSheetByName("HocPhi");
  var albumSheet = ss.getSheetByName("AlbumAnh");
  var journalSheet = ss.getSheetByName("NhatKyHocSinh");

  var students = getSheetRowsAsObjects(studentSheet, STUDENT_HEADERS);
  var payments = getSheetRowsAsObjects(paymentSheet, PAYMENT_HEADERS);
  var albums = albumSheet ? getSheetRowsAsObjects(albumSheet, ALBUM_HEADERS).filter(function(photo) {
    return photo.status !== "deleted";
  }) : [];
  var journals = journalSheet ? getSheetRowsAsObjects(journalSheet, JOURNAL_HEADERS).filter(function(entry) {
    return entry.status !== "deleted";
  }) : [];

  if (auth && auth.permissions && (!auth.permissions.canViewPayments || !auth.permissions.canViewAllPayments)) {
    payments = [];
  }
  if (!auth || !auth.permissions || (!auth.permissions.canViewPrivateAlbum && !auth.permissions.canEditPrivateAlbum)) {
    albums = [];
  }

  return {
    success: true,
    students: redactStudentsForRole(students, auth),
    payments: payments,
    albums: albums,
    journals: journals
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

  if (!studentData.name || !studentData.name.trim()) throw new Error("Thiếu tên học sinh.");
  studentData.status = studentData.status || "Đang học";
  studentData.tuition_start = studentData.registration_date || "";
  if (studentData.status !== "Đang học") recordStudyTransition(studentData, { status: "Đang học", notes: "", registration_date: studentData.registration_date });
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

  var currentValues = sheet.getRange(rowIndex, 1, 1, STUDENT_HEADERS.length).getValues()[0];
  var currentStudent = {};
  STUDENT_HEADERS.forEach(function(key, index) { currentStudent[key] = currentValues[index]; });
  recordStudyTransition(studentData, currentStudent);

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

  if (!paymentData || !isFinite(Number(paymentData.amount)) || Number(paymentData.amount) <= 0) throw new Error("Số tiền không hợp lệ.");
  validateEffectiveDate(paymentData.payment_date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentData.period_start || "") || !/^\d{4}-\d{2}-\d{2}$/.test(paymentData.period_end || "") || paymentData.period_end < paymentData.period_start) throw new Error("Kỳ học phí không hợp lệ.");
  var matchingStudent = getSheetRowsAsObjects(studentSheet, STUDENT_HEADERS).filter(function(student) { return String(student.id) === String(paymentData.student_id); })[0];
  if (!matchingStudent) throw new Error("Không tìm thấy học sinh để thu học phí.");
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
      var currentPaidUntil = studentSheet.getRange(studRowIndex, colPaidUntil).getValue();
      var currentPaidStr = currentPaidUntil instanceof Date ? formatDate(currentPaidUntil) : (currentPaidUntil || "").toString();
      var newPaidStr = (paymentData.period_end || "").toString();
      if (!currentPaidStr || (newPaidStr && newPaidStr > currentPaidStr)) {
        studentSheet.getRange(studRowIndex, colPaidUntil).setValue(paymentData.period_end);
      }
    }
  }

  return {
    success: true,
    message: "Ghi nhận học phí thành công.",
    payment_id: nextPayId
  };
}

// 5. CHUYỂN NIÊN KHÓA HÀNG LOẠT
function parseAcademicMeta(notes) {
  if (!notes || notes.toString().indexOf("===ACADEMIC===") === -1) {
    return { promotions: [], status_changes: [] };
  }
  try {
    var jsonStr = notes.toString().split("===ACADEMIC===")[1].split("===ALBUM===")[0].split("===JOURNAL===")[0].trim();
    var parsed = JSON.parse(jsonStr) || {};
    if (!Array.isArray(parsed.promotions)) parsed.promotions = [];
    if (!Array.isArray(parsed.status_changes)) parsed.status_changes = [];
    return parsed;
  } catch (e) {
    return { promotions: [], status_changes: [] };
  }
}

function stripAcademicMeta(notes) {
  if (!notes) return "";
  return notes.toString().replace(/===ACADEMIC===[\s\S]*?(?=(===ALBUM===|===JOURNAL===|$))/g, "").trim();
}

function buildNotesWithAcademicMeta(notes, meta) {
  var base = stripAcademicMeta(notes);
  var compactMeta = {
    promotions: Array.isArray(meta.promotions) ? meta.promotions : [],
    status_changes: Array.isArray(meta.status_changes) ? meta.status_changes : []
  };
  var marker = "===ACADEMIC=== " + JSON.stringify(compactMeta);
  return base ? base + "\n" + marker : marker;
}

function hasPromotionForSchoolYear(meta, schoolYear) {
  var promotions = Array.isArray(meta.promotions) ? meta.promotions : [];
  for (var i = 0; i < promotions.length; i++) {
    if (promotions[i] && promotions[i].school_year === schoolYear) return true;
  }
  return false;
}

function inferSchoolYearForDate(dateStr) {
  var d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime())) d = new Date();
  var year = d.getFullYear();
  var month = d.getMonth() + 1;
  var startYear = month >= 6 ? year : year - 1;
  return startYear + "-" + (startYear + 1);
}

function massGradeUp(options) {
  options = options || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("HocSinh");
  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return { success: false, error: "Không có học sinh để thực hiện." };
  }

  var colGrade = STUDENT_HEADERS.indexOf("grade") + 1;
  var colStatus = STUDENT_HEADERS.indexOf("status") + 1;
  var colNotes = STUDENT_HEADERS.indexOf("notes") + 1;
  var colRegDate = STUDENT_HEADERS.indexOf("registration_date") + 1;

  var grades = sheet.getRange(2, colGrade, lastRow - 1, 1).getValues();
  var statuses = sheet.getRange(2, colStatus, lastRow - 1, 1).getValues();
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var names = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  var notesValues = sheet.getRange(2, colNotes, lastRow - 1, 1).getValues();
  var regValues = sheet.getRange(2, colRegDate, lastRow - 1, 1).getValues();

  var countUp = 0;
  var countGrad = 0;
  var countPaused = 0;
  var countReturned = 0;
  var countSkipped = 0;
  var mode = options.mode || "legacy";
  var targetSchoolYear = options.targetSchoolYear || inferSchoolYearForDate(options.effectiveDate);
  var effectiveDate = validateEffectiveDate(options.effectiveDate || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"));
  var selectedIds = Array.isArray(options.studentIds) ? options.studentIds.map(function(id) { return id.toString(); }) : [];
  var useSelection = selectedIds.length > 0;
  if (mode !== "legacy" && !useSelection) return { success: false, error: "Chọn ít nhất một học sinh." };
  // Validate the complete selection before applying a batch.
  getSheetRowsAsObjects(sheet, STUDENT_HEADERS).forEach(function(student) {
    if (useSelection && selectedIds.indexOf(String(student.id)) === -1) return;
    var nextStatus = mode === "return_to_study" ? "Đang học" : mode === "graduate_leave" ? "Nghỉ luôn" : mode === "grade_up_summer" ? (Number(student.grade) >= 12 ? "Nghỉ luôn" : "Tạm nghỉ") : student.status;
    if (mode === "grade_up_summer" && (student.status !== "Đang học" || hasPromotionForSchoolYear(parseAcademicMeta(student.notes), targetSchoolYear))) return;
    recordStudyTransition({ status: nextStatus, status_effective_date: effectiveDate }, student);
  });

  for (var i = 0; i < grades.length; i++) {
    var rowNum = i + 2;
    var currentStatus = statuses[i][0];
    var studentId = ids[i][0] ? ids[i][0].toString() : "";
    if (useSelection && selectedIds.indexOf(studentId) === -1) continue;

    var currentGrade = parseInt(grades[i][0]);
    var currentNotes = notesValues[i][0] || "";
    var meta = parseAcademicMeta(currentNotes);

    if (mode === "return_to_study") {
      if (currentStatus === "Đang học") { countSkipped++; continue; }
      var transition = { status: "Đang học", status_effective_date: effectiveDate };
      recordStudyTransition(transition, { status: currentStatus, notes: currentNotes, registration_date: regValues[i][0] });
      sheet.getRange(rowNum, colStatus).setValue("Đang học");
      sheet.getRange(rowNum, STUDENT_HEADERS.indexOf("tuition_start") + 1).setValue(effectiveDate);
      meta.status_changes.push({
        type: "return_to_study",
        registration_date: regValues[i][0] instanceof Date ? formatDate(regValues[i][0]) : regValues[i][0],
        school_year: targetSchoolYear,
        effective_date: effectiveDate,
        created_at: new Date().toISOString()
      });
      sheet.getRange(rowNum, colNotes).setValue(buildNotesWithAcademicMeta(currentNotes, meta));
      countReturned++;
      continue;
    }

    if (mode === "graduate_leave") {
      if (currentStatus === "Nghỉ luôn") {
        countSkipped++;
        continue;
      }
      sheet.getRange(rowNum, colStatus).setValue("Nghỉ luôn");
      meta.status_changes.push({
        type: "graduate_leave",
        school_year: targetSchoolYear,
        effective_date: effectiveDate,
        grade: isNaN(currentGrade) ? "" : currentGrade,
        created_at: new Date().toISOString()
      });
      sheet.getRange(rowNum, colNotes).setValue(buildNotesWithAcademicMeta(currentNotes, meta));
      countGrad++;
      continue;
    }

    if (currentStatus === "Đang học") {
      if (!isNaN(currentGrade)) {
        if (mode === "grade_up_summer" && hasPromotionForSchoolYear(meta, targetSchoolYear)) {
          countSkipped++;
          continue;
        }
        if (currentGrade >= 12) {
          sheet.getRange(rowNum, colStatus).setValue("Nghỉ luôn");
          meta.status_changes.push({
            type: "graduate_leave",
            school_year: targetSchoolYear,
            effective_date: effectiveDate,
            grade: currentGrade,
            created_at: new Date().toISOString()
          });
          sheet.getRange(rowNum, colNotes).setValue(buildNotesWithAcademicMeta(currentNotes, meta));
          countGrad++;
        } else {
          sheet.getRange(rowNum, colGrade).setValue(currentGrade + 1);
          if (mode === "grade_up_summer") {
            sheet.getRange(rowNum, colStatus).setValue("Tạm nghỉ");
            meta.status_changes.push({ type: "pause", from_status: currentStatus, to_status: "Tạm nghỉ", effective_date: effectiveDate, school_year: targetSchoolYear, created_at: new Date().toISOString() });
            countPaused++;
          }
          meta.promotions.push({
            type: mode === "grade_up_summer" ? "grade_up_summer" : "legacy_grade_up",
            school_year: targetSchoolYear,
            effective_date: effectiveDate,
            from_grade: currentGrade,
            to_grade: currentGrade + 1,
            created_at: new Date().toISOString()
          });
          sheet.getRange(rowNum, colNotes).setValue(buildNotesWithAcademicMeta(currentNotes, meta));
          countUp++;
        }
      }
    } else {
      countSkipped++;
    }
  }

  if (mode === "grade_up_summer") {
    return {
      success: true,
      message: "Đã lên lớp cho " + countUp + " học sinh; chuyển tạm nghỉ hè cho " + countPaused + " học sinh; tốt nghiệp/nghỉ luôn " + countGrad + " học sinh; bỏ qua " + countSkipped + " học sinh đã xử lý hoặc không phù hợp."
    };
  }
  if (mode === "return_to_study") {
    return {
      success: true,
      message: "Đã cho học lại " + countReturned + " học sinh và bắt đầu tính phí lại cho năm học " + targetSchoolYear + " là " + effectiveDate + "."
    };
  }
  if (mode === "graduate_leave") {
    return {
      success: true,
      message: "Đã chuyển nghỉ luôn/tốt nghiệp cho " + countGrad + " học sinh; bỏ qua " + countSkipped + " học sinh."
    };
  }

  return {
    success: true,
    message: "Chuyển niên khóa thành công! Lên lớp cho " + countUp + " học sinh; Đã nghỉ (Tốt nghiệp lớp 12) cho " + countGrad + " học sinh."
  };
}

function sanitizeDriveName(name) {
  return (name || "untitled").toString().replace(/[\\/:*?"<>|#%\[\]]/g, "_").trim() || "untitled";
}

function getOrCreateDriveFolder(folderName, parentFolder) {
  var folders = parentFolder
    ? parentFolder.getFoldersByName(folderName)
    : DriveApp.getFoldersByName(folderName);

  if (folders.hasNext()) {
    return folders.next();
  }

  return parentFolder
    ? parentFolder.createFolder(folderName)
    : DriveApp.createFolder(folderName);
}

function uploadImageToDrive(imageData, rootFolderName, childFolderName) {
  if (!imageData || !imageData.base64Data || !imageData.mimeType) {
    return { success: false, error: "Thiếu dữ liệu hình ảnh để tải lên Google Drive." };
  }

  try {
    var base64String = imageData.base64Data.indexOf(",") > -1
      ? imageData.base64Data.split(",")[1]
      : imageData.base64Data;
    var decoded = Utilities.base64Decode(base64String);
    var filename = sanitizeDriveName(imageData.filename || ("hnt_image_" + new Date().getTime() + ".jpg"));
    var blob = Utilities.newBlob(decoded, imageData.mimeType, filename);

    var folder;

    // Sử dụng try-catch lồng nhau phòng trường hợp lỗi phân quyền Drive
    try {
      folder = getOrCreateDriveFolder(rootFolderName);
      if (childFolderName) {
        folder = getOrCreateDriveFolder(sanitizeDriveName(childFolderName), folder);
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

// 6. TẢI ẢNH ĐẠI DIỆN LÊN GOOGLE DRIVE
function uploadAvatar(avatarData) {
  return uploadImageToDrive(avatarData, "HNT_Avatars");
}

// 6B. TẢI ẢNH ALBUM NỘI BỘ LÊN GOOGLE DRIVE
function uploadAlbumPhoto(albumData) {
  var studentId = albumData && albumData.studentId ? albumData.studentId.toString() : "unknown";
  var studentName = albumData && albumData.studentName ? albumData.studentName.toString() : "";
  var folderName = studentId + (studentName ? "_" + studentName : "");
  var uploaded = uploadImageToDrive(albumData, "HNT_Albums", folderName);
  if (!uploaded || !uploaded.success) return uploaded;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var albumSheet = ss.getSheetByName("AlbumAnh");
  if (!albumSheet) {
    initSheets();
    albumSheet = ss.getSheetByName("AlbumAnh");
  }

  var createdAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
  var photo = {
    photo_id: "photo_" + new Date().getTime() + "_" + Math.floor(Math.random() * 100000),
    student_id: studentId,
    student_name: studentName,
    url: uploaded.url,
    file_id: uploaded.fileId,
    note: albumData && albumData.note ? albumData.note.toString() : "",
    created_at: createdAt,
    note_updated_at: "",
    uploaded_by: "",
    status: "active"
  };

  albumSheet.appendRow(ALBUM_HEADERS.map(function(key) {
    return photo[key] !== undefined ? photo[key] : "";
  }));

  uploaded.photo = photo;
  uploaded.photo_id = photo.photo_id;
  return uploaded;
}

function findAlbumPhotoRow(photoId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("AlbumAnh");
  if (!sheet || sheet.getLastRow() <= 1) return { sheet: sheet, rowIndex: -1 };
  var colPhotoId = ALBUM_HEADERS.indexOf("photo_id") + 1;
  var ids = sheet.getRange(2, colPhotoId, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] && ids[i][0].toString() === photoId.toString()) {
      return { sheet: sheet, rowIndex: i + 2 };
    }
  }
  return { sheet: sheet, rowIndex: -1 };
}

function updateAlbumPhoto(photoId, photoData) {
  if (!photoId) return { success: false, error: "Thiếu mã ảnh album." };
  var found = findAlbumPhotoRow(photoId);
  if (!found.sheet || found.rowIndex === -1) {
    return { success: false, error: "Không tìm thấy ảnh album." };
  }

  var currentValues = found.sheet.getRange(found.rowIndex, 1, 1, ALBUM_HEADERS.length).getValues()[0];
  var photo = {};
  for (var i = 0; i < ALBUM_HEADERS.length; i++) photo[ALBUM_HEADERS[i]] = currentValues[i];

  if (photoData.note !== undefined) {
    photo.note = photoData.note;
    photo.note_updated_at = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
  }
  if (photoData.status !== undefined) photo.status = photoData.status;

  found.sheet.getRange(found.rowIndex, 1, 1, ALBUM_HEADERS.length).setValues([ALBUM_HEADERS.map(function(key) {
    return photo[key] !== undefined ? photo[key] : "";
  })]);

  return { success: true, photo: photo };
}

function deleteAlbumPhoto(photoId) {
  if (!photoId) return { success: false, error: "Thiếu mã ảnh album." };
  return updateAlbumPhoto(photoId, { status: "deleted" });
}

function getOrCreateJournalSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("NhatKyHocSinh");
  if (!sheet) {
    initSheets();
    sheet = ss.getSheetByName("NhatKyHocSinh");
  }
  return sheet;
}

function addStudentJournal(journalData) {
  if (!journalData || !journalData.student_id) {
    return { success: false, error: "Thiếu mã học sinh để lưu nhật ký." };
  }
  var sheet = getOrCreateJournalSheet();
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
  var entry = {
    journal_id: journalData.journal_id || ("journal_" + new Date().getTime() + "_" + Math.floor(Math.random() * 100000)),
    student_id: journalData.student_id.toString(),
    student_name: journalData.student_name || "",
    date: journalData.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
    title: journalData.title || "Theo dõi học sinh",
    note: journalData.note || "",
    created_at: journalData.created_at || now,
    updated_at: journalData.updated_at || "",
    status: "active"
  };

  sheet.appendRow(JOURNAL_HEADERS.map(function(key) {
    return entry[key] !== undefined ? entry[key] : "";
  }));
  return { success: true, journal: entry };
}

function findStudentJournalRow(journalId) {
  var sheet = getOrCreateJournalSheet();
  if (!sheet || sheet.getLastRow() <= 1) return { sheet: sheet, rowIndex: -1 };
  var colJournalId = JOURNAL_HEADERS.indexOf("journal_id") + 1;
  var ids = sheet.getRange(2, colJournalId, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] && ids[i][0].toString() === journalId.toString()) {
      return { sheet: sheet, rowIndex: i + 2 };
    }
  }
  return { sheet: sheet, rowIndex: -1 };
}

function updateStudentJournal(journalId, journalData) {
  if (!journalId) return { success: false, error: "Thiếu mã dòng nhật ký." };
  var found = findStudentJournalRow(journalId);
  if (!found.sheet || found.rowIndex === -1) {
    return { success: false, error: "Không tìm thấy dòng nhật ký." };
  }

  var currentValues = found.sheet.getRange(found.rowIndex, 1, 1, JOURNAL_HEADERS.length).getValues()[0];
  var entry = {};
  for (var i = 0; i < JOURNAL_HEADERS.length; i++) entry[JOURNAL_HEADERS[i]] = currentValues[i];

  ["student_id", "student_name", "date", "title", "note", "status"].forEach(function(key) {
    if (journalData[key] !== undefined) entry[key] = journalData[key];
  });
  entry.updated_at = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");

  found.sheet.getRange(found.rowIndex, 1, 1, JOURNAL_HEADERS.length).setValues([JOURNAL_HEADERS.map(function(key) {
    return entry[key] !== undefined ? entry[key] : "";
  })]);

  return { success: true, journal: entry };
}

function deleteStudentJournal(journalId) {
  if (!journalId) return { success: false, error: "Thiếu mã dòng nhật ký." };
  return updateStudentJournal(journalId, { status: "deleted" });
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
function generateParentToken(studentId) {
  return signText("parent-report." + studentId, getPublicSecret());
}

function createParentToken(studentId) {
  if (!studentId) {
    return { success: false, error: "Thieu ma hoc sinh de tao link public." };
  }
  return {
    success: true,
    studentId: studentId,
    token: generateParentToken(studentId)
  };
}

function generatePublicScheduleToken() {
  return signText("public-schedule", getPublicSecret());
}

function createPublicScheduleToken() {
  return {
    success: true,
    token: generatePublicScheduleToken()
  };
}

function getPublicReport(studentId, token) {
  if (!studentId || !token) {
    return { success: false, error: "Thiếu mã học sinh hoặc chữ ký bảo mật." };
  }

  var expectedToken = generateParentToken(studentId);
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
	gender: student.gender,
    grade: student.grade,
    school: student.school,
    class_school: student.class_school,
    status: student.status,
    campuses_sessions: student.campuses_sessions,
    paid_until: student.paid_until,
    registration_date: student.registration_date,
    tuition_start: student.tuition_start,
    academic_meta: parseAcademicMeta(student.notes),
    study_start: student.study_start,
    study_start_precision: student.study_start_precision
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
function anonymizeNameForPublic(name) {
  if (!name) return "";
  var parts = name.toString().trim().split(/\s+/);
  var masked = [];
  for (var i = 0; i < parts.length; i++) {
    if (i === 0) {
      masked.push(parts[i]);
    } else {
      masked.push(parts[i].charAt(0).toUpperCase() + ".");
    }
  }
  return masked.join(" ");
}

function getPublicSchedule(token) {
  if (!token || token !== generatePublicScheduleToken()) {
    return { success: false, error: "Chu ky lich hoc cong khai khong hop le." };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var studentSheet = ss.getSheetByName("HocSinh");
  var paymentSheet = ss.getSheetByName("HocPhi");
  var students = getSheetRowsAsObjects(studentSheet, STUDENT_HEADERS);
  var payments = getSheetRowsAsObjects(paymentSheet, PAYMENT_HEADERS);
  var latestPaymentByStudent = {};

  for (var p = 0; p < payments.length; p++) {
    var payment = payments[p];
    if (!payment.student_id) continue;
    var paymentStudentId = payment.student_id.toString();
    var currentLatest = latestPaymentByStudent[paymentStudentId];
    if (!currentLatest || (payment.payment_date || "").toString() > (currentLatest.payment_date || "").toString()) {
      latestPaymentByStudent[paymentStudentId] = {
        payment_date: payment.payment_date,
        period_start: payment.period_start,
        period_end: payment.period_end
      };
    }
  }

  var publicStudents = [];
  for (var i = 0; i < students.length; i++) {
    var s = students[i];
    if (s.status === "Đang học") {
      var sid = s.id ? s.id.toString() : "";
      publicStudents.push({
        public_id: "hs_" + (i + 1),
        name: anonymizeNameForPublic(s.name),
        gender: s.gender,
        grade: s.grade,
        school: s.school,
        status: "Đang học",
        campuses_sessions: s.campuses_sessions,
        lastPayment: sid && latestPaymentByStudent[sid] ? latestPaymentByStudent[sid] : null
      });
    }
  }

  return {
    success: true,
    students: publicStudents
  };
}
