import type { AttendanceStatus, EventType, MemberStatus } from './rules';

export const MEMBER_STATUS_STYLE: Record<MemberStatus, string> = {
  active: 'bg-[#eaf1ea] text-[#2f5540] ring-1 ring-[#355c42]/15',
  warning: 'bg-[#fbf0d7] text-[#8a6412] ring-1 ring-[#a97d1c]/15',
  at_risk: 'bg-orange-50 text-[#8f421a] ring-1 ring-[#a8501f]/20',
  removal_required: 'bg-[#f9e3e1] text-[#78201a] ring-1 ring-[#8d2820]/20',
  removed: 'bg-[#eeeae1] text-[#6f6659] ring-1 ring-[#6f6659]/15',
};

export const MEMBER_STATUS_DOT: Record<MemberStatus, string> = {
  active: 'bg-[#3f6b4f]',
  warning: 'bg-[#c8952c]',
  at_risk: 'bg-[#bb5f2c]',
  removal_required: 'bg-[#9b2c22]',
  removed: 'bg-[#a4947f]',
};

export const ATTENDANCE_STYLE: Record<AttendanceStatus, string> = {
  present: 'bg-[#eaf1ea] text-[#2f5540] ring-1 ring-[#355c42]/15',
  late: 'bg-[#e2eef1] text-[#275a67] ring-1 ring-[#2f6b7a]/15',
  excused: 'bg-[#e9e6f2] text-[#4f4180] ring-1 ring-[#5b4b8a]/15',
  absent: 'bg-[#f9e3e1] text-[#78201a] ring-1 ring-[#8d2820]/20',
};

/** Selected state for the four roll-call buttons. */
export const ATTENDANCE_ACTIVE: Record<AttendanceStatus, string> = {
  present: 'bg-[#355c42] text-white ring-[#355c42]',
  late: 'bg-[#2f6b7a] text-white ring-[#2f6b7a]',
  excused: 'bg-[#5b4b8a] text-white ring-[#5b4b8a]',
  absent: 'bg-[#8d2820] text-white ring-[#8d2820]',
};

export const EVENT_TYPE_STYLE: Record<EventType, { chip: string; dot: string }> = {
  general_meeting: { chip: 'bg-brand-soft text-brand ring-1 ring-brand/15', dot: 'bg-brand' },
  eboard_meeting: { chip: 'bg-[#f3e2df] text-[#78201a] ring-1 ring-[#78201a]/15', dot: 'bg-[#8d2820]' },
  workshop: { chip: 'bg-[#e2eef1] text-[#275a67] ring-1 ring-[#2f6b7a]/15', dot: 'bg-[#2f6b7a]' },
  social: { chip: 'bg-inti-soft text-[#8a6412] ring-1 ring-inti/20', dot: 'bg-inti' },
  volunteer: { chip: 'bg-[#eaf1ea] text-[#2f5540] ring-1 ring-[#355c42]/15', dot: 'bg-andes' },
  fundraiser: { chip: 'bg-[#f7ead9] text-[#8f421a] ring-1 ring-[#a8501f]/15', dot: 'bg-[#c96f3c]' },
  other: { chip: 'bg-[#eeeae1] text-[#5d554a] ring-1 ring-piedra/15', dot: 'bg-piedra' },
};

export const eventStyle = (type: string) =>
  EVENT_TYPE_STYLE[type as EventType] ?? EVENT_TYPE_STYLE.other;
