const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Load the standalone module (no chrome / DOM needed for buildICS).
function loadICS() {
  const context = { console, Date, Blob: function () {}, URL: { createObjectURL() {}, revokeObjectURL() {} }, document: { createElement() { return { click() {}, remove() {}, style: {} }; }, body: { appendChild() {} } } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'ics-generator.js'), 'utf8'), context, { filename: 'ics-generator.js' });
  return context;
}

function run() {
  const c = loadICS();

  // 1) Basic structure for a single server with 3 thresholds
  const ics = c.buildICS([{
    id: 'server_1',
    name: 'LA Node',
    providerName: 'SolusVM v1',
    url: 'https://panel.example.com',
    expiryDate: '2026-09-01'
  }], { thresholds: [3, 7, 30] });

  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'), 'must start with VCALENDAR');
  assert.ok(ics.includes('VERSION:2.0'), 'has VERSION');
  assert.ok(ics.includes('BEGIN:VEVENT'), 'has VEVENT');
  assert.ok(ics.includes('END:VEVENT'), 'closes VEVENT');
  assert.ok(ics.includes('END:VCALENDAR'), 'closes VCALENDAR');
  // DTSTART/DTEND all-day values
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20260901'), 'DTSTART is YYYYMMDD');
  assert.ok(ics.includes('DTEND;VALUE=DATE:20260902'), 'DTEND is expiry + 1 day');
  // 3 VALARMs (one per threshold)
  const alarmCount = (ics.match(/BEGIN:VALARM/g) || []).length;
  assert.strictEqual(alarmCount, 3, 'one VALARM per threshold');
  assert.ok(ics.includes('TRIGGER:-P30D'), 'has 30-day trigger');
  assert.ok(ics.includes('TRIGGER:-P7D'), 'has 7-day trigger');
  assert.ok(ics.includes('TRIGGER:-P3D'), 'has 3-day trigger');
  assert.ok(ics.includes('UID:vps-dashboard-server_1@vps-dashboard'), 'stable UID');

  // 2) Text escaping (semicolon / comma / newline)
  const esc = c.escapeICalText('a;b,c\nd');
  assert.strictEqual(esc, 'a\\;b\\,c\\nd', 'escapes ; , and newline');

  // 3) Invalid / missing expiry dates are skipped
  const filtered = c.buildICS([
    { id: 'a', name: 'NoDate', expiryDate: '' },
    { id: 'b', name: 'Bad', expiryDate: 'not-a-date' },
    { id: 'c', name: 'Good', expiryDate: '2026-12-31' }
  ], { thresholds: [7] });
  assert.ok(filtered.includes('UID:vps-dashboard-c@vps-dashboard'), 'keeps valid server');
  assert.ok(!filtered.includes('UID:vps-dashboard-a@vps-dashboard'), 'drops empty date');
  assert.ok(!filtered.includes('UID:vps-dashboard-b@vps-dashboard'), 'drops invalid date');

  // 4) Empty server list → valid empty calendar
  const empty = c.buildICS([], { thresholds: [3, 7, 30] });
  assert.ok(empty.startsWith('BEGIN:VCALENDAR') && empty.trim().endsWith('END:VCALENDAR'), 'empty calendar still well-formed');

  console.log('ics-generator tests passed');
}

try { run(); } catch (err) { console.error(err); process.exit(1); }
