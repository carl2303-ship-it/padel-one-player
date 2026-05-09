/**
 * Eligibilidade baseada exclusivamente em nível numérico.
 * Mantém accepted_levels como fallback temporário para torneios antigos.
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

export function isPlayerEligibleForCategory(
  cat: TournamentCategoryEligibility,
  player: PlayerEligibilityFields,
): boolean {
  const hasLevelRange = cat.min_level != null || cat.max_level != null;

  if (hasLevelRange && player.level != null) {
    if (cat.min_level != null && player.level < cat.min_level) return false;
    if (cat.max_level != null && player.level > cat.max_level) return false;
    return true;
  }

  // Fallback: accepted_levels for legacy tournaments
  const hasAcceptedLevels = cat.accepted_levels != null && cat.accepted_levels.length > 0;
  if (hasAcceptedLevels && player.player_category) {
    return cat.accepted_levels!.includes(player.player_category);
  }

  return true;
}
