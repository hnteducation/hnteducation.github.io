const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

if (process.argv.includes('--web-only')) {
  require('./check-web.cjs');
  return;
}

const backend = fs.readFileSync('google_apps_script.js', 'utf8');
const html = fs.readFileSync('quanly.html', 'utf8');
new vm.Script(backend);
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(match => !/\bsrc\s*=/.test(match[1]) && !/application\/ld\+json/.test(match[1]));
scripts.forEach((match, i) => new vm.Script(match[2], { filename: `quanly-inline-${i}.js` }));
assert(!/^(?:<<<<<<<|=======|>>>>>>>)/m.test(fs.readFileSync('.gitignore', 'utf8')));

class Sheet {
  constructor() { this.rows = []; }
  appendRow(row) { this.rows.push([...row]); }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return Math.max(0, ...this.rows.map(row => row.length)); }
  getRange(r, c, nr = 1, nc = 1) {
    const range = {
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => this.rows[r + i - 1]?.[c + j - 1] ?? '')),
      setValues: values => { values.forEach((row, i) => row.forEach((value, j) => { this.rows[r + i - 1] ||= []; this.rows[r + i - 1][c + j - 1] = value; })); return range; },
      getValue: () => range.getValues()[0][0],
      setValue: value => range.setValues([[value]]),
      setFontWeight: () => range, setBackground: () => range,
      setNumberFormat: () => range
    };
    return range;
  }
}
const sheets = new Map();
const ss = { getSheetByName: name => sheets.get(name), insertSheet: name => { const sheet = new Sheet(); sheets.set(name, sheet); return sheet; } };
let locked = false;
const context = vm.createContext({
  console, Date,
  SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush() {} },
  Session: { getScriptTimeZone: () => 'Asia/Bangkok' },
  Utilities: { formatDate: date => date.toISOString().slice(0, 10), DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (algorithm, value) => crypto.createHash(algorithm).update(value).digest(), base64EncodeWebSafe: value => Buffer.from(value).toString('base64url') },
  LockService: { getScriptLock: () => ({ tryLock: () => { if (locked) return false; locked = true; return true; }, hasLock: () => locked, releaseLock: () => { locked = false; } }) },
  ContentService: { MimeType: { JSON: 'json', TEXT: 'text' }, createTextOutput: value => ({ value, setMimeType() { return this; } }) }
});
vm.runInContext(backend, context);
context.authenticate = () => ({ role: 'master', accountId: 'master', permissions: { canAddStudent: true, canEditStudent: true, canAddPayment: true, canMassGradeUp: true } });
const request = data => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(data) } }).value);
const input = { name: 'Học sinh thử', birth_date: '2014-01-01', gender: 'Nữ', grade: 7, registration_date: '2026-01-05', tuition_rate: 500000, status: 'Đang học' };
const add = { action: 'addStudent', requestId: 'student-one', studentData: input };
let result = request(add);
assert.equal(result.success, true);
const id = result.student.id;
assert.equal(request(add).student.id, id);
assert.equal(sheets.get('HocSinh').getLastRow(), 2, 'duplicate request must not append');
assert.equal(request({ ...add, studentData: { ...input, name: 'Khác' } }).success, false, 'request ID cannot be reused with different data');
assert.equal(request({ action: 'addStudent', studentData: input }).success, false, 'missing request ID rejected');
assert.equal(locked, false);
const payment = { action: 'addPayment', requestId: 'payment-one', paymentData: { student_id: id, amount: 500000, payment_date: '2026-02-01', period_start: '2026-02-01', period_end: '2026-02-28' } };
assert.equal(request(payment).success, true);
assert.equal(request(payment).payment_id, 10001);
assert.equal(sheets.get('HocPhi').getLastRow(), 2);
const invalidPayment = request({ ...payment, requestId: 'bad-payment', paymentData: { ...payment.paymentData, student_id: 'missing' } });
assert.equal(invalidPayment.success, false);
assert.equal(sheets.get('HocPhi').getLastRow(), 2, 'invalid student cannot create orphan payment');
assert.equal(request({ action: 'updateStudent', requestId: 'pause-one', studentId: id, studentData: { status: 'Tạm nghỉ', status_effective_date: '2026-03-01' } }).success, true);
assert.equal(request({ action: 'updateStudent', requestId: 'return-one', studentId: id, studentData: { status: 'Đang học', status_effective_date: '2026-04-15' } }).success, true);
let student = context.getSheetRowsAsObjects(sheets.get('HocSinh'), context.STUDENT_HEADERS)[0];
assert.equal(student.registration_date, '2026-01-05', 'resume must preserve enrollment');
assert.equal(student.tuition_start, '2026-04-15');
assert.equal(student.paid_until, '2026-02-28', 'payment history retained');
assert.equal(context.parseAcademicMeta(student.notes).status_changes.length, 2);
assert.equal(request({ action: 'updateStudent', requestId: 'bad-date', studentId: id, studentData: { status: 'Tạm nghỉ', status_effective_date: '2026-02-30' } }).success, false);
assert.equal(request({ action: 'massGradeUp', requestId: 'empty-batch', gradeUpData: { mode: 'return_to_study', studentIds: [], effectiveDate: '2026-06-01' } }).success, false);
assert.equal(request({ action: 'updateStudent', requestId: 'pause-two', studentId: id, studentData: { status: 'Tạm nghỉ', status_effective_date: '2026-05-01' } }).success, true);
const batch = { action: 'massGradeUp', requestId: 'return-batch', gradeUpData: { mode: 'return_to_study', studentIds: [id], effectiveDate: '2026-06-01' } };
assert.equal(request(batch).success, true);
request(batch);
student = context.getSheetRowsAsObjects(sheets.get('HocSinh'), context.STUDENT_HEADERS)[0];
assert.equal(student.registration_date, '2026-01-05');
assert.equal(student.tuition_start, '2026-06-01');
assert.equal(context.parseAcademicMeta(student.notes).status_changes.length, 4, 'batch retry must not add history');
assert.equal(request({ action: 'updateStudent', requestId: 'stale-notes', studentId: id, studentData: { name: 'Tên đã sửa', notes: 'Ghi chú từ bản cache cũ', status: 'Đang học' } }).success, true);
student = context.getSheetRowsAsObjects(sheets.get('HocSinh'), context.STUDENT_HEADERS)[0];
assert.equal(context.parseAcademicMeta(student.notes).status_changes.length, 4, 'stale notes must not erase server history');
const pending = context.beginRequestReceipt({ action: 'addPayment', requestId: 'interrupted', paymentData: {} }, { accountId: 'master' });
assert(pending.row);
assert.equal(context.beginRequestReceipt({ action: 'addPayment', requestId: 'interrupted', paymentData: {} }, { accountId: 'master' }).result.uncertain, true);
locked = true;
assert.equal(request(add).retryable, true);
locked = false;

const freeResult = request({ action: 'addStudent', requestId: 'free-student', studentData: { ...input, name: 'Học sinh miễn phí', tuition_rate: 0 } });
assert.equal(freeResult.success, true);
const freeId = freeResult.student.id;
let freeStudent = context.getSheetRowsAsObjects(sheets.get('HocSinh'), context.STUDENT_HEADERS).find(s => s.id === freeId);
assert.equal(freeStudent.tuition_rate, 0, 'numeric zero preserved');
assert.equal(request({ ...payment, requestId: 'free-payment', paymentData: { ...payment.paymentData, student_id: freeId } }).success, false, 'server blocks fees for exempt students');
const enableFees = { action: 'updateStudent', requestId: 'enable-fees', studentId: freeId, studentData: { tuition_rate: 450000, tuition_effective_date: '2026-07-15' } };
assert.equal(request(enableFees).success, true);
request(enableFees);
freeStudent = context.getSheetRowsAsObjects(sheets.get('HocSinh'), context.STUDENT_HEADERS).find(s => s.id === freeId);
assert.equal(freeStudent.registration_date, input.registration_date);
assert.equal(freeStudent.tuition_start, '2026-07-15', 'enabling fees cannot backdate to enrollment');
assert.equal(context.parseAcademicMeta(freeStudent.notes).tuition_changes.length, 2, 'fee retry must not duplicate history');
assert.equal(request({ action: 'updateStudent', requestId: 'bad-rate', studentId: freeId, studentData: { tuition_rate: -1, tuition_effective_date: '2026-08-01' } }).success, false);
assert.equal(request({ action: 'updateStudent', requestId: 'same-positive', studentId: freeId, studentData: { tuition_rate: 500000, tuition_effective_date: '2026-08-01' } }).success, true);
const chargedStudent = context.getSheetRowsAsObjects(sheets.get('HocSinh'), context.STUDENT_HEADERS).find(s => s.id === freeId);
assert.equal(chargedStudent.tuition_start, '2026-07-15', 'positive-to-positive rate change keeps fee anchor');
assert.equal(request({ action: 'updateStudent', requestId: 'free-again', studentId: freeId, studentData: { tuition_rate: 0, tuition_effective_date: '2026-09-01' } }).success, true);
const exemptAgain = context.getSheetRowsAsObjects(sheets.get('HocSinh'), context.STUDENT_HEADERS).find(s => s.id === freeId);
assert.equal(exemptAgain.status, 'Đang học', 'fee exemption must not change enrollment status');

// Run actual frontend functions in an isolated browser-like context.
function fn(name) {
  const match = html.match(new RegExp('        (?:async )?function ' + name + '\\([^]*?\\n        }'));
  assert(match, name);
  return match[0];
}
const storage = new Map();
let requests = [];
const browser = vm.createContext({ console, Date, crypto: crypto.webcrypto, TextEncoder, AbortController,
  setTimeout, clearTimeout,
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  window: { addEventListener() {} }, document: { addEventListener() {} },
  state: { config: { apiUrl: 'https://example.test/exec', sessionToken: 'master.master.123.sig' }, apiProtocolVersion: 4, payments: [] },
  fetch: async (url, options) => {
    requests.push(JSON.parse(options.body));
    if (requests.length === 1) throw new Error('response lost after server write');
    return { ok: true, json: async () => ({ success: true, protocolVersion: 4 }) };
  }
});
browser.DEFAULT_TUITION_RATE = 500000;
vm.runInContext(html.slice(html.indexOf('        const apiFlights'), html.indexOf('        // KHI TRANG WEB')), browser);
['ensureYYYYMMDD', 'formatDateToYYYYMMDD', 'formatDateToVN', 'addDays', 'addMonthsToDate', 'getDaysDifferenceFromToday', 'getTuitionCycleInfo', 'getStudentAcademicMeta', 'getStudentPaymentsForTimelineMonth', 'getStudentTuitionTimelineMonthInfo', 'normalizeStudyStart', 'inferStudyStartPrecision'].forEach(name => vm.runInContext(fn(name), browser));
(async () => {
  const [a, b] = await Promise.all([browser.safeFetch('addPayment', { paymentData: { amount: 42 } }), browser.safeFetch('addPayment', { paymentData: { amount: 42 } })]);
  assert(a.success && b.success);
  assert.equal(requests.length, 2, 'double click shares request plus one retry');
  assert.equal(requests[0].requestId, requests[1].requestId, 'network retry keeps ID');
  await browser.safeFetch('addPayment', { paymentData: { amount: 42 } });
  assert.equal(requests[2].requestId, requests[0].requestId, 'successful group member reuses receipt');
  browser.state.config.sessionToken = 'master.master.456.newsig';
  await browser.safeFetch('addPayment', { paymentData: { amount: 42 } });
  assert.equal(requests[3].requestId, requests[0].requestId, 'login renewal preserves request ID');
  browser.state.apiProtocolVersion = 0;
  browser.fetch = async (url, options) => { requests.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ success: true }) }; };
  await assert.rejects(browser.safeFetch('addStudent', {}), /Apps Script/);
  assert.equal(requests.at(-1).action, 'login', 'legacy backend must never receive mutation');
  const info = browser.getTuitionCycleInfo('2026-02-28', browser.getStudentBillingStart(student), '2026-06-15');
  assert.equal(info.dueStart, '2026-06-01');
  const month = browser.getStudentTuitionTimelineMonthInfo(student, '2026-03-01', '2026-03-31', '2026-06-15');
  assert.equal(month.statusText, 'Tạm nghỉ', 'paused full month must not show missing fees');
  assert.equal(browser.getStudentTuitionTimelineMonthInfo(student, '2026-01-01', '2026-01-31', '2026-06-15').statusText, 'Thiếu phí', 'resume must not erase historical unpaid month');
  assert.equal(browser.getStudentTuitionRate({ tuition_rate: 0 }), 0);
  assert.equal(browser.getStudentTuitionRate({ tuition_rate: '0' }), 0);
  assert.equal(browser.getStudentTuitionRate({ tuition_rate: '' }), 500000);
  assert.equal(browser.getStudentTuitionInfo(exemptAgain).status, 'exempt');
  assert.equal(browser.getStudentTuitionInfo(chargedStudent, '2026-08-15').dueStart, '2026-07-15');
  assert.equal(browser.getStudentExpectedTuition(exemptAgain, '2026-01-01', '2026-09-30'), 0);
  assert.equal(browser.getStudentExpectedTuition(chargedStudent, '2026-01-01', '2026-06-30'), 0, 'no expected revenue before fees start');
  assert.equal(browser.getStudentExpectedTuition(chargedStudent, '2026-01-01', '2026-08-31'), 1000000);
  assert.equal(browser.getStudentTuitionTimelineMonthInfo(chargedStudent, '2026-06-01', '2026-06-30', '2026-10-06').statusText, 'Miễn học phí', 'free history survives enabling fees');
  assert.equal(browser.getStudentTuitionTimelineMonthInfo(exemptAgain, '2026-07-01', '2026-07-31', '2026-10-06').statusText, 'Thiếu phí', 'exemption keeps earlier chargeable history');
  assert.equal(browser.getStudentTuitionTimelineMonthInfo(exemptAgain, '2026-09-01', '2026-09-30', '2026-10-06').statusText, 'Miễn học phí');
  browser.state.selectedStudent = exemptAgain;
  let notice;
  browser.showToast = (...args) => { notice = args; };
  browser.navigator = { clipboard: { writeText() { throw new Error('must not draft reminder for exempt student'); } } };
  vm.runInContext(fn('draftTuitionReminderMsg'), browser);
  browser.draftTuitionReminderMsg();
  assert.equal(notice[1], 'Không nhắc học phí');
  console.log('PASS: syntax, receipts, retries, enrollment history, batch resume, exemptions, free-to-paid billing, fee history, revenue, reminder guard.');
})().catch(error => { console.error(error); process.exitCode = 1; });
