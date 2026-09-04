'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { logout } from '@/app/actions/auth';
import { can, ROLE_LABELS, type Capability, type Role } from '@/lib/permissions';
import { Chakana, Greca } from '@/components/landing/scene';

const NAV: Array<{ href: string; label: string; es: string; icon: string; capability?: Capability }> = [
  { href: '', label: 'Dashboard', es: 'Panel', icon: '▦' },
  { href: '/calendar', label: 'Calendar', es: 'Calendario', icon: '▤' },
  { href: '/nosotros', label: 'Our people', es: 'Conócenos', icon: '❋' },
  { href: '/members', label: 'Members', es: 'Padrón', icon: '☰', capability: 'members:view_all' },
  { href: '/attendance', label: 'Attendance', es: 'Asistencia', icon: '✓', capability: 'attendance:take' },
  { href: '/events', label: 'Events', es: 'Eventos', icon: '◷' },
  { href: '/analytics', label: 'Analytics', es: 'Análisis', icon: '◔', capability: 'analytics:view' },
  { href: '/settings', label: 'Settings', es: 'Ajustes', icon: '⚙', capability: 'club:settings' },
];

const MEMBER_NAV = [
  { href: '/me', label: 'My attendance', es: 'Mi asistencia', icon: '☺' },
  { href: '/nosotros', label: 'Our people', es: 'Conócenos', icon: '❋' },
  { href: '/checkin', label: 'Check in', es: 'Registrarme', icon: '✓' },
  { href: '/calendar', label: 'Calendar', es: 'Calendario', icon: '▤' },
  { href: '/events', label: 'Events', es: 'Eventos', icon: '◷' },
];

export function Sidebar({
  slug, clubName, clubEmoji, semesterName, userName, role, attentionCount,
}: {
  slug: string;
  clubName: string;
  clubEmoji: string;
  semesterName: string | null;
  userName: string;
  role: string;
  attentionCount: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const base = `/c/${slug}`;
  const isOfficer = can(role, 'members:view_all');
  const links = isOfficer ? NAV.filter((i) => !i.capability || can(role, i.capability)) : MEMBER_NAV;

  return (
    <>
      {/* Mobile bar */}
      <div className="flex items-center justify-between bg-noche px-4 py-3 lg:hidden">
        <span className="flex items-center gap-2.5">
          <Chakana className="h-5 w-5 fill-inti" />
          <span className="display text-lg text-[#f6f1e7]">{clubName}</span>
        </span>
        <button
          className="micro rounded-full border border-[#f6f1e7]/30 px-3 py-1.5 text-[#f6f1e7]"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? 'Cerrar' : 'Menú'}
        </button>
      </div>

      <aside
        className={`${open ? 'block' : 'hidden'} w-full shrink-0 flex-col bg-noche lg:flex lg:w-64`}
      >
        <div className="hidden px-5 pb-4 pt-6 lg:block">
          <Link href="/" className="flex items-center gap-3">
            <Chakana className="h-7 w-7 shrink-0 fill-inti" />
            <span className="min-w-0">
              <span className="display block truncate text-xl leading-tight text-[#f6f1e7]">{clubName}</span>
              <span className="micro block text-[#f6f1e7]/40">{clubEmoji} Tawantinsuyu</span>
            </span>
          </Link>
        </div>
        <Greca className="hidden h-2 w-full text-[#e0b45f]/25 lg:block" />

        <nav className="flex flex-1 flex-col gap-0.5 p-3">
          {links.map((item) => {
            const href = `${base}${item.href}`;
            const active = item.href === ''
              ? pathname === base
              : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={item.href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                  active ? 'bg-[#f6f1e7]/[0.07]' : 'hover:bg-[#f6f1e7]/[0.04]'
                }`}
              >
                {/* Gold rule marks the current page, like a course line in a wall. */}
                <span
                  className={`absolute inset-y-2 left-0 w-0.5 rounded-full bg-inti transition-opacity ${
                    active ? 'opacity-100' : 'opacity-0'
                  }`}
                  aria-hidden
                />
                <span aria-hidden className={`w-4 text-center text-sm ${active ? 'text-inti' : 'text-[#f6f1e7]/35'}`}>
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-medium ${active ? 'text-[#f6f1e7]' : 'text-[#f6f1e7]/70'}`}>
                    {item.label}
                  </span>
                  <span className="micro block text-[#f6f1e7]/30">{item.es}</span>
                </span>
                {item.label === 'Members' && attentionCount > 0 ? (
                  <span className="badge bg-[#8d2820] text-[#f6f1e7]">{attentionCount}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="p-3">
          <div className="rounded-xl bg-[#f6f1e7]/[0.06] px-3.5 py-3">
            <div className="truncate text-sm font-medium text-[#f6f1e7]">{userName}</div>
            <div className="micro mt-0.5 truncate text-[#e0b45f]/80">{ROLE_LABELS[role as Role] ?? role}</div>
            {semesterName ? (
              <div className="micro mt-0.5 truncate text-[#f6f1e7]/35">{semesterName}</div>
            ) : null}
          </div>
          <div className="mt-2 flex items-center justify-between px-1">
            <Link href="/clubs" className="micro text-[#f6f1e7]/40 hover:text-[#f6f1e7]">Cambiar casa</Link>
            <form action={logout}>
              <button type="submit" className="micro text-[#f6f1e7]/40 hover:text-[#f6f1e7]">Salir</button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
