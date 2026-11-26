export const projectRoles = ["PM/QS", "Site Engineer", "Foreman", "Client", "Viewer"];
export const permissionLabels = { view_reports: "View reports", record_notes: "Record notes", edit_boq: "Edit BoQ", approve_lock: "Approve & lock", invite_members: "Invite members" } as const;
export const permissionKeys = Object.keys(permissionLabels) as (keyof typeof permissionLabels)[];
export type ProjectPermissions = Record<keyof typeof permissionLabels, boolean>;
export function validPermissions(value: unknown): value is ProjectPermissions {
  return Boolean(value && typeof value === "object" && Object.keys(value).length === permissionKeys.length && permissionKeys.every(key => typeof (value as ProjectPermissions)[key] === "boolean"));
}
export function validRole(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && [...value].length >= 1 && [...value].length <= 40 && !/[\p{Cc}\p{Cf}]/u.test(value);
}
