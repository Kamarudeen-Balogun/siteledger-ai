import type { ProjectPermissions } from "./permissions";
export type PrivateProject = {
  id: string; name: string; client: string; location: string; project_code: string;
  contract_sum: string; currency: string; timezone: string; archived_at: string | null;
  role: "foreman" | "pm"; owner: boolean; role_label?: string; permissions?: ProjectPermissions;
};
export const projectTimezones = ["UTC", ...Intl.supportedValuesOf("timeZone")];
export function projectText(value: unknown): string | null {
  if (typeof value !== "string" || /[\p{Cc}\p{Cf}]/u.test(value)) return null;
  const text = value.trim().normalize("NFC");
  return [...text].length >= 1 && [...text].length <= 200 ? text : null;
}
export function validTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 100) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
}
