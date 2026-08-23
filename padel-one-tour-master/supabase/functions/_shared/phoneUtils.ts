/** Phone storage: national digits only (no +, no country code). */

export const MIN_PHONE_DIGITS = 6;
export const MAX_PHONE_DIGITS = 15;

/** 3-digit then 2-digit country codes (longest-match). Never applied to bare PT/ES 9-digit mobiles. */
const COUNTRY_CODES_3 = [
  '998', '996', '995', '994', '993', '992', '977', '976', '975', '974', '973', '972', '971',
  '968', '967', '966', '965', '964', '963', '962', '961', '960', '886', '880', '856', '855',
  '853', '852', '423', '421', '420', '389', '387', '386', '385', '383', '382', '381', '380',
  '378', '377', '376', '375', '374', '373', '372', '371', '370', '359', '358', '357', '356',
  '355', '354', '353', '352', '351', '299', '298', '297', '258', '245', '244', '216', '213', '212',
];

const COUNTRY_CODES_2 = [
  '98', '95', '94', '93', '92', '91', '90', '86', '84', '82', '81', '66', '65', '64', '63', '62',
  '61', '60', '58', '57', '56', '55', '54', '53', '52', '51', '49', '48', '47', '46', '45', '44',
  '43', '41', '40', '39', '36', '34', '33', '32', '31', '30', '27', '20',
];

function isPtMobile(digits: string): boolean {
  return /^9[1236]\d{7}$/.test(digits);
}

function isEsMobile(digits: string): boolean {
  return /^[67]\d{8}$/.test(digits);
}

/**
 * Normaliza para dígitos nacionais (sem indicativo).
 * PT: 925358087 — nunca corta 91/92 de um móvel PT de 9 dígitos.
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';

  let cleaned = phone.trim().replace(/[\s\-\(\)\.]/g, '');

  if (cleaned.startsWith('+00')) cleaned = cleaned.slice(3);
  else if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  else if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);

  let digits = cleaned.replace(/\D/g, '');

  // Bare PT / ES national mobiles — keep as-is (fixes "+925358087" after removing +)
  if (isPtMobile(digits) || isEsMobile(digits)) return digits;

  if (/^3519\d{8}$/.test(digits)) return digits.slice(3);
  if (/^34[67]\d{8}$/.test(digits)) return digits.slice(2);

  // Only strip country codes on longer international numbers
  if (digits.length >= 11) {
    for (const code of COUNTRY_CODES_3) {
      if (digits.startsWith(code) && digits.length > code.length + MIN_PHONE_DIGITS - 1) {
        digits = digits.slice(code.length);
        break;
      }
    }
    if (digits.length >= 11) {
      for (const code of COUNTRY_CODES_2) {
        if (digits.startsWith(code) && digits.length > code.length + MIN_PHONE_DIGITS - 1) {
          digits = digits.slice(code.length);
          break;
        }
      }
    }
    if (digits.length >= 11 && /^[17]\d{9,}$/.test(digits)) {
      digits = digits.slice(1);
    }
  } else if (/^351[29]\d{8}$/.test(digits)) {
    digits = digits.slice(3);
  }

  if (digits.startsWith('0') && digits.length > MIN_PHONE_DIGITS) {
    digits = digits.slice(1);
  }

  return digits;
}

export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return normalized.length >= MIN_PHONE_DIGITS && normalized.length <= MAX_PHONE_DIGITS;
}

/** Alias used across Tour for membership/payment matching */
export function normalizePhoneKey(phone: string | null | undefined): string {
  return normalizePhone(phone);
}

/** All digits from a phone (any format). */
export function phoneDigits(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/[^\d]/g, '');
}

/** Auth email derived from phone — never reuse a human email for login identity. */
export function authEmailForPhone(phone: string | null | undefined): string {
  let digits = phoneDigits(phone);
  if (/^9[1236]\d{7}$/.test(digits)) digits = `351${digits}`;
  else if (/^[67]\d{8}$/.test(digits)) digits = `34${digits}`;
  return `${digits}@boostpadel.app`;
}

/** Compare phones by last 9 digits (handles +351… vs 917…). */
export function phonesEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const da = phoneDigits(a);
  const db = phoneDigits(b);
  if (!da || !db) return false;
  if (da === db) return true;
  const minLen = 9;
  if (da.length >= minLen && db.length >= minLen) {
    return da.slice(-minLen) === db.slice(-minLen);
  }
  return false;
}

/** Format for player_accounts storage (PT → +351…). */
export function storagePhoneFormat(phone: string | null | undefined): string {
  const national = normalizePhone(phone);
  if (!national) return '';
  if (/^9[1236]\d{7}$/.test(national)) return `+351${national}`;
  if (/^[67]\d{8}$/.test(national)) return `+34${national}`;
  const digits = phoneDigits(phone);
  if (digits.startsWith('351')) return `+${digits}`;
  if (digits.startsWith('34')) return `+${digits}`;
  return phone!.trim().startsWith('+') ? phone!.trim() : `+${digits}`;
}

/** Find player_accounts row by phone (any common format). */
export async function findPlayerAccountByPhone(
  supabaseAdmin: { from: (table: string) => any },
  phone: string,
): Promise<{ id: string; user_id: string | null; phone_number: string; name: string; email: string | null } | null> {
  const stored = storagePhoneFormat(phone);
  const national = normalizePhone(phone);

  for (const candidate of [stored, national, `+351${national}`, national ? `351${national}` : '']) {
    if (!candidate) continue;
    const { data } = await supabaseAdmin
      .from('player_accounts')
      .select('id, user_id, phone_number, name, email')
      .eq('phone_number', candidate)
      .maybeSingle();
    if (data) return data;
  }

  const last9 = phoneDigits(phone).slice(-9);
  if (last9.length >= 9) {
    const { data: rows } = await supabaseAdmin
      .from('player_accounts')
      .select('id, user_id, phone_number, name, email')
      .ilike('phone_number', `%${last9}`)
      .limit(10);
    const matches = (rows || []).filter((r: { phone_number: string }) =>
      phonesEqual(r.phone_number, phone),
    );
    if (matches.length === 1) return matches[0];
  }

  return null;
}

