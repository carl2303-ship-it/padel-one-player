/** Standings helpers for Club League (same rules as Tour). */

export type DuoScores = {
  homeSet1: number | ''
  awaySet1: number | ''
  homeSet2: number | ''
  awaySet2: number | ''
  homeStb: number | ''
  awayStb: number | ''
}

export function emptyDuoScores(): DuoScores {
  return {
    homeSet1: '',
    awaySet1: '',
    homeSet2: '',
    awaySet2: '',
    homeStb: '',
    awayStb: '',
  }
}

export function needsStb(d: DuoScores): boolean {
  if (d.homeSet1 === '' || d.awaySet1 === '' || d.homeSet2 === '' || d.awaySet2 === '') {
    return false
  }
  let h = 0
  let a = 0
  if (Number(d.homeSet1) > Number(d.awaySet1)) h++
  else if (Number(d.awaySet1) > Number(d.homeSet1)) a++
  if (Number(d.homeSet2) > Number(d.awaySet2)) h++
  else if (Number(d.awaySet2) > Number(d.homeSet2)) a++
  return h === 1 && a === 1
}

/** Sets won in a duo match: set1, set2, optional STB. Winner needs 2. */
export function duoMatchSets(
  homeSet1: number,
  awaySet1: number,
  homeSet2: number,
  awaySet2: number,
  homeStb: number | null,
  awayStb: number | null
): { homeSets: number; awaySets: number; winner: 'home' | 'away' | null } {
  let homeSets = 0
  let awaySets = 0
  if (homeSet1 > awaySet1) homeSets++
  else if (awaySet1 > homeSet1) awaySets++
  if (homeSet2 > awaySet2) homeSets++
  else if (awaySet2 > homeSet2) awaySets++

  if (homeSets === 1 && awaySets === 1) {
    if (homeStb == null || awayStb == null) {
      return { homeSets, awaySets, winner: null }
    }
    if (homeStb > awayStb) homeSets++
    else if (awayStb > homeStb) awaySets++
  }

  if (homeSets >= 2) return { homeSets, awaySets, winner: 'home' }
  if (awaySets >= 2) return { homeSets, awaySets, winner: 'away' }
  return { homeSets, awaySets, winner: null }
}
