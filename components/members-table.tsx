'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { MEMBER_STATUSES, STATUS_LABELS, type MemberStatus } from '@/lib/rules';
import { ROLE_LABELS, type Role } from '@/lib/permissions';
import { Avatar, StatusBadge } from './ui';

export interface MemberRow {
  id: string;
  displayName: string;
  email: string;
  role: string;
  status: MemberStatus;
  joinedOn: string;
  attended: number;
  missed: number;
  countedEvents: number;
  attendancePct: number | null;
  absencePoints: number;
  hasAccount: boolean;
  photo: string | null;
}

type SortKey = 'displayName' | 'role' | 'joinedOn' | 'attended' | 'missed' | 'attendancePct' | 'absencePoints' | 'status';

const COLUMNS: Array<{ key: SortKey; label: string; align?: 'right' }> = [
  { key: 'displayName', label: 'Member' },
  { key: 'role', label: 'Role' },
  { key: 'joinedOn', label: 'Joined' },
  { key: 'attended', label: 'Attended', align: 'right' },
  { key: 'missed', label: 'Missed', align: 'right' },
  { key: 'attendancePct', label: 'Attendance', align: 'right' },
  { key: 'absencePoints', label: 'Absences', align: 'right' },
  { key: 'status', label: 'Status' },
];

export function MembersTable({
  slug, rows, maxAbsences,
}: { slug: string; rows: MemberRow[]; maxAbsences: number }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | MemberStatus>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'displayName', dir: 1 });

  const counts = useMemo(() => {
    const c = Object.fromEntries(MEMBER_STATUSES.map((s) => [s, 0])) as Record<MemberStatus, number>;
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter(
      (r) =>
        (status === 'all' || r.status === status) &&
        (!q || `${r.displayName} ${r.email} ${r.role}`.toLowerCase().includes(q)),
    );
    return filtered.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av === bv) return a.displayName.localeCompare(b.displayName);
      if (av === null) return 1;
      if (bv === null) return -1;
      return (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))) * sort.dir;
    });
  }, [rows, query, status, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === 1 ? -1 : 1 }));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="input w-full sm:w-64"
          placeholder="Search name, email or role…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={status === 'all'} onClick={() => setStatus('all')} label={`All ${rows.length}`} />
          {MEMBER_STATUSES.filter((s) => counts[s] > 0).map((s) => (
            <FilterChip
              key={s}
              active={status === s}
              onClick={() => setStatus(s)}
              label={`${STATUS_LABELS[s]} ${counts[s]}`}
            />
          ))}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-4xl">
          <thead className="border-b border-line bg-canvas">
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className={`th ${c.align === 'right' ? 'text-right' : ''}`}>
                  <button
                    className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink-900"
                    onClick={() => toggleSort(c.key)}
                  >
                    {c.label}
                    <span aria-hidden className={sort.key === c.key ? 'opacity-100' : 'opacity-0'}>
                      {sort.dir === 1 ? '↑' : '↓'}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((r) => (
              <tr key={r.id} className="hover:bg-line-soft">
                <td className="td">
                  <Link href={`/c/${slug}/members/${r.id}`} className="flex items-center gap-2.5">
                    <Avatar name={r.displayName} photo={r.photo} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink-900">{r.displayName}</span>
                      <span className="block truncate text-xs text-ink-400">
                        {r.email}
                        {!r.hasAccount ? ' · no account yet' : ''}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="td whitespace-nowrap">{ROLE_LABELS[r.role as Role] ?? r.role}</td>
                <td className="td whitespace-nowrap text-ink-500">{r.joinedOn}</td>
                <td className="td text-right tabular-nums">{r.attended}</td>
                <td className="td text-right tabular-nums">{r.missed}</td>
                <td className="td text-right tabular-nums">
                  {r.attendancePct === null ? '—' : `${Math.round(r.attendancePct * 100)}%`}
                </td>
                <td className="td text-right tabular-nums font-medium">
                  <span className={r.absencePoints >= maxAbsences ? 'text-[#8d2820]' : r.absencePoints >= maxAbsences - 1 ? 'text-[#a8501f]' : ''}>
                    {r.absencePoints} / {maxAbsences}
                  </span>
                </td>
                <td className="td"><StatusBadge status={r.status} /></td>
              </tr>
            ))}
            {shown.length === 0 ? (
              <tr><td className="td py-10 text-center text-ink-400" colSpan={COLUMNS.length}>No members match.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`btn btn-sm ring-1 ${active ? 'bg-brand text-white ring-brand' : 'bg-surface text-ink-700 ring-line hover:bg-line-soft'}`}
    >
      {label}
    </button>
  );
}
