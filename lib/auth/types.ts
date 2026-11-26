export type Account = {
  profile_id: string; professional_name: string | null; name_confirmed_at: string | null;
  source: "browser" | "telegram"; auth_user_id: string | null; authenticated_at: string;
  expires_at: string; email: string | null; email_verified: boolean; aliases: string[]; telegram_linked: boolean; browser_linked?: boolean; has_photo?: boolean;
};
export function professionalName(value: unknown): string | null {
  if (typeof value !== "string" || /[\p{Cc}\p{Cf}]/u.test(value)) return null;
  const name = value.trim().normalize("NFC");
  return [...name].length >= 1 && [...name].length <= 120 ? name : null;
}
export function emailAddress(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)) return null;
  return value.toLowerCase();
}
export const validPassword = (value: unknown): value is string => typeof value === "string" && value.length >= 12 && value.length <= 128;
