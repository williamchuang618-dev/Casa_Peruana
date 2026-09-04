/**
 * Capability-based access control.
 *
 * Roles are never checked inline anywhere else in the codebase — call `can()`.
 * Adding a custom club role later means adding one row to this matrix, not
 * hunting `role === 'president'` through the app.
 */

export const ROLES = [
  'owner',
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'officer',
  'member',
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  president: 'President',
  vice_president: 'Vice President',
  secretary: 'Secretary',
  treasurer: 'Treasurer',
  officer: 'Officer',
  member: 'General Member',
};

export const CAPABILITIES = [
  'event:create',
  'event:edit',
  'event:delete',
  'attendance:take',
  'attendance:edit',
  'member:invite',
  'member:edit',
  'member:confirm_removal',
  'excuse:decide',
  'club:settings',
  'club:manage_roles',
  'members:view_all',
  'analytics:view',
  'audit:view',
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const OFFICER_VIEW: Capability[] = ['members:view_all', 'analytics:view'];

const SECRETARY: Capability[] = [
  'event:create',
  'event:edit',
  'attendance:take',
  'attendance:edit',
  'excuse:decide',
  ...OFFICER_VIEW,
];

const VICE_PRESIDENT: Capability[] = [
  ...SECRETARY,
  'event:delete',
  'member:invite',
  'member:edit',
  'club:settings',
  'audit:view',
];

const PRESIDENT: Capability[] = [
  ...VICE_PRESIDENT,
  'member:confirm_removal',
  'club:manage_roles',
];

export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  owner: CAPABILITIES,
  president: PRESIDENT,
  vice_president: VICE_PRESIDENT,
  secretary: SECRETARY,
  treasurer: [...OFFICER_VIEW, 'audit:view'],
  officer: OFFICER_VIEW,
  member: [],
};

export function can(role: string | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  const caps = ROLE_CAPABILITIES[role as Role];
  return caps ? caps.includes(capability) : false;
}

export function isOfficer(role: string | null | undefined): boolean {
  return can(role, 'members:view_all');
}

/** Roles a given role is allowed to hand out. Nobody can mint an owner. */
export function assignableRoles(role: string | null | undefined): Role[] {
  if (!can(role, 'club:manage_roles')) return [];
  return ROLES.filter((r) => r !== 'owner');
}
