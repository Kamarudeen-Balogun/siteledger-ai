// Supabase Auth permits email OTP lengths from 6 to 10 digits. The provider
// validates the full issued code, its expiry and one-use status.
export const EMAIL_CODE_MIN_LENGTH = 6;
export const EMAIL_CODE_MAX_LENGTH = 10;
export const EMAIL_CODE_PATTERN = `[0-9]{${EMAIL_CODE_MIN_LENGTH},${EMAIL_CODE_MAX_LENGTH}}`;
export function validEmailCode(value: unknown): value is string {
  return typeof value === "string" && value.length >= EMAIL_CODE_MIN_LENGTH
    && value.length <= EMAIL_CODE_MAX_LENGTH && !/[^0-9]/.test(value);
}
