/**
 * Rules engine tests. Run with: npm test
 * Uses node:test so there is no test-runner dependency to maintain.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeStanding,
  DEFAULT_RULES,
  eventCounts,
  warningMessage,
  type AttendanceRules,
  type AttendanceStatus,
  type StandingEntry,
} from './index.ts';

const taken = new Date('2026-09-10T19:00:00Z');

function entry(record: AttendanceStatus | null, over: Partial<StandingEntry> = {}): StandingEntry {
  return {
    eventId: Math.random().toString(36).slice(2),
    eventStatus: 'completed',
    attendanceRequired: true,
    attendanceTakenAt: taken,
    record,
    ...over,
  };
}

test('an event only counts when completed, required, and actually recorded', () => {
  assert.equal(eventCounts({ eventStatus: 'completed', attendanceRequired: true, attendanceTakenAt: taken }), true);
  assert.equal(eventCounts({ eventStatus: 'scheduled', attendanceRequired: true, attendanceTakenAt: taken }), false);
  assert.equal(eventCounts({ eventStatus: 'cancelled', attendanceRequired: true, attendanceTakenAt: taken }), false);
  assert.equal(eventCounts({ eventStatus: 'completed', attendanceRequired: false, attendanceTakenAt: taken }), false);
  assert.equal(eventCounts({ eventStatus: 'completed', attendanceRequired: true, attendanceTakenAt: null }), false);
});

test('a cancelled meeting never manufactures an absence', () => {
  const s = computeStanding([entry(null, { eventStatus: 'cancelled' })], DEFAULT_RULES);
  assert.equal(s.absencePoints, 0);
  assert.equal(s.countedEvents, 0);
  assert.equal(s.status, 'active');
});

test('an event nobody took attendance for does not mark the club absent', () => {
  const s = computeStanding([entry(null, { attendanceTakenAt: null })], DEFAULT_RULES);
  assert.equal(s.absencePoints, 0);
  assert.equal(s.status, 'active');
});

test('missing record on a recorded event is "not recorded", not an absence', () => {
  const s = computeStanding([entry(null)], DEFAULT_RULES);
  assert.equal(s.notRecorded, 1);
  assert.equal(s.absencePoints, 0);
});

test('default rules: present/late/excused are free, absent is one point', () => {
  const s = computeStanding(
    [entry('present'), entry('late'), entry('excused'), entry('absent')],
    DEFAULT_RULES,
  );
  assert.equal(s.absencePoints, 1);
  assert.equal(s.present, 1);
  assert.equal(s.late, 1);
  assert.equal(s.excused, 1);
  assert.equal(s.absent, 1);
});

test('the status ladder walks active -> warning -> at risk -> removal required', () => {
  const ladder: Array<[number, string]> = [
    [0, 'active'],
    [1, 'warning'],
    [2, 'at_risk'],
    [3, 'removal_required'],
    [4, 'removal_required'],
  ];
  for (const [absences, expected] of ladder) {
    const entries = Array.from({ length: absences }, () => entry('absent'));
    assert.equal(computeStanding(entries, DEFAULT_RULES).status, expected, `${absences} absences`);
  }
});

test('raising max absences from 3 to 4 rescues a flagged member on recompute', () => {
  const entries = [entry('absent'), entry('absent'), entry('absent')];
  assert.equal(computeStanding(entries, DEFAULT_RULES).status, 'removal_required');
  const relaxed: AttendanceRules = { ...DEFAULT_RULES, maxAbsencePoints: 4 };
  assert.equal(computeStanding(entries, relaxed).status, 'at_risk');
});

test('late can be priced at half an absence', () => {
  const rules: AttendanceRules = { ...DEFAULT_RULES, pointsLate: 0.5 };
  const s = computeStanding([entry('late'), entry('late'), entry('absent')], rules);
  assert.equal(s.absencePoints, 2);
  assert.equal(s.status, 'at_risk');
});

test('fractional points do not drift', () => {
  const rules: AttendanceRules = { ...DEFAULT_RULES, pointsLate: 0.1 };
  const s = computeStanding(Array.from({ length: 3 }, () => entry('late')), rules);
  assert.equal(s.absencePoints, 0.3);
});

test('excuses past the cap are charged at the absent rate', () => {
  const rules: AttendanceRules = { ...DEFAULT_RULES, excusedCap: 2 };
  const s = computeStanding([entry('excused'), entry('excused'), entry('excused')], rules);
  assert.equal(s.absencePoints, 1);
  assert.match(s.reasons.join(' '), /over the cap/);
});

test('percentage is an independent axis and excludes excused events', () => {
  const rules: AttendanceRules = { ...DEFAULT_RULES, minAttendancePct: 0.75 };
  // 2 present, 1 excused -> eligible = 2, pct = 100%, so no penalty.
  const clean = computeStanding([entry('present'), entry('present'), entry('excused')], rules);
  assert.equal(clean.attendancePct, 1);
  assert.equal(clean.status, 'active');

  // 1 present, 1 absent -> 50%, below the minimum, so at risk on 1 point alone.
  const thin = computeStanding([entry('present'), entry('absent')], rules);
  assert.equal(thin.attendancePct, 0.5);
  assert.equal(thin.status, 'at_risk');
});

test('the percentage axis can raise severity but never lowers it', () => {
  const rules: AttendanceRules = { ...DEFAULT_RULES, minAttendancePct: 0.1 };
  const s = computeStanding([entry('absent'), entry('absent'), entry('absent')], rules);
  assert.equal(s.status, 'removal_required');
});

test('removed is sticky and only a human clears it', () => {
  const s = computeStanding([entry('present')], DEFAULT_RULES, { currentStatus: 'removed' });
  assert.equal(s.status, 'removed');
});

test('attendance percentage is null when there is nothing to divide by', () => {
  assert.equal(computeStanding([], DEFAULT_RULES).attendancePct, null);
});

test('warning copy matches the policy language', () => {
  const two = computeStanding([entry('absent'), entry('absent')], DEFAULT_RULES);
  assert.match(warningMessage(two, DEFAULT_RULES)!, /2 of 3 allowed absences/);
  const three = computeStanding([entry('absent'), entry('absent'), entry('absent')], DEFAULT_RULES);
  assert.match(warningMessage(three, DEFAULT_RULES)!, /Removal threshold reached/);
  assert.equal(warningMessage(computeStanding([entry('present')], DEFAULT_RULES), DEFAULT_RULES), null);
});

test('the spec walkthrough: Alex crosses the threshold on the third absence', () => {
  const history: StandingEntry[] = [entry('present'), entry('absent')];
  assert.equal(computeStanding(history, DEFAULT_RULES).status, 'warning');
  history.push(entry('absent'));
  assert.equal(computeStanding(history, DEFAULT_RULES).status, 'at_risk');
  history.push(entry('absent'));
  const final = computeStanding(history, DEFAULT_RULES);
  assert.equal(final.status, 'removal_required');
  assert.equal(final.remaining, 0);
});
