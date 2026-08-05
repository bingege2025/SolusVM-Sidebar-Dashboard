/**
 * Expiry reminder engine — pure, side-effect-free, unit-testable in Node.
 *
 * Design goals (per product spec):
 *  - Multi-threshold reminders: notify when a server first crosses each
 *    threshold window (e.g. 30 / 7 / 3 days before expiry).
 *  - Dedupe: a threshold fires only once per "crossing", not every 6h cycle.
 *  - Renewal / date-edit resets: clearing the window re-arms the reminder.
 *  - Expired servers: remind once per calendar day until acknowledged/removed.
 *
 * computeReminders() takes the current server list + persistent state and
 * returns the notifications to fire *now* plus the next state to persist.
 */

function reminderDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Days remaining from `now` to `expiryDate` (local midnight-aligned).
function reminderDaysLeft(expiryDate, now) {
  if (!expiryDate || typeof expiryDate !== 'string') return null;
  const exp = new Date(expiryDate.length === 10 ? expiryDate + 'T00:00:00' : expiryDate);
  if (isNaN(exp.getTime())) return null;
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((exp.getTime() - base.getTime()) / 86400000);
}

// servers: [{ id, name, expiryDate, expiryDisabled }]
// opts: { thresholds: number[], now: Date, state: {} }
// returns { toNotify: [{ serverId, name, threshold, daysLeft, level }], nextState: {} }
function computeReminders(servers, opts) {
  const thresholds = (opts.thresholds || []).slice().sort((a, b) => a - b);
  const now = opts.now || new Date();
  const today = reminderDateStr(now);
  const prevState = opts.state || {};
  const nextState = {};
  const toNotify = [];

  (servers || []).forEach(server => {
    if (server.expiryDisabled) return;
    const daysLeft = reminderDaysLeft(server.expiryDate, now);
    if (daysLeft === null) return;

    const prev = prevState[server.id] || { thresholds: {}, expired: null };
    const cur = { thresholds: {}, expired: null };
    const seenBefore = prevState[server.id] !== undefined;

    // Expired: daily reminder.
    if (daysLeft < 0) {
      if (prev.expired !== today) {
        toNotify.push({
          serverId: server.id,
          name: server.name,
          threshold: null,
          daysLeft,
          level: 'expired'
        });
      }
      cur.expired = today;
    } else {
      cur.expired = null;
    }

    if (!seenBefore) {
      // First time this server is seen: notify only for the most urgent
      // *active* threshold (avoids a 3-at-once burst for late-added servers).
      if (daysLeft >= 0) {
        const active = thresholds.filter(T => daysLeft <= T);
        if (active.length) {
          const T = active[0];
          toNotify.push({
            serverId: server.id,
            name: server.name,
            threshold: T,
            daysLeft,
            level: 'warning'
          });
          cur.thresholds[T] = daysLeft;
        }
      }
      // Seed remaining thresholds so re-arm works as the date counts down.
      thresholds.forEach(T => {
        if (!(T in cur.thresholds)) cur.thresholds[T] = daysLeft;
      });
    } else {
      thresholds.forEach(T => {
        const last = (typeof prev.thresholds[T] === 'number') ? prev.thresholds[T] : undefined;
        if (daysLeft <= T) {
          // Crossing: first time entering the window (or after a re-arm).
          if (last === undefined || last > T) {
            toNotify.push({
              serverId: server.id,
              name: server.name,
              threshold: T,
              daysLeft,
              level: 'warning'
            });
          }
          cur.thresholds[T] = daysLeft;
        } else {
          // Outside the window → re-arm for the next crossing.
          cur.thresholds[T] = daysLeft;
        }
      });
    }

    nextState[server.id] = cur;
  });

  // Keep state for servers that disappeared (so re-adding doesn't re-spam),
  // but prune servers no longer present AND not referenced by nextState.
  Object.keys(prevState).forEach(id => {
    if (!nextState[id]) nextState[id] = prevState[id];
  });

  return { toNotify, nextState };
}
