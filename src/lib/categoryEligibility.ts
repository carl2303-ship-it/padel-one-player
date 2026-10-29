/**
 * Eligibilidade por nível numérico e/ou categoria (M1–M6 / F1–F6).
 * accepted_levels e o nome da categoria são fallbacks para torneios antigos.
 */

export type TournamentCategoryEligibility = {
  name: string;
  accepted_levels: string[] | null;
  min_level: number | null;
  max_level: number | null;
};

export type PlayerEligibilityFields = {
  player_category: string | null;
  level: number | null;
};

const CATEGORY_CODE_RE = /\b([MF])\s*([1-6])\b/gi;
/** Prefer "níveis 0.5 - 3.9"; avoid matching "M5 - M6". */
const NAMED_LEVEL_RANGE_RE = /n[ií]veis?\s*[:.]?\s*(\d+(?:[.,]\d+)?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)/i;
const PLAIN_LEVEL_RANGE_RE = /(?:^|[^\wMF])(\d+(?:[.,]\d+)?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)(?!\s*[MF])/i;

function normalizeCategoryCode(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

/** Extrai códigos M1–M6 / F1–F6 de accepted_levels e/ou do nome. */
export function extractCategoryCodes(
  cat: Pick<TournamentCategoryEligibility, 'name' | 'accepted_levels'>,
): string[] {
  const codes = new Set<string>();
  for (const level of cat.accepted_levels || []) {
    if (!level) continue;
    const n = normalizeCategoryCode(String(level));
    if (/^[MF][1-6]$/.test(n)) codes.add(n);
  }
  const name = cat.name || '';
  let match: RegExpExecArray | null;
  CATEGORY_CODE_RE.lastIndex = 0;
  while ((match = CATEGORY_CODE_RE.exec(name)) !== null) {
    codes.add(`${match[1].toUpperCase()}${match[2]}`);
  }
  return [...codes];
}

function parseLevelPair(aRaw: string, bRaw: string): { min_level: number; max_level: number } | null {
  const a = parseFloat(aRaw.replace(',', '.'));
  const b = parseFloat(bRaw.replace(',', '.'));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { min_level: Math.min(a, b), max_level: Math.max(a, b) };
}

/** Extrai intervalo de níveis do nome se min/max da BD estiverem vazios. */
export function extractLevelRangeFromName(name: string | null | undefined): {
  min_level: number | null;
  max_level: number | null;
} {
  if (!name) return { min_level: null, max_level: null };
  const named = name.match(NAMED_LEVEL_RANGE_RE);
  if (named) {
    const pair = parseLevelPair(named[1], named[2]);
    if (pair) return pair;
  }
  // Só usar range "solto" se o nome NÃO for só códigos de categoria (ex. "M5 - M6")
  const withoutCodes = name.replace(/\b[MF]\s*[1-6]\b/gi, ' ').trim();
  const plain = withoutCodes.match(PLAIN_LEVEL_RANGE_RE);
  if (plain) {
    const pair = parseLevelPair(plain[1], plain[2]);
    if (pair) return pair;
  }
  return { min_level: null, max_level: null };
}

function levelInRange(
  level: number,
  min_level: number | null,
  max_level: number | null,
): boolean {
  if (min_level != null && level < min_level) return false;
  if (max_level != null && level > max_level) return false;
  return true;
}

export function isPlayerEligibleForCategory(
  cat: TournamentCategoryEligibility,
  player: PlayerEligibilityFields,
): boolean {
  const codes = extractCategoryCodes(cat);
  const fromName =
    cat.min_level == null && cat.max_level == null
      ? extractLevelRangeFromName(cat.name)
      : { min_level: null, max_level: null };
  const minLvl = cat.min_level != null ? Number(cat.min_level) : fromName.min_level;
  const maxLvl = cat.max_level != null ? Number(cat.max_level) : fromName.max_level;
  const hasLevelRange = minLvl != null || maxLvl != null;
  const hasCategoryCodes = codes.length > 0;

  // Sem critérios → categoria aberta a todos
  if (!hasLevelRange && !hasCategoryCodes) return true;

  if (hasLevelRange) {
    if (player.level == null) return false;
    if (!levelInRange(Number(player.level), minLvl, maxLvl)) return false;
    // Se também há códigos M/F, exigir categoria quando o perfil a tem
    if (hasCategoryCodes && player.player_category) {
      return codes.includes(normalizeCategoryCode(player.player_category));
    }
    return true;
  }

  // Só códigos de categoria (torneios legados)
  if (!player.player_category) return false;
  return codes.includes(normalizeCategoryCode(player.player_category));
}

/** True se o jogador for elegível para pelo menos uma categoria do torneio. */
export function isPlayerEligibleForAnyCategory(
  categories: TournamentCategoryEligibility[],
  player: PlayerEligibilityFields,
): boolean {
  if (!categories.length) return false;
  return categories.some((cat) => isPlayerEligibleForCategory(cat, player));
}
