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
  return 'PT';
}

export function dialCodeForIso(iso: string): string {
  return COUNTRY_DIAL_CODES.find(c => c.iso === iso)?.dial || '351';
}

function isPtMobile(digits: string): boolean {
  return /^9[1236]\d{7}$/.test(digits);
}

/**
 * Junta o indicativo selecionado com o número local.
 * Se o jogador colar um número internacional (+351… / 00…), usa esse valor.
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
  if (localDigits.startsWith(dialCode)) return '+' + localDigits;
  return '+' + dialCode + localDigits;
}

/**
 * Normaliza para dígitos com indicativo (sem +).
 * +351 912 345 678 → 351912345678
 * 912345678 (móvel PT) → 351912345678
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';

  let cleaned = phone.trim().replace(/[\s\-\(\)\.]/g, '');

  if (cleaned.startsWith('+00')) cleaned = cleaned.slice(3);
  else if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  else if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);

  let digits = cleaned.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('0') && digits.length <= 10) {
    digits = digits.slice(1);
  }

  if (isPtMobile(digits)) return '351' + digits;

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

export function formatPhoneDisplay(phone: string | null | undefined): string {
  const digits = normalizePhone(phone);
  return digits ? '+' + digits : '';
}
