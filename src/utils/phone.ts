const TANZANIA_CODE = '255';

/**
 * Converts a phone number typed by a customer into E.164 (`+255712345678`), which
 * Supabase phone auth requires. Local Tanzanian formats (`0712 345 678`,
 * `712345678`, `255712345678`) are accepted. Returns null when the number is invalid.
 */
export function toE164(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  let international: string;
  if (trimmed.startsWith('+')) international = digits;
  else if (digits.startsWith('00')) international = digits.slice(2);
  else if (digits.startsWith(TANZANIA_CODE)) international = digits;
  else if (digits.startsWith('0')) international = TANZANIA_CODE + digits.slice(1);
  else if (digits.length === 9) international = TANZANIA_CODE + digits;
  else return null;

  if (international.startsWith(TANZANIA_CODE)) {
    return /^255[67]\d{8}$/.test(international) ? `+${international}` : null;
  }
  return /^[1-9]\d{7,14}$/.test(international) ? `+${international}` : null;
}

/** Supabase stores `user.phone` without the leading plus sign. */
export function formatAccountPhone(phone: string | undefined | null) {
  if (!phone) return null;
  return phone.startsWith('+') ? phone : `+${phone}`;
}
