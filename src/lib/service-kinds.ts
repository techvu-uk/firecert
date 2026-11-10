/**
 * Types of recurring service a site can have. Each kind has its own schedule and reminders.
 * To add one (e.g. fire extinguishers): add it here, then create a form with `serviceKind` set to it.
 */
export const SERVICE_KINDS = {
  FIRE_ALARM: {
    label: "Fire alarm",
    service: "fire alarm service",
    serviceTitle: "Fire alarm service",
    defaultMonths: 6,
  },
  EMERGENCY_LIGHTING: {
    label: "Emergency lighting",
    service: "emergency lighting inspection",
    serviceTitle: "Emergency lighting inspection",
    defaultMonths: 12,
  },
} as const;

export type ServiceKind = keyof typeof SERVICE_KINDS;
export const SERVICE_KIND_KEYS = Object.keys(SERVICE_KINDS) as ServiceKind[];

export function serviceKind(k: string | null | undefined) {
  return SERVICE_KINDS[(k as ServiceKind) ?? "FIRE_ALARM"] ?? SERVICE_KINDS.FIRE_ALARM;
}
