import Link from 'next/link';
import {
  ATTENDANCE_LABELS, EVENT_TYPE_LABELS, STATUS_LABELS,
  type AttendanceStatus, type MemberStatus,
} from '@/lib/rules';
import {
  ATTENDANCE_STYLE, MEMBER_STATUS_DOT, MEMBER_STATUS_STYLE, eventStyle,
} from '@/lib/theme';
import { Chakana, Greca, Ridge } from '@/components/landing/scene';

export function StatusBadge({ status }: { status: MemberStatus | string }) {
  const key = (status in MEMBER_STATUS_STYLE ? status : 'active') as MemberStatus;
  return (
    <span className={`badge ${MEMBER_STATUS_STYLE[key]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${MEMBER_STATUS_DOT[key]}`} />
      {STATUS_LABELS[key]}
    </span>
  );
}

export function AttendanceBadge({ status }: { status: AttendanceStatus | null }) {
  if (!status) {
    return <span className="badge bg-[#eeeae1] text-[#6f6659] ring-1 ring-[#6f6659]/15">Not recorded</span>;
  }
  return <span className={`badge ${ATTENDANCE_STYLE[status]}`}>{ATTENDANCE_LABELS[status]}</span>;
}

export function EventTypeBadge({ type }: { type: string }) {
  return (
    <span className={`badge ${eventStyle(type).chip}`}>
      {EVENT_TYPE_LABELS[type as keyof typeof EVENT_TYPE_LABELS] ?? 'Other'}
    </span>
  );
}

/**
 * Every page opens on the same band the landing page uses: the ridge at dawn,
 * the drafting grid, a letterspaced Spanish label, and the title in Cormorant.
 * The identity carries past the login screen instead of stopping at it — but it
 * is confined to the header, so the tables underneath stay legible.
 */
export function PageHeader({
  title, subtitle, eyebrow, children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="rise relative mb-6 overflow-hidden rounded-2xl bg-noche">
      <Ridge className="absolute inset-y-0 right-0 h-full w-[88%]" />
      <div className="rule-grid absolute inset-0" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-r from-noche via-noche/65 to-transparent" aria-hidden />

      <div className="relative flex min-h-[136px] flex-wrap items-end justify-between gap-4 px-6 py-8 sm:px-8 sm:py-9">
        <div className="min-w-0">
          {eyebrow ? <p className="micro text-[#e0b45f]">{eyebrow}</p> : null}
          <h1 className="display mt-2 text-[clamp(1.9rem,4vw,2.75rem)] font-light leading-tight tracking-tight text-[#f6f1e7]">
            {title}
          </h1>
          {subtitle ? <p className="mt-2 max-w-xl text-sm text-[#f6f1e7]/60">{subtitle}</p> : null}
        </div>
        {children ? <div className="on-dark flex flex-wrap items-center gap-2">{children}</div> : null}
      </div>

      <Greca className="h-2.5 w-full text-[#e0b45f]/30" />
    </header>
  );
}

export function StatCard({
  label, value, hint, tone = 'default', href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'default' | 'warning' | 'risk' | 'danger' | 'good';
  href?: string;
}) {
  const tones = {
    default: 'text-ink-900',
    good: 'text-[#355c42]',
    warning: 'text-[#a97d1c]',
    risk: 'text-[#a8501f]',
    danger: 'text-[#8d2820]',
  } as const;

  const body = (
    <>
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-inti/70 via-inti/20 to-transparent" aria-hidden />
      <div className="micro text-ink-400">{label}</div>
      <div className={`display mt-2 text-4xl font-light leading-none tabular-nums ${tones[tone]}`}>{value}</div>
      {hint ? <div className="mt-1.5 text-xs text-ink-400">{hint}</div> : null}
    </>
  );

  return href ? (
    <Link href={href} className="card card-pad relative block overflow-hidden transition-colors hover:border-inti/50">
      {body}
    </Link>
  ) : (
    <div className="card card-pad relative overflow-hidden">{body}</div>
  );
}

export function EmptyState({
  title, body, action,
}: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="card relative flex flex-col items-center justify-center gap-2 overflow-hidden px-6 py-14 text-center">
      <Chakana className="pointer-events-none absolute -bottom-8 -right-8 h-36 w-36 fill-ink-900/[0.04]" />
      <Chakana className="mb-2 h-7 w-7 fill-inti/50" />
      <p className="text-sm font-medium text-ink-700">{title}</p>
      {body ? <p className="max-w-sm text-sm text-ink-500">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/**
 * Absences as andenes — the terraces stepping up a slope. Each step is one
 * allowed absence, and the courses fill from the bottom, so "2 of 3" is a shape
 * you read at a glance rather than a bar you have to measure.
 */
export function Meter({ value, max, tone }: { value: number; max: number; tone: string }) {
  const steps = Math.max(1, Math.min(12, Math.ceil(max)));
  return (
    <div
      className="flex items-end gap-[3px]"
      role="img"
      aria-label={`${value} of ${max} absences`}
    >
      {Array.from({ length: steps }, (_, i) => {
        const filled = value >= i + 1;
        const partial = !filled && value > i;
        return (
          <span
            key={i}
            className={`flex-1 rounded-[2px] transition-colors ${
              filled ? tone : partial ? `${tone} opacity-45` : 'bg-line'
            }`}
            style={{ height: 5 + i * 3 }}
          />
        );
      })}
    </div>
  );
}

export function Avatar({
  name, size = 'md', photo,
}: { name: string; size?: 'sm' | 'md' | 'lg'; photo?: string | null }) {
  const initials = name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
  const dims =
    size === 'sm' ? 'h-7 w-7 text-[11px]' : size === 'lg' ? 'h-20 w-20 text-lg' : 'h-9 w-9 text-xs';
  return (
    <span className={`${dims} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft font-semibold text-brand`}>
      {photo ? (
        // Photos are self-hosted data URLs, so next/image would add a loader for nothing.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-full w-full object-cover" />
      ) : (
        initials || '?'
      )}
    </span>
  );
}
