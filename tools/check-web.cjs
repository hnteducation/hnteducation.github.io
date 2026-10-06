const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const html = fs.readFileSync('quanly.html', 'utf8');
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (!/\bsrc\s*=/.test(match[1]) && !/application\/ld\+json/.test(match[1])) new vm.Script(match[2]);
}
assert(!/^(?:<<<<<<<|=======|>>>>>>>)/m.test(fs.readFileSync('.gitignore', 'utf8')));

const context = vm.createContext({ Date, console, DEFAULT_TUITION_RATE: 500000, state: { payments: [] } });
const names = ['getStudentBillingStart', 'getStudentTuitionRate', 'isTuitionExempt', 'getStudentTuitionInfo', 'getStudentExpectedTuition', 'paymentISODate', 'paymentMonthBoundary', 'paymentAddDays', 'splitPaymentPeriod', 'allocatePaymentAmount', 'assertPaymentPeriodAllowed', 'ensureYYYYMMDD', 'formatDateToYYYYMMDD', 'formatDateToVN', 'addDays', 'addMonthsToDate', 'getDaysDifferenceFromToday', 'getTuitionCycleInfo', 'getStudentAcademicMeta', 'getStudentPaymentsForTimelineMonth', 'getStudentPaidMonthCoverage', 'getStudentTuitionTimelineMonthInfo', 'normalizeStudyStart', 'inferStudyStartPrecision', 'draftTuitionReminderMsg'];
for (const name of names) {
  const match = html.match(new RegExp('        (?:async )?function ' + name + '\\([^]*?\\n        }'));
  assert(match, `Missing function: ${name}`);
  vm.runInContext(match[0], context);
}

const free = { id: 'free', status: 'Đang học', tuition_rate: 0, registration_date: '2026-01-01' };
const charged = { ...free, tuition_rate: 500000, tuition_start: '2026-07-15', academic_meta: { status_changes: [], tuition_changes: [{ type: 'initial_rate', effective_date: '2026-01-01', to_rate: 0 }, { type: 'rate_change', effective_date: '2026-07-15', from_rate: 0, to_rate: 500000 }] } };
assert.equal(context.getStudentTuitionRate(free), 0);
assert.equal(context.getStudentTuitionRate({ tuition_rate: '0' }), 0);
assert.equal(context.getStudentTuitionRate({ tuition_rate: '' }), 500000);
assert.equal(context.getStudentTuitionInfo(free).status, 'exempt');
assert.equal(context.getStudentExpectedTuition(free, '2026-01-01', '2026-12-31'), 0);
assert.equal(context.getStudentExpectedTuition(charged, '2026-01-01', '2026-06-30'), 0);
assert.equal(context.getStudentExpectedTuition(charged, '2026-01-01', '2026-08-31'), 1000000);
assert.equal(context.getStudentTuitionInfo(charged, '2026-07-20').dueStart, '2026-07-15');
assert.equal(context.getStudentTuitionTimelineMonthInfo(charged, '2026-06-01', '2026-06-30', '2026-08-01').statusText, 'Miễn học phí');
context.state.selectedStudent = free;
let notice;
context.showToast = (...args) => { notice = args; };
context.navigator = { clipboard: { writeText() { throw new Error('Exempt student must not receive a reminder'); } } };
context.draftTuitionReminderMsg();
assert.equal(notice[1], 'Không nhắc học phí');
console.log('PASS: web syntax, exemptions, fee start dates, fee history, expected revenue, reminder guard. No local backend required.');

for (const name of ['getPaymentPeriodLabel', 'getSuggestedPaymentPeriod', 'getStudentLatestAcademicStatus', 'buildQuickPaymentPlan', 'updateQuickPaymentPlan', 'escapeHtml']) {
  const match = html.match(new RegExp('        (?:async )?function ' + name + '\\([^]*?\\n        }'));
  assert(match, name);
  vm.runInContext(match[0], context);
}
const fields = Object.fromEntries(['qp-period-start', 'qp-period-end', 'qp-cycle-months', 'qp-amount', 'qp-amount-display', 'qp-note', 'qp-note-suggestion', 'qp-payment-preview'].map(id => [id, { value: '', dataset: {}, textContent: '', innerHTML: '' }]));
context.document = { getElementById: id => fields[id] };
context.state.selectedStudent = { id: 'primary', name: 'A', status: 'Đang học', tuition_rate: 400000, registration_date: '2026-01-01', paid_until: '2026-01-31' };
context.state.groupPaymentStudents = [{ id: 'secondary', name: 'B', status: 'Đang học', tuition_rate: 600000, registration_date: '2026-01-01', tuition_start: '2026-03-10', paid_until: '2026-01-31' }];
fields['qp-period-start'].value = '2026-02-01';
fields['qp-period-end'].value = '2026-03-15';
fields['qp-cycle-months'].value = '1.5';
let plan = context.buildQuickPaymentPlan();
assert.equal(plan[0].amount, 600000);
assert.equal(plan[1].amount, 900000);
assert.equal(plan[1].start, '2026-03-10', 'group student uses own resume date');
assert.equal(plan[1].end, '2026-04-24');
assert.equal(plan[0].parts[0].amount, 400000);
assert.equal(plan[0].parts[1].amount, 200000);
assert.equal(plan[0].parts[1].days, 15);
context.updateQuickPaymentPlan();
assert.match(fields['qp-note'].value, /^Đóng học phí tháng 2\/2026, 3\/2026/);
assert.match(fields['qp-note'].value, /tháng 3\/2026: 01\/03\/2026–15\/03\/2026/);
fields['qp-note'].value = 'Ghi chú riêng của thầy';
fields['qp-cycle-months'].value = '3';
fields['qp-period-end'].value = '2026-04-30';
context.updateQuickPaymentPlan();
assert.equal(fields['qp-note'].value, 'Ghi chú riêng của thầy', 'manual notes survive changes');
assert.match(fields['qp-note-suggestion'].textContent, /2\/2026.*4\/2026/);
assert.equal(context.buildQuickPaymentPlan()[0].parts.length, 3);
assert.equal(context.paymentMonthBoundary('2024-01-31', 1), '2024-02-29');
assert.equal(context.paymentMonthBoundary('2026-01-31', 1), '2026-02-28');
assert.equal(context.ensureYYYYMMDD(context.addMonthsToDate(new Date('2026-01-31'), 1)), '2026-02-27');
assert.throws(() => context.splitPaymentPeriod('2026-02-30', '2026-03-31'), /không tồn tại/);
assert.throws(() => context.splitPaymentPeriod('2026-04-01', '2026-03-31'), /kết thúc/);
context.state.quickAmountManual = true;
fields['qp-amount'].value = '1000001';
plan = context.buildQuickPaymentPlan();
assert.equal(plan[0].amount + plan[1].amount, 1000001);
assert.equal(plan[0].parts.reduce((sum, part) => sum + part.amount, 0), plan[0].amount);
assert.equal(plan[1].parts.reduce((sum, part) => sum + part.amount, 0), plan[1].amount);
context.state.quickPaymentOverrides = { primary: { amount: 333333 }, secondary: { start: '2026-03-20', end: '2026-05-05' } };
plan = context.buildQuickPaymentPlan();
assert.equal(plan[0].amount, 333333);
assert.equal(plan[1].amount, 666668);
assert.equal(plan[1].start, '2026-03-20');
assert.equal(plan[1].end, '2026-05-05');
const paused = { id: 'paused', name: 'C', status: 'Tạm nghỉ', tuition_rate: 500000, registration_date: '2026-01-01', paid_until: '2026-03-31', notes: '===ACADEMIC=== ' + JSON.stringify({ status_changes: [{ type: 'pause', effective_date: '2026-04-10' }] }) };
assert.equal(context.getSuggestedPaymentPeriod(paused, '1').end, '2026-04-09');
assert.throws(() => context.assertPaymentPeriodAllowed(paused, '2026-04-01', '2026-04-30', context.getStudentAcademicMeta(paused.notes)), /thời gian nghỉ/);
assert.equal(context.getPaymentPeriodLabel('2026-12-01', '2027-02-28'), 'tháng 12/2026, 1/2027, 2/2027');
assert.equal(context.getPaymentPeriodLabel('2026-07-01', '2026-07-31'), 'tháng 7/2026');
assert.equal(context.getPaymentPeriodLabel('2026-07-15', '2026-08-14'), 'tháng 7/2026, 8/2026 (tháng 7/2026: 15/07/2026–31/07/2026; tháng 8/2026: 01/08/2026–14/08/2026)');
const monthStudent = { id: 'months', status: 'Đang học', tuition_rate: 500000, registration_date: '2026-01-01', payments: [{ period_start: '2026-02-01', period_end: '2026-03-15' }] };
assert.equal(context.getStudentTuitionTimelineMonthInfo(monthStudent, '2026-02-01', '2026-02-28').statusText, 'Đã đóng');
assert.equal(context.getStudentTuitionTimelineMonthInfo(monthStudent, '2026-03-01', '2026-03-31').statusText, 'Đóng một phần');
monthStudent.payments.push({ period_start: '2026-03-16', period_end: '2026-03-31' });
assert.equal(context.getStudentTuitionTimelineMonthInfo(monthStudent, '2026-03-01', '2026-03-31').statusText, 'Đã đóng', 'separate receipts can complete a calendar month');
const pausedMonth = { ...paused, payments: [{ period_start: '2026-04-01', period_end: '2026-04-09' }] };
assert.equal(context.getStudentTuitionTimelineMonthInfo(pausedMonth, '2026-04-01', '2026-04-30').statusText, 'Đã đóng', 'days after the pause are not fee-bearing');
const resumedMonth = { ...pausedMonth, status: 'Đang học', notes: '===ACADEMIC=== ' + JSON.stringify({ status_changes: [{ type: 'pause', effective_date: '2026-04-10' }, { type: 'return_to_study', effective_date: '2026-04-20' }] }) };
assert.equal(context.getStudentTuitionTimelineMonthInfo(resumedMonth, '2026-04-01', '2026-04-30').statusText, 'Đóng một phần');
resumedMonth.payments.push({ period_start: '2026-04-20', period_end: '2026-04-30' });
assert.equal(context.getStudentTuitionTimelineMonthInfo(resumedMonth, '2026-04-01', '2026-04-30').statusText, 'Đã đóng');
const startedFeesMidMonth = { id: 'fee-start', status: 'Đang học', tuition_rate: 500000, registration_date: '2026-01-01', academic_meta: { status_changes: [], tuition_changes: [{ type: 'initial_rate', effective_date: '2026-01-01', to_rate: 0 }, { type: 'rate_change', effective_date: '2026-06-15', from_rate: 0, to_rate: 500000 }] }, payments: [{ period_start: '2026-06-15', period_end: '2026-06-30' }] };
assert.equal(context.getStudentTuitionTimelineMonthInfo(startedFeesMidMonth, '2026-06-01', '2026-06-30').statusText, 'Đã đóng', 'days of exemption before fee start are not missing');
console.log('PASS: calendar-month notes, partial months, merged receipts, pauses and returns in the monthly timeline.');
console.log('PASS: 1.5/3-month plans, custom group dates, weighted allocation, exact totals, manual notes, end-of-month/leap dates, paused students.');

for (const name of ['getPendingPaymentStorageKey', 'refreshPendingPaymentNotice', 'sendPaymentBatch', 'resumePendingPaymentBatch']) {
  const match = html.match(new RegExp('        (?:async )?function ' + name + '\\([^]*?\\n        }'));
  vm.runInContext(match[0], context);
}
const pendingStorage = new Map();
context.localStorage = { getItem: key => pendingStorage.get(key) || null, setItem: (key, value) => pendingStorage.set(key, value), removeItem: key => pendingStorage.delete(key) };
context.state.config = { apiUrl: 'https://example.test/exec', sessionToken: 'master.master.123.sig' };
context.showLoader = () => {};
context.hideLoader = () => {};
context.clearSelectedStudent = () => { context.state.selectedStudent = null; };
context.fetchDataFromServer = async () => {};
context.requireClientPermission = () => true;
context.isConfigured = () => true;
context.confirm = () => true;
let attempts = [];
context.safeFetch = async (action, payload) => {
  attempts.push(JSON.parse(JSON.stringify(payload.payments)));
  return attempts.length === 1 ? { success: false, uncertain: true, error: 'Lost confirmation' } : { success: true };
};
(async () => {
  const pending = [{ student_id: 'primary', student_name: 'A', amount: 600000, period_start: '2026-02-01', period_end: '2026-03-15' }];
  await context.sendPaymentBatch(pending);
  assert.equal(pendingStorage.size, 1, 'unknown result must preserve pending payload');
  const originalKey = context.getPendingPaymentStorageKey();
  context.state.config.sessionToken = 'master.master.456.newsig';
  assert.equal(context.getPendingPaymentStorageKey(), originalKey, 'session renewal preserves recovery key');
  context.state.selectedStudent = { id: 'other', name: 'Different form selection' };
  await context.resumePendingPaymentBatch();
  assert.deepEqual(attempts[1], attempts[0], 'recovery uses saved payload despite later form changes');
  assert.equal(pendingStorage.size, 0, 'confirmed result clears pending payload');
  console.log('PASS: uncertain batch recovery, session renewal, saved payload, confirmed cleanup.');
})().catch(error => { console.error(error); process.exitCode = 1; });
