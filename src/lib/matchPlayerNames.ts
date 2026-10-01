/**
 * Helpers to always show real player names (never team labels) in match UIs.
 */

/** Fold accents / case for fuzzy name compares. */
export function foldPlayerName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Extract a usable person display name.
 * Club-path accounts like "Carlos/Padel1/BoostPadel" → "Carlos".
 * Team labels / placeholders → null.
 */
export function cleanPlayerDisplayName(
  name: string | null | undefined,
  teamName?: string | null,
): string | null {
  if (!name?.trim()) return null
  let n = name.trim()

  // Account names sometimes embed club paths: "Carlos/Padel1/BoostPadel" → "Carlos"
  if ((n.match(/\//g) || []).length >= 2) {
    const primary = n.split(/\s*\/\s*/)[0]?.trim()
    if (primary && !isLikelyTeamLabel(primary, teamName)) return primary
    return null
  }

  if (isLikelyTeamLabel(n, teamName)) return null
  return n
}

/** Stable key for deduping partners across slight name variants. */
export function partnerNameKey(name: string): string {
  const cleaned = cleanPlayerDisplayName(name) || name
  return foldPlayerName(cleaned.split(/\s*\/\s*/)[0] || cleaned)
}

/** True if a string is clearly a team/acronym label, not a person. */
export function isLikelyTeamLabel(name: string | null | undefined, teamName?: string | null): boolean {
  if (!name) return true
  const n = name.trim()
  if (!n || n === '?' || n === 'TBD') return true
  if (/^jogador\s*\d*$/i.test(n) || /^player\s*\d*$/i.test(n)) return true
  if (/^wild\s*card$/i.test(n) || /^tbd$/i.test(n)) return true
  // Very short all-caps / acronyms used as team codes (RP, FM, AB)
  if (/^[A-ZÁÉÍÓÚ]{1,3}$/.test(n)) return true
  // Company-style / generic team names
  if (/\b(lda|ltd|sa|team|equipa)\b/i.test(n)) return true
  // Explicit pair separators: "Ana / Pedro", "Ana & Pedro", "Ana, Pedro"
  if (/\s\/\s|\s&\s|,\s|\s-\s/.test(n)) return true
  // Compound club-style labels with multiple slashes ("Carlos/Padel1/BoostPadel")
  if ((n.match(/\//g) || []).length >= 2) return true
  // Exact match to team name only when that name itself looks like a team label
  if (teamName && n.toLowerCase() === teamName.trim().toLowerCase()) {
    const t = teamName.trim()
    if (/^[A-ZÁÉÍÓÚ]{1,3}$/.test(t)) return true
    if (/\s\/\s|\s&\s|,\s|\s-\s/.test(t)) return true
    // "Dinis-Carlos" style team codes
    if (/^[A-ZÀ-Ú][A-Za-zÀ-ú']+-[A-ZÀ-Ú][A-Za-zÀ-ú']+$/.test(t)) return true
  }
  return false
}

/**
 * Parse a team display name into up to 2 person-like parts.
 * Only returns parts when they look like people — never returns the raw team label as a "player".
 */
export function parsePersonNamesFromTeamLabel(teamName: string | null | undefined): [string | null, string | null] {
  if (!teamName?.trim()) return [null, null]
  const raw = teamName.trim()

  const parts = raw
    .split(/\s*\/\s*|\s*&\s*|,\s*|\s+-\s+/)
    .map((s) => s.trim())
    .filter(Boolean)

  let candidates = parts.length >= 2 ? parts.slice(0, 2) : null

  if (!candidates) {
    const hyphenParts = raw.split(/-(?=[A-ZÀ-Ú])/).map((s) => s.trim()).filter(Boolean)
    if (hyphenParts.length === 2) candidates = hyphenParts
  }

  if (!candidates || candidates.length < 2) return [null, null]

  const looksLikePerson = (c: string) => {
    if (!c || c.length < 2) return false
    if (/^[A-ZÁÉÍÓÚ]{1,3}$/.test(c)) return false
    if (/\b(lda|ltd|sa|team|equipa)\b/i.test(c)) return false
    if (/^jogador\s*\d*$/i.test(c) || /^player\s*\d*$/i.test(c)) return false
    // Club-path segment is OK as a person token
    if ((c.match(/\//g) || []).length >= 2) return false
    return true
  }
  if (!candidates.every(looksLikePerson)) return [null, null]
  return [candidates[0], candidates[1]]
}

function absorbPair(
  a: string | null,
  b: string | null,
  teamName?: string | null,
): [string | null, string | null] {
  // Prefer splitting a pair stuck in one field ("Dinis-Carlos" or "Ana / Pedro")
  if (a && (!b || isLikelyTeamLabel(b, teamName))) {
    const [x, y] = parsePersonNamesFromTeamLabel(a)
    if (x && y) return [x, y]
  }
  if (b && (!a || isLikelyTeamLabel(a, teamName))) {
    const [x, y] = parsePersonNamesFromTeamLabel(b)
    if (x && y) return [x, y]
  }

  const keep = (n: string | null): string | null => {
    if (!n) return null
    const cleaned = cleanPlayerDisplayName(n, teamName)
    if (cleaned) return cleaned
    if (isLikelyTeamLabel(n, teamName)) {
      const [x, y] = parsePersonNamesFromTeamLabel(n)
      // pair handled above; single team token → drop
      if (x && y) return null
      return null
    }
    return n
  }

  return [keep(a), keep(b)]
}

/** Prefer real player names; never fall back to showing the team label in a bubble. */
export function resolveFourPlayerNames(match: {
  team1_name?: string | null
  team2_name?: string | null
  player1_name?: string | null
  player2_name?: string | null
  player3_name?: string | null
  player4_name?: string | null
}): [string, string, string, string] {
  const raw = (n: string | null | undefined): string | null => {
    const t = n?.trim()
    return t || null
  }

  let p1 = raw(match.player1_name)
  let p2 = raw(match.player2_name)
  let p3 = raw(match.player3_name)
  let p4 = raw(match.player4_name)

  ;[p1, p2] = absorbPair(p1, p2, match.team1_name)
  ;[p3, p4] = absorbPair(p3, p4, match.team2_name)

  // Only if still missing, try parsing team label into people (never use raw team name)
  if (!p1 || !p2) {
    const [a, b] = parsePersonNamesFromTeamLabel(match.team1_name)
    if (!p1 && a) p1 = a
    if (!p2 && b) p2 = b
  }
  if (!p3 || !p4) {
    const [a, b] = parsePersonNamesFromTeamLabel(match.team2_name)
    if (!p3 && a) p3 = a
    if (!p4 && b) p4 = b
  }

  const guard = (n: string | null, team?: string | null) =>
    cleanPlayerDisplayName(n, team) || '?'

  return [
    guard(p1, match.team1_name),
    guard(p2, match.team1_name),
    guard(p3, match.team2_name),
    guard(p4, match.team2_name),
  ]
}

export function namesMatch(a: string, b: string): boolean {
  const ca = cleanPlayerDisplayName(a) || a.trim()
  const cb = cleanPlayerDisplayName(b) || b.trim()
  const x = foldPlayerName(ca)
  const y = foldPlayerName(cb)
  if (!x || !y) return false
  if (x === y) return true
  const xPrimary = x.split(/\s*\/\s*/)[0]
  const yPrimary = y.split(/\s*\/\s*/)[0]
  if (xPrimary === yPrimary) return true
  // Avoid matching very short tokens ("Jo", "Ana") against longer unrelated names
  const minLen = Math.min(xPrimary.length, yPrimary.length)
  if (minLen < 3) return false
  return (
    x.startsWith(y) ||
    y.startsWith(x) ||
    xPrimary.startsWith(yPrimary) ||
    yPrimary.startsWith(xPrimary)
  )
}

type MatchNames = {
  team1_name?: string | null
  team2_name?: string | null
  player1_name?: string | null
  player2_name?: string | null
  player3_name?: string | null
  player4_name?: string | null
  /** 1 = current player on team1 (p1/p2), 2 = on team2 (p3/p4) */
  my_side?: 1 | 2 | null
}

/**
 * Partners only (same team) — for "jogadores com quem mais joga".
 * Never returns opponents or the current player.
 */
export function getPartnerNamesFromMatch(
  match: MatchNames,
  currentName?: string | null,
): string[] {
  const [n1, n2, n3, n4] = resolveFourPlayerNames(match)
  const keep = (n: string) => Boolean(n && n !== '?' && cleanPlayerDisplayName(n))

  const selfName = currentName ? cleanPlayerDisplayName(currentName) || currentName.trim() : null

  let side: 1 | 2 | null = match.my_side ?? null
  if (!side && selfName) {
    if (namesMatch(n1, selfName) || namesMatch(n2, selfName)) side = 1
    else if (namesMatch(n3, selfName) || namesMatch(n4, selfName)) side = 2
  }
  if (!side) return []

  const pair = side === 1 ? [n1, n2] : [n3, n4]
  const usable = pair.filter(keep)
  if (!selfName) return usable

  const selfKey = partnerNameKey(selfName)
  return usable.filter(
    (n) => !namesMatch(n, selfName) && partnerNameKey(n) !== selfKey,
  )
}

/**
 * Aggregate partner counts from matches, deduping name variants and excluding self.
 */
export function buildTopPartnersFromMatches(
  matches: MatchNames[],
  currentName?: string | null,
  limit = 10,
): Array<{ name: string; count: number }> {
  const map = new Map<string, { name: string; count: number }>()
  const selfKey = currentName ? partnerNameKey(currentName) : null

  for (const match of matches) {
    for (const raw of getPartnerNamesFromMatch(match, currentName)) {
      const name = cleanPlayerDisplayName(raw) || raw
      const key = partnerNameKey(name)
      if (!key || (selfKey && key === selfKey)) continue
      if (currentName && namesMatch(name, currentName)) continue
      const prev = map.get(key)
      if (prev) {
        prev.count += 1
        // Prefer the longer / more complete display name
        if (name.length > prev.name.length) prev.name = name
      } else {
        map.set(key, { name, count: 1 })
      }
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
}

/** @deprecated Prefer getPartnerNamesFromMatch for "com quem joga". Kept for feed-style "others". */
export function getOtherPlayerNamesFromMatch(
  match: MatchNames,
  currentName?: string | null,
): string[] {
  const [n1, n2, n3, n4] = resolveFourPlayerNames(match)
  return [n1, n2, n3, n4].filter(
    (n) => n && n !== '?' && !isLikelyTeamLabel(n) && (!currentName || !namesMatch(n, currentName)),
  )
}
