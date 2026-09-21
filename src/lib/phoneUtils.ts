/** Phone storage: digits with country calling code (no +). PT: 351912345678 */

export const MIN_PHONE_DIGITS = 8;
export const MAX_PHONE_DIGITS = 15;

export const COUNTRY_DIAL_CODES: { iso: string; dial: string; flag: string; name: string }[] = [
  { iso: 'PT', dial: '351', flag: '🇵🇹', name: 'Portugal' },
  { iso: 'ES', dial: '34', flag: '🇪🇸', name: 'España' },
  { iso: 'FR', dial: '33', flag: '🇫🇷', name: 'France' },
  { iso: 'BR', dial: '55', flag: '🇧🇷', name: 'Brasil' },
  { iso: 'BE', dial: '32', flag: '🇧🇪', name: 'Belgique' },
  { iso: 'CH', dial: '41', flag: '🇨🇭', name: 'Suisse' },
  { iso: 'GB', dial: '44', flag: '🇬🇧', name: 'United Kingdom' },
  { iso: 'DE', dial: '49', flag: '🇩🇪', name: 'Deutschland' },
  { iso: 'IT', dial: '39', flag: '🇮🇹', name: 'Italia' },
  { iso: 'NL', dial: '31', flag: '🇳🇱', name: 'Nederland' },
  { iso: 'LU', dial: '352', flag: '🇱🇺', name: 'Luxembourg' },
  { iso: 'AD', dial: '376', flag: '🇦🇩', name: 'Andorra' },
  { iso: 'AO', dial: '244', flag: '🇦🇴', name: 'Angola' },
  { iso: 'MZ', dial: '258', flag: '🇲🇿', name: 'Moçambique' },
  { iso: 'CV', dial: '238', flag: '🇨🇻', name: 'Cabo Verde' },
  { iso: 'GW', dial: '245', flag: '🇬🇼', name: 'Guiné-Bissau' },
  { iso: 'ST', dial: '239', flag: '🇸🇹', name: 'São Tomé e Príncipe' },
  { iso: 'MA', dial: '212', flag: '🇲🇦', name: 'Maroc' },
  { iso: 'US', dial: '1', flag: '🇺🇸', name: 'United States' },
  { iso: 'CA', dial: '1', flag: '🇨🇦', name: 'Canada' },
  { iso: 'AR', dial: '54', flag: '🇦🇷', name: 'Argentina' },
  { iso: 'MX', dial: '52', flag: '🇲🇽', name: 'México' },
  { iso: 'CO', dial: '57', flag: '🇨🇴', name: 'Colombia' },
  { iso: 'CL', dial: '56', flag: '🇨🇱', name: 'Chile' },
  { iso: 'PE', dial: '51', flag: '🇵🇪', name: 'Perú' },
  { iso: 'UY', dial: '598', flag: '🇺🇾', name: 'Uruguay' },
  { iso: 'PY', dial: '595', flag: '🇵🇾', name: 'Paraguay' },
  { iso: 'EC', dial: '593', flag: '🇪🇨', name: 'Ecuador' },
  { iso: 'RO', dial: '40', flag: '🇷🇴', name: 'România' },
  { iso: 'PL', dial: '48', flag: '🇵🇱', name: 'Polska' },
  { iso: 'SE', dial: '46', flag: '🇸🇪', name: 'Sverige' },
  { iso: 'NO', dial: '47', flag: '🇳🇴', name: 'Norge' },
  { iso: 'DK', dial: '45', flag: '🇩🇰', name: 'Danmark' },
  { iso: 'IE', dial: '353', flag: '🇮🇪', name: 'Ireland' },
  { iso: 'AT', dial: '43', flag: '🇦🇹', name: 'Österreich' },
  { iso: 'CZ', dial: '420', flag: '🇨🇿', name: 'Česko' },
  { iso: 'UA', dial: '380', flag: '🇺🇦', name: 'Ukraine' },
  { iso: 'TR', dial: '90', flag: '🇹🇷', name: 'Türkiye' },
  { iso: 'AE', dial: '971', flag: '🇦🇪', name: 'United Arab Emirates' },
  { iso: 'QA', dial: '974', flag: '🇶🇦', name: 'Qatar' },
  { iso: 'SA', dial: '966', flag: '🇸🇦', name: 'Saudi Arabia' },
];

export function defaultCountryIso(language?: string): string {
  if (language === 'es') return 'ES';
  if (language === 'fr') return 'FR';
  if (language === 'en') return 'GB';
  return 'PT';
}

export function dialCodeForIso(iso: string): string {
  return COUNTRY_DIAL_CODES.find(c => c.iso === iso)?.dial || '351';
}

function isPtMobile(digits: string): boolean {
  return /^9[1236]\d{7}$/.test(digits);
}

/** UK mobile national body: 7xxxxxxxxx (10 digits). Distinct from FR/ES 9-digit 6/7… */
function isUkMobile(digits: string): boolean {
  return /^7\d{9}$/.test(digits);
}

/**
 * Junta o indicativo selecionado com o número local.
 * Se o jogador colar um número internacional (+351… / 00…), usa esse valor.
 * Móveis UK 07… / 7xxxxxxxxx forçam +44 (formato inequívoco de 10 dígitos).
 */
export function composeInternationalPhone(dialCode: string, localNumber: string): string {
  const raw = (localNumber || '').trim();
  if (!raw) return '';

  const cleaned = raw.replace(/[\s\-\(\)\.]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('00')) return '+' + cleaned.slice(2);

  let localDigits = cleaned.replace(/\D/g, '');
  if (!localDigits) return '';
  if (localDigits.startsWith('0')) localDigits = localDigits.slice(1);

  // Already international without +
  if (localDigits.startsWith('44') && localDigits.length >= 12) return '+44' + localDigits.slice(2);
  if (localDigits.startsWith('351') && localDigits.length >= 12) return '+351' + localDigits.slice(3);

  // UK mobile is unambiguous at 10 digits starting with 7 (FR/ES mobiles are 9 digits).
  if (isUkMobile(localDigits)) return '+44' + localDigits;
  if (isPtMobile(localDigits)) return '+351' + localDigits;

  if (localDigits.startsWith(dialCode)) return '+' + localDigits;
  return '+' + dialCode + localDigits;
}

/**
 * Normaliza para dígitos com indicativo (sem +).
 * +351 912 345 678 → 351912345678
 * 912345678 (móvel PT) → 351912345678
 * 07xxx / 7xxxxxxxxx (móvel UK) → 447xxxxxxxxx
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';

  let cleaned = phone.trim().replace(/[\s\-\(\)\.]/g, '');

  if (cleaned.startsWith('+00')) cleaned = cleaned.slice(3);
  else if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  else if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);

  let digits = cleaned.replace(/\D/g, '');
  if (!digits) return '';

  // Local trunk prefix (UK 07…, etc.)
  if (digits.startsWith('0') && digits.length >= 10 && digits.length <= 11) {
    digits = digits.slice(1);
  }

  if (digits.startsWith('44') && digits.length >= 12) return digits;
  if (digits.startsWith('351') && digits.length >= 12) return digits;

  if (isPtMobile(digits)) return '351' + digits;
  if (isUkMobile(digits)) return '44' + digits;

  return digits;
}

export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return normalized.length >= MIN_PHONE_DIGITS && normalized.length <= MAX_PHONE_DIGITS;
}

/** National digits without country calling code (for flexible lookup). */
export function normalizePhoneKey(phone: string | null | undefined): string {
  const digits = normalizePhone(phone);
  if (!digits) return '';
  if (/^3519\d{8}$/.test(digits)) return digits.slice(3);
  if (/^34[67]\d{8}$/.test(digits)) return digits.slice(2);
  if (/^33[67]\d{8}$/.test(digits)) return digits.slice(2);
  if (/^447\d{9}$/.test(digits)) return digits.slice(2);
  if (/^44[127]\d{8,9}$/.test(digits)) return digits.slice(2);
  // Generic: strip longest matching known dial prefix
  const dials = [...COUNTRY_DIAL_CODES.map(c => c.dial)].sort((a, b) => b.length - a.length);
  for (const d of dials) {
    if (digits.startsWith(d) && digits.length - d.length >= 6) return digits.slice(d.length);
  }
  return digits;
}

export function formatPhoneDisplay(phone: string | null | undefined): string {
  const digits = normalizePhone(phone);
  return digits ? '+' + digits : '';
}

/** Compare phones regardless of + prefix, spacing, or FR/ES dial mix-ups. */
export function phonesEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (na.length > 0 && na === nb) return true;
  const ka = normalizePhoneKey(a);
  const kb = normalizePhoneKey(b);
  return ka.length >= 8 && ka === kb;
}

/** Lookup candidates including common FR/ES dial mix-ups for the same national body. */
export function phoneLookupCandidates(phone: string | null | undefined): string[] {
  const out: string[] = [];
  const add = (v: string) => { if (v && !out.includes(v)) out.push(v); };

  const digits = normalizePhone(phone);
  if (digits) {
    add(digits);
    add('+' + digits);
  }

  const key = normalizePhoneKey(phone);
  if (/^[67]\d{8}$/.test(key)) {
    add('33' + key); add('+33' + key);
    add('34' + key); add('+34' + key);
  }
  if (/^9[1236]\d{7}$/.test(key)) {
    add('351' + key); add('+351' + key);
  }
  if (/^7\d{9}$/.test(key)) {
    add('44' + key); add('+44' + key);
    add('0' + key); add('+0' + key);
  }

  const raw = (phone || '').replace(/\D/g, '');
  if (raw) { add(raw); add('+' + raw); }
  return out;
}
