/** "Fall 2026" / "Spring 2027" / "Summer 2026" from a date. */
export function currentTerm(now = new Date()): { name: string; startsOn: Date; endsOn: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  if (m >= 8) return { name: `Fall ${y}`, startsOn: new Date(Date.UTC(y, 7, 15)), endsOn: new Date(Date.UTC(y, 11, 20)) };
  if (m <= 5) return { name: `Spring ${y}`, startsOn: new Date(Date.UTC(y, 0, 10)), endsOn: new Date(Date.UTC(y, 4, 15)) };
  return { name: `Summer ${y}`, startsOn: new Date(Date.UTC(y, 4, 16)), endsOn: new Date(Date.UTC(y, 7, 14)) };
}
