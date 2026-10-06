const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const html = fs.readFileSync('quanly.html', 'utf8');
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (!/\bsrc\s*=/.test(match[1]) && !/application\/ld\+json/.test(match[1])) new vm.Script(match[2]);
}
assert(!/^(?:<<<<<<<|=======|>>>>>>>)/m.test(fs.readFileSync('.gitignore', 'utf8')));

const context = vm.createContext({ Date, console, DEFAULT_TUITION_RATE: 500000, state: { payments: [] } });
const names = ['getStudentBillingStart', 'getStudentTuitionRate', 'isTuitionExempt', 'getStudentTuitionInfo', 'getStudentExpectedTuition', 'ensureYYYYMMDD', 'formatDateToYYYYMMDD', 'formatDateToVN', 'addDays', 'addMonthsToDate', 'getDaysDifferenceFromToday', 'getTuitionCycleInfo', 'getStudentAcademicMeta', 'getStudentPaymentsForTimelineMonth', 'getStudentTuitionTimelineMonthInfo', 'normalizeStudyStart', 'inferStudyStartPrecision', 'draftTuitionReminderMsg'];
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
