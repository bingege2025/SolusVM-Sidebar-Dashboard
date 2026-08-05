const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadReminder() {
  const context = { console, Date };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'expiry-reminder.js'), 'utf8'), context, { filename: 'expiry-reminder.js' });
  return context;
}

// Build a `now` Date in local time at noon, and a local-date string shifted by N days.
function makeNow(y, m, d) { return new Date(y, m - 1, d, 12, 0, 0); }
function shift(base, days) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function run() {
  const c = loadReminder();
  const TH = [3, 7, 30];

  // --- Scenario A: countdown crosses 30 → 7/3 → expired, with dedupe ---
  const now = makeNow(2026, 8, 4);
  const server = { id: 's1', name: 'Node', expiryDate: shift(now, 10) }; // 10 days out

  // First check: only the smallest ACTIVE threshold (30) fires.
  let r = c.computeReminders([server], { thresholds: TH, now, state: {} });
  assert.strictEqual(r.toNotify.length, 1, 'A1: one notification on first sight');
  assert.strictEqual(r.toNotify[0].threshold, 30, 'A1: notifies at 30-day threshold');
  assert.strictEqual(r.toNotify[0].level, 'warning', 'A1: level warning');

  // Second check, 7 days later (daysLeft = 3): both 7 and 3 windows were crossed.
  const now2 = makeNow(2026, 8, 11);
  let r2 = c.computeReminders([{ id: 's1', name: 'Node', expiryDate: shift(now2, 3) }],
    { thresholds: TH, now: now2, state: r.nextState });
  const thr2 = r2.toNotify.map(n => n.threshold).sort((a, b) => a - b);
  assert.strictEqual(thr2.length, 2, 'A2: two windows fire');
  assert.ok(thr2.indexOf(3) !== -1 && thr2.indexOf(7) !== -1, 'A2: crossing 7 and 3 windows both fire');
  assert.strictEqual(r2.toNotify.find(n => n.threshold === 7).level, 'warning', 'A2: warning level');

  // Same day re-check (no date change) → no duplicate notifications.
  const r2b = c.computeReminders([{ id: 's1', name: 'Node', expiryDate: shift(now2, 3) }],
    { thresholds: TH, now: now2, state: r2.nextState });
  assert.strictEqual(r2b.toNotify.length, 0, 'A3: no duplicate on same day');

  // Expired: 1 day later → daily expired notification.
  const now3 = makeNow(2026, 8, 12);
  const r3 = c.computeReminders([{ id: 's1', name: 'Node', expiryDate: shift(now3, -1) }],
    { thresholds: TH, now: now3, state: r2b.nextState });
  assert.strictEqual(r3.toNotify.length, 1, 'A4: expired fires once');
  assert.strictEqual(r3.toNotify[0].level, 'expired', 'A4: expired level');
  assert.ok(r3.toNotify[0].daysLeft < 0, 'A4: negative daysLeft');

  // Expired: same day again → dedupe (no second notification).
  const r3b = c.computeReminders([{ id: 's1', name: 'Node', expiryDate: shift(now3, -1) }],
    { thresholds: TH, now: now3, state: r3.nextState });
  assert.strictEqual(r3b.toNotify.length, 0, 'A5: expired dedupe same day');

  // Expired: next calendar day → fires again (daily).
  const now4 = makeNow(2026, 8, 13);
  const r4 = c.computeReminders([{ id: 's1', name: 'Node', expiryDate: shift(now4, -2) }],
    { thresholds: TH, now: now4, state: r3b.nextState });
  assert.strictEqual(r4.toNotify.length, 1, 'A6: expired fires next day');

  // --- Scenario B: disabled server never notifies ---
  const rB = c.computeReminders([{ id: 's2', name: 'Off', expiryDate: shift(now, 1), expiryDisabled: true }],
    { thresholds: TH, now, state: {} });
  assert.strictEqual(rB.toNotify.length, 0, 'B: disabled server produces no notification');

  // --- Scenario C: server with no expiry date is ignored ---
  const rC = c.computeReminders([{ id: 's3', name: 'NoDate' }],
    { thresholds: TH, now, state: {} });
  assert.strictEqual(rC.toNotify.length, 0, 'C: missing date ignored');

  // --- Scenario D: late-added server (already inside 3-day window) notifies once for 3 ---
  const rD = c.computeReminders([{ id: 's4', name: 'Late', expiryDate: shift(now, 2) }],
    { thresholds: TH, now, state: {} });
  assert.strictEqual(rD.toNotify.length, 1, 'D: late server notifies once');
  assert.strictEqual(rD.toNotify[0].threshold, 3, 'D: notifies at nearest threshold (3)');

  console.log('expiry-reminder tests passed');
}

try { run(); } catch (err) { console.error(err); process.exit(1); }
