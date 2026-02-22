// utils/roles.ts — Single source of truth for role classification
// AGENCY = full access (analyze, generate parlays, manage accounts)
// CLIENT = view only (according to their subscription plan)

export const AGENCY_ROLES = ['platform_owner', 'agency_admin', 'superadmin'] as const;
export type AgencyRole = typeof AGENCY_ROLES[number];

export function isAgencyRole(role?: string | null): boolean {
  return !!role && (AGENCY_ROLES as readonly string[]).includes(role);
}

export function isClientRole(role?: string | null): boolean {
  return !isAgencyRole(role);
}
