/**
 * Open Games (Encontrar Jogo) - Data layer
 * Functions to fetch/create/join open games and get club availability.
 */
import { supabase } from './supabase'
import { notifyOpenGamePlayers, notifyGameCreator, sendPushToPlayer } from './pushNotifications'
import { getTranslations } from './translations'
import { calculateNewRatings, calculateReliability, calculateProtectedReliability } from './ratingEngine'
import { logLevelChange } from './levelHistory'

const DEFAULT_TZ = 'Europe/Lisbon'

/** YYYY-MM-DD in the given timezone */
function localDateStr(d: Date, tz: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(d)
}

/** Convert a "YYYY-MM-DDThh:mm:ss" string in a given timezone to a proper UTC Date */
function clubLocalToUTC(localIso: string, tz: string = DEFAULT_TZ): Date {
  const guess = new Date(localIso + 'Z')
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(guess)
  const gH = Number(parts.find(p => p.type === 'hour')!.value)
  const gM = Number(parts.find(p => p.type === 'minute')!.value)
  const gD = Number(parts.find(p => p.type === 'day')!.value)
  const targetH = parseInt(localIso.substring(11, 13))
  const targetM = parseInt(localIso.substring(14, 16))
  const targetD = parseInt(localIso.substring(8, 10))
  const rawDayDiff = targetD - gD
  const dayDiff = rawDayDiff > 1 ? -1 : rawDayDiff < -1 ? 1 : rawDayDiff
  const diffMs = ((dayDiff * 1440) + (targetH * 60 + targetM) - (gH * 60 + gM)) * 60000
  return new Date(guess.getTime() + diffMs)
}

/** Extract hours/minutes from a Date in a given timezone */
function toClubHour(d: Date, tz: string = DEFAULT_TZ): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', hour12: false,
  }).formatToParts(d)
  return Number(parts.find(p => p.type === 'hour')!.value)
}

// ============================
// Types
// ============================

export interface OpenGamePlayer {
  id: string
  user_id: string
  player_account_id: string | null
  status: 'confirmed' | 'pending' | 'rejected'
  position: number | null
  name?: string
  avatar_url?: string | null
  level?: number | null
  player_category?: string | null
  payment_status?: 'pending' | 'paid'
}

export interface OpenGame {
  id: string
  creator_user_id: string
  club_id: string
  club_name: string
  club_logo_url: string | null
  club_city: string | null
  court_id: string | null
  court_name: string | null
  court_type: 'indoor' | 'outdoor' | 'covered' | null
  scheduled_at: string
  duration_minutes: number
  game_type: 'competitive' | 'friendly'
  gender: 'all' | 'male' | 'female' | 'mixed'
  level_min: number
  level_max: number
  price_per_player: number
  max_players: number
  status: 'open' | 'full' | 'cancelled' | 'completed'
  notes: string | null
  players: OpenGamePlayer[]
  created_at: string
  club_payment_method?: ClubPaymentMethod
  group_id?: string | null
  is_quick_result?: boolean
}

export type ClubPaymentMethod = 'at_club' | 'per_player' | 'full_court' | 'at_club_or_per_player' | 'at_club_or_full_court' | 'all'

export interface ClubWithAvailability {
  id: string
  name: string
  logo_url: string | null
  photo_url_1: string | null
  photo_url_2: string | null
  city: string | null
  address: string | null
  courts: { id: string; name: string; hourly_rate: number; peak_rate: number }[]
  operating_hours: { start: string; end: string }
  // Key = date string (YYYY-MM-DD), Value = list of available time slots
  availability: { [date: string]: TimeSlot[] }
  // Payment settings
  payment_method: ClubPaymentMethod
}

export interface CourtSlot {
  court_id: string
  court_name: string
  court_type: 'indoor' | 'outdoor' | 'covered' | null // indoor, outdoor, covered
  durations: number[] // available durations in minutes (60, 90, 120)
  price_60: number // price per player for 60min
  price_90: number // price per player for 90min
  price_120: number // price per player for 120min
}

export interface TimeSlot {
  time: string // HH:MM
  courts: CourtSlot[] // all available courts at this time
  // Legacy: first court shortcut
  durations: number[]
  court_id: string
  court_name: string
  price_90: number
  price_60: number
}

// ============================
// Fetch open games
// ============================

export async function fetchOpenGames(filters?: {
  clubId?: string
  dateFrom?: string
  dateTo?: string
  timeFrom?: string
  timeTo?: string
}): Promise<OpenGame[]> {
  // Get current user ID to filter private games
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const currentUserId = authUser?.id

  let query = supabase
    .from('open_games')
    .select('*')
    .in('status', ['open', 'full'])
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })

  if (filters?.clubId) {
    query = query.eq('club_id', filters.clubId)
  }
  if (filters?.dateFrom) {
    query = query.gte('scheduled_at', filters.dateFrom)
  }
  if (filters?.dateTo) {
    query = query.lte('scheduled_at', filters.dateTo)
  }

  const { data: gamesData, error } = await query
  if (error) {
    console.error('[OpenGames] Error fetching games:', error)
    return []
  }
  if (!gamesData || gamesData.length === 0) return []

  // Fetch all game IDs to get players
  const gameIds = gamesData.map((g: any) => g.id)
  
  // Fetch players for all games
  const { data: playersData } = await supabase
    .from('open_game_players')
    .select('*')
    .in('game_id', gameIds)
    .in('status', ['confirmed', 'pending'])

  // Fetch player account details for all players
  const userIds = [...new Set((playersData || []).map((p: any) => p.user_id).filter(Boolean))]
  const playerAccountIds = [...new Set((playersData || []).map((p: any) => p.player_account_id).filter(Boolean))]
  let playerAccountsMap: { [key: string]: { name: string; avatar_url: string | null; level: number | null; player_category: string | null } } = {}
  
  // Search by user_id first
  if (userIds.length > 0) {
    const { data: accounts } = await supabase
      .from('player_accounts')
      .select('id, user_id, name, avatar_url, level, player_category')
      .in('user_id', userIds)
    
    if (accounts) {
      accounts.forEach((a: any) => {
        playerAccountsMap[a.user_id] = {
          name: a.name,
          avatar_url: a.avatar_url,
          level: a.level,
          player_category: a.player_category,
        }
        // Also index by account id
        playerAccountsMap['pa_' + a.id] = playerAccountsMap[a.user_id]
      })
    }
  }

  // For any player_account_ids not yet matched, fetch by id
  const missingAccountIds = playerAccountIds.filter(id => !playerAccountsMap['pa_' + id])
  if (missingAccountIds.length > 0) {
    const { data: accounts2 } = await supabase
      .from('player_accounts')
      .select('id, user_id, name, avatar_url, level, player_category')
      .in('id', missingAccountIds)
    
    if (accounts2) {
      accounts2.forEach((a: any) => {
        if (!playerAccountsMap[a.user_id]) {
          playerAccountsMap[a.user_id] = {
            name: a.name,
            avatar_url: a.avatar_url,
            level: a.level,
            player_category: a.player_category,
          }
        }
        playerAccountsMap['pa_' + a.id] = {
          name: a.name,
          avatar_url: a.avatar_url,
          level: a.level,
          player_category: a.player_category,
        }
      })
    }
  }

  // Fetch club details for all games
  const clubIds = [...new Set(gamesData.map((g: any) => g.club_id))]
  let clubsMap: { [id: string]: { name: string; logo_url: string | null; city: string | null; payment_method: ClubPaymentMethod } } = {}
  
  if (clubIds.length > 0) {
    const { data: clubs } = await supabase
      .from('clubs')
      .select('id, name, logo_url, city, payment_method')
      .in('id', clubIds)
    
    if (clubs) {
      clubs.forEach((c: any) => {
        clubsMap[c.id] = { name: c.name, logo_url: c.logo_url, city: c.city, payment_method: c.payment_method || 'at_club' }
      })
    }
  }

  // Fetch court details for all games (name + type)
  const courtIds = [...new Set(gamesData.map((g: any) => g.court_id).filter(Boolean))]
  let courtsMap: { [id: string]: { name: string; type: string | null } } = {}

  if (courtIds.length > 0) {
    const { data: courts } = await supabase
      .from('club_courts')
      .select('id, name, type')
      .in('id', courtIds)
    
    if (courts) {
      courts.forEach((c: any) => {
        courtsMap[c.id] = { name: c.name, type: c.type || null }
      })
    }
  }

  // Filter out private games that the user is not part of
  // Private games should only be visible to:
  // 1. The creator
  // 2. Players who are added to the game
  const filteredGamesData = gamesData.filter((g: any) => {
    // If game is not private, show it
    if (!g.is_private) return true
    
    // If no current user, hide private games
    if (!currentUserId) return false
    
    // Show if user is the creator
    if (g.creator_user_id === currentUserId) return true
    
    // Show if user is in the players list
    const isPlayer = (playersData || []).some((p: any) => 
      p.game_id === g.id && p.user_id === currentUserId
    )
    return isPlayer
  })

  // Build the result
  const games: OpenGame[] = filteredGamesData.map((g: any) => {
    const gamePlayers = (playersData || [])
      .filter((p: any) => p.game_id === g.id)
      .map((p: any) => {
        // Prioritize player_account_id (most reliable), then user_id
        const account = (p.player_account_id ? playerAccountsMap['pa_' + p.player_account_id] : null) || playerAccountsMap[p.user_id]
        return {
          id: p.id,
          user_id: p.user_id,
          player_account_id: p.player_account_id,
          status: p.status,
          position: p.position,
          name: account?.name || (typeof window !== 'undefined' ? getTranslations().common.player : 'Jogador'),
          avatar_url: account?.avatar_url || null,
          level: account?.level || null,
          player_category: account?.player_category || null,
          payment_status: p.payment_status || 'pending',
        }
      })

    const club = clubsMap[g.club_id] || { name: (typeof window !== 'undefined' ? getTranslations().common.club : 'Clube'), logo_url: null, city: null, payment_method: 'at_club' as ClubPaymentMethod }
    const court = g.court_id ? courtsMap[g.court_id] : null

    return {
      id: g.id,
      creator_user_id: g.creator_user_id,
      club_id: g.club_id,
      club_name: club.name,
      club_logo_url: club.logo_url,
      club_city: club.city,
      court_id: g.court_id,
      court_name: court?.name || null,
      court_type: (court?.type as any) || null,
      scheduled_at: g.scheduled_at,
      duration_minutes: g.duration_minutes,
      game_type: g.game_type,
      gender: g.gender,
      level_min: parseFloat(g.level_min) || 1.0,
      level_max: parseFloat(g.level_max) || 7.0,
      price_per_player: parseFloat(g.price_per_player) || 0,
      max_players: g.max_players,
      status: g.status,
      notes: g.notes,
      players: gamePlayers,
      created_at: g.created_at,
      club_payment_method: club.payment_method,
    }
  })

  // Apply time filter if needed
  if (filters?.timeFrom || filters?.timeTo) {
    return games.filter(g => {
      const d = new Date(g.scheduled_at)
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: DEFAULT_TZ, hour: '2-digit', hour12: false }).formatToParts(d)
      const hour = Number(parts.find(p => p.type === 'hour')!.value)
      const timeFromH = filters?.timeFrom ? parseInt(filters.timeFrom.split(':')[0]) : 0
      const timeToH = filters?.timeTo ? parseInt(filters.timeTo.split(':')[0]) : 24
      return hour >= timeFromH && hour < timeToH
    })
  }

  return games
}

/**
 * Fetch open games matching a player's level (±1.0 range).
 * Excludes games the player already joined and private games they can't see.
 */
export async function fetchOpenGamesForLevel(playerLevel: number, playerUserId: string): Promise<OpenGame[]> {
  const allGames = await fetchOpenGames()
  const levelMin = playerLevel - 1.0
  const levelMax = playerLevel + 1.0

  return allGames.filter(g => {
    if (g.status !== 'open') return false
    if (g.level_min > levelMax || g.level_max < levelMin) return false
    const isPlayer = g.players.some(p => p.user_id === playerUserId)
    if (isPlayer) return false
    if (g.creator_user_id === playerUserId) return false
    return true
  })
}

// ============================
// Get member discounts for the current player across all clubs
// ============================

export async function getPlayerMemberDiscounts(): Promise<Map<string, number>> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Map()

  const { data: subs } = await supabase
    .from('member_subscriptions')
    .select('club_owner_id, plan:membership_plans(court_discount_percent)')
    .eq('user_id', user.id)
    .eq('status', 'active')

  const discountMap = new Map<string, number>()
  for (const sub of subs || []) {
    const discount = (sub.plan as any)?.court_discount_percent || 0
    if (discount > 0) discountMap.set(sub.club_owner_id, discount)
  }
  return discountMap
}

// ============================
// Fetch clubs with availability for "Crie um Jogo"
// ============================

export async function fetchClubsWithAvailability(): Promise<ClubWithAvailability[]> {
  // 1. Fetch all active managed clubs (only clubs with an owner can have bookings)
  const { data: clubs, error: clubsError } = await supabase
    .from('clubs')
    .select('id, owner_id, name, logo_url, photo_url_1, photo_url_2, city, address, payment_method, active_schedule, is_managed')
    .eq('is_active', true)
    .order('name')

  if (clubsError || !clubs || clubs.length === 0) {
    console.error('[OpenGames] Error fetching clubs:', clubsError)
    return []
  }

  // Fetch member discounts for the current player
  const memberDiscounts = await getPlayerMemberDiscounts()

  const result: ClubWithAvailability[] = []
  
  const managedClubs = clubs.filter(c => c.owner_id)

  for (const club of managedClubs) {
    // 2. Fetch courts for this club (including per-court slot config)
    const { data: courts } = await supabase
      .from('club_courts')
      .select('id, name, type, hourly_rate, peak_rate, price_90min, price_120min, peak_price_90min, peak_price_120min, court_slots')
      .eq('user_id', club.owner_id)
      .eq('is_active', true)
      .order('name')

    if (!courts || courts.length === 0) continue // Skip clubs without courts

    // 3. Fetch global settings (max_advance_days) and legacy fallback
    const { data: settings } = await supabase
      .from('user_logo_settings')
      .select('booking_start_time, booking_end_time, booking_slot_duration, max_advance_days, available_booking_slots')
      .eq('user_id', club.owner_id)
      .maybeSingle()

    const daysAhead = settings?.max_advance_days || 7

    // 4. Generate dates
    const dates: string[] = []
    const now = new Date()
    for (let i = 0; i < daysAhead; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() + i)
      dates.push(localDateStr(d))
    }

    // 5. Fetch existing bookings for these days (use local dates → ISO for consistent tz)
    const dayStart = new Date(dates[0] + 'T00:00:00')
    const dayEnd = new Date(dates[dates.length - 1] + 'T23:59:59')
    const dateFrom = dayStart.toISOString()
    const dateTo = dayEnd.toISOString()
    
    const { data: bookings } = await supabase
      .from('court_bookings')
      .select('court_id, start_time, end_time')
      .in('court_id', courts.map(c => c.id))
      .eq('status', 'confirmed')
      .gte('start_time', dateFrom)
      .lte('start_time', dateTo)

    // 6. Fetch existing open games at this club
    const { data: existingGames } = await supabase
      .from('open_games')
      .select('court_id, scheduled_at, duration_minutes')
      .eq('club_id', club.id)
      .in('status', ['open', 'full'])
      .gte('scheduled_at', dateFrom)
      .lte('scheduled_at', dateTo)

    // 7. Generate available time slots using per-court slot config
    const availability: { [date: string]: TimeSlot[] } = {}

    // Collect all unique time strings across all courts
    const allTimeStringsSet = new Set<string>()
    // Map of court_id -> { time -> durations[] } for quick lookup
    const courtSlotMap = new Map<string, Map<string, number[]>>()

    const clubSchedule = (club as any).active_schedule || 'summer'
    // Operating hours - used for the club result object
    const clubStartTime = settings?.booking_start_time || '08:00'
    const clubEndTime = settings?.booking_end_time || '22:00'

    for (const court of courts) {
      // Extract schedule based on active_schedule (summer/winter)
      const rawSlots = (court as any).court_slots as any
      let cs: { operating_start: string; operating_end: string; slots: { time: string; durations: number[] }[] } | null = null
      if (rawSlots?.schedules) {
        cs = rawSlots.schedules[clubSchedule] || rawSlots.schedules.summer || null
      } else if (rawSlots?.operating_start && rawSlots?.slots) {
        cs = rawSlots // Legacy format
      }

      if (cs && cs.slots && cs.slots.length > 0) {
        const slotMap = new Map<string, number[]>()
        for (const slot of cs.slots) {
          if (slot.durations.length > 0) {
            slotMap.set(slot.time, slot.durations)
            allTimeStringsSet.add(slot.time)
          }
        }
        courtSlotMap.set(court.id, slotMap)
      } else {
        // Legacy fallback: use global settings for courts without per-court config
        const startTime = settings?.booking_start_time || '08:00'
        const endTime = settings?.booking_end_time || '22:00'
        const slotDuration = settings?.booking_slot_duration || 90
        const clubAvailableSlots: string[] | null = settings?.available_booking_slots && Array.isArray(settings.available_booking_slots)
          ? settings.available_booking_slots
          : null

        const [openH, openM] = startTime.split(':').map(Number)
        const [closeH, closeM] = endTime.split(':').map(Number)
        const openMinutes = openH * 60 + openM
        const closeMinutes = closeH * 60 + closeM

        const slotMap = new Map<string, number[]>()
        let legacySlotTimes: string[] = []
        if (clubAvailableSlots && clubAvailableSlots.length > 0) {
          legacySlotTimes = clubAvailableSlots.filter(s => {
            const [h, m] = s.split(':').map(Number)
            return h * 60 + m >= openMinutes && h * 60 + m < closeMinutes
          })
        } else {
          for (let m = openMinutes; m + slotDuration <= closeMinutes; m += slotDuration) {
            const h = Math.floor(m / 60)
            const min = m % 60
            legacySlotTimes.push(`${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`)
          }
        }
        for (const t of legacySlotTimes) {
          slotMap.set(t, [60, 90, 120]) // Legacy: all durations
          allTimeStringsSet.add(t)
        }
        courtSlotMap.set(court.id, slotMap)
      }
    }

    const allTimeStrings = Array.from(allTimeStringsSet).sort()
    
    for (const date of dates) {
      const slots: TimeSlot[] = []

      // For today, skip slots that already passed (current time + 1 hour buffer)
      const minStartMinutes = date === dates[0]
        ? now.getHours() * 60 + now.getMinutes() + 60
        : 0

      for (const timeStr of allTimeStrings) {
        const [slotH, slotM] = timeStr.split(':').map(Number)
        const slotMinutes = slotH * 60 + slotM

        // Skip past slots for today
        if (slotMinutes < minStartMinutes) continue

        const slotStart = new Date(`${date}T${timeStr}:00`)

        // Check ALL courts for availability at this time with their configured durations
        const courtSlots: CourtSlot[] = []

        for (const court of courts) {
          const slotMap = courtSlotMap.get(court.id)
          if (!slotMap) continue
          const allowedDurations = slotMap.get(timeStr)
          if (!allowedDurations || allowedDurations.length === 0) continue

          // Get this court's closing time from active schedule
          const rawCS = (court as any).court_slots as any
          let courtSchedule: { operating_end: string } | null = null
          if (rawCS?.schedules) {
            courtSchedule = rawCS.schedules[clubSchedule] || rawCS.schedules.summer
          } else if (rawCS?.operating_end) {
            courtSchedule = rawCS
          }
          const courtEndTime = courtSchedule ? courtSchedule.operating_end : (settings?.booking_end_time || '22:00')
          // Handle midnight: if end time is 00:00, set closing to next day midnight
          let closingTime: Date
          if (courtEndTime === '00:00') {
            closingTime = new Date(`${date}T00:00:00`)
            closingTime.setDate(closingTime.getDate() + 1)
          } else {
            closingTime = new Date(`${date}T${courtEndTime}:00`)
          }

          // Check which of the allowed durations are actually available (no conflicts)
          const availableDurations: number[] = []
          for (const dur of allowedDurations) {
            const durEnd = new Date(slotStart.getTime() + dur * 60000)
            if (durEnd > closingTime) continue
            if (isSlotAvailable(court.id, slotStart, durEnd, bookings || [], existingGames || [])) {
              availableDurations.push(dur)
            }
          }

          if (availableDurations.length > 0) {
            const hourlyRate = parseFloat((court as any).hourly_rate as any) || 0
            const explicit90 = (court as any).price_90min != null ? Number((court as any).price_90min) : null
            const explicit120 = (court as any).price_120min != null ? Number((court as any).price_120min) : null

            const total60 = hourlyRate
            const total90 = explicit90 != null ? explicit90 : hourlyRate * 1.5
            const total120 = explicit120 != null ? explicit120 : hourlyRate * 2

            const memberDiscount = memberDiscounts.get(club.owner_id) || 0
            const factor = 1 - (memberDiscount / 100)

            const price60 = Math.round((total60 / 4) * factor * 100) / 100
            const price90 = Math.round((total90 / 4) * factor * 100) / 100
            const price120 = Math.round((total120 / 4) * factor * 100) / 100

            courtSlots.push({
              court_id: court.id,
              court_name: court.name,
              court_type: (court as any).type || null,
              durations: availableDurations,
              price_60: price60,
              price_90: price90,
              price_120: price120,
            })
          }
        }

        if (courtSlots.length > 0) {
          slots.push({
            time: timeStr,
            courts: courtSlots,
            // Legacy defaults from first court
            durations: courtSlots[0].durations,
            court_id: courtSlots[0].court_id,
            court_name: courtSlots[0].court_name,
            price_90: courtSlots[0].price_90,
            price_60: courtSlots[0].price_60,
          })
        }
      }
      
      if (slots.length > 0) {
        availability[date] = slots
      }
    }

    if (Object.keys(availability).length > 0) {
      result.push({
        id: club.id,
        name: club.name,
        logo_url: club.logo_url,
        photo_url_1: (club as any).photo_url_1 || null,
        photo_url_2: (club as any).photo_url_2 || null,
        city: club.city,
        address: club.address,
        courts: courts.map(c => ({
          id: c.id,
          name: c.name,
          hourly_rate: parseFloat(c.hourly_rate as any) || 0,
          peak_rate: parseFloat(c.peak_rate as any) || 0,
        })),
        operating_hours: { start: clubStartTime, end: clubEndTime },
        availability,
        payment_method: (club as any).payment_method || 'at_club',
      })
    }
  }

  return result
}

function isSlotAvailable(
  courtId: string,
  slotStart: Date,
  slotEnd: Date,
  bookings: any[],
  existingGames: any[]
): boolean {
  // Check against bookings
  for (const b of bookings) {
    if (b.court_id !== courtId) continue
    const bStart = new Date(b.start_time)
    const bEnd = new Date(b.end_time)
    if (slotStart < bEnd && slotEnd > bStart) return false // Overlap
  }
  
  // Check against existing open games
  for (const g of existingGames) {
    if (g.court_id !== courtId) continue
    const gStart = new Date(g.scheduled_at)
    const gEnd = new Date(gStart.getTime() + (g.duration_minutes || 90) * 60000)
    if (slotStart < gEnd && slotEnd > gStart) return false
  }
  
  return true
}

// ============================
// Create a new open game
// ============================

export async function createOpenGame(params: {
  userId: string
  playerAccountId?: string | null
  playerName?: string | null
  playerPhone?: string | null
  clubId: string
  courtId: string
  scheduledAt: string
  durationMinutes: number
  gameType: 'competitive' | 'friendly'
  gender: 'all' | 'male' | 'female' | 'mixed'
  playerLevel: number
  pricePerPlayer: number
  isPrivate?: boolean
  groupId?: string
  players?: { player_account_id: string; position: number; name: string | null; phone_number: string | null }[]
  clubTimezone?: string
}): Promise<{ success: boolean; gameId?: string; error?: string }> {
  // Always use the real auth uid for RLS compliance
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const realUserId = authUser?.id
  if (!realUserId) {
    return { success: false, error: 'Utilizador não autenticado' }
  }
  // Creating game with realUserId (auth.uid)

  // Calculate level range (±0.5 from player level)
  const levelMin = Math.max(0.5, params.playerLevel - 0.5)
  const levelMax = params.playerLevel + 0.5

  let tz = params.clubTimezone || DEFAULT_TZ
  if (!params.clubTimezone) {
    const { data: clubTz } = await supabase
      .from('clubs')
      .select('timezone')
      .eq('id', params.clubId)
      .maybeSingle()
    if (clubTz?.timezone) tz = clubTz.timezone
  }

  const scheduledAtDate = clubLocalToUTC(params.scheduledAt, tz)
  const scheduledAtISO = scheduledAtDate.toISOString()

  // Create the game
  const { data: game, error: gameError } = await supabase
    .from('open_games')
    .insert({
      creator_user_id: realUserId,
      club_id: params.clubId,
      court_id: params.courtId,
      scheduled_at: scheduledAtISO,
      duration_minutes: params.durationMinutes,
      game_type: params.gameType,
      gender: params.gender,
      level_min: levelMin,
      level_max: levelMax,
      price_per_player: params.pricePerPlayer,
      max_players: 4,
      status: 'open', // Always start as open - status 'full' only when all 4 players are added
      is_private: params.isPrivate || !!params.groupId || false,
      ...(params.groupId ? { group_id: params.groupId } : {}),
    })
    .select('id')
    .single()

  if (gameError || !game) {
    console.error('[OpenGames] Error creating game:', gameError)
    const msg = gameError?.message || 'Erro ao criar jogo'
    const hint = gameError?.code === '42501' 
      ? ' (Sem permissão — verifique as políticas RLS)' 
      : gameError?.code === '23503' 
        ? ' (Referência inválida — clube ou campo não existe)' 
        : ''
    return { success: false, error: msg + hint }
  }

  // Use player data passed directly (most reliable) or look up as fallback
  const playerAccountId = params.playerAccountId || null
  const playerName = params.playerName || null
  const playerPhone = params.playerPhone || null

  // Only query if we don't have the data already
  let resolvedAccountId = playerAccountId
  let resolvedName = playerName
  let resolvedPhone = playerPhone

  if (!resolvedAccountId || !resolvedName) {
    // Try by params.userId first (the player_accounts.user_id), then realUserId
    const { data: pa } = await supabase
      .from('player_accounts')
      .select('id, name, phone_number')
      .eq('user_id', params.userId)
      .maybeSingle()

    if (pa) {
      resolvedAccountId = resolvedAccountId || pa.id
      resolvedName = resolvedName || pa.name
      resolvedPhone = resolvedPhone || pa.phone_number
    }
  }

  // Add creator as first player (use realUserId for RLS)
  const { error: playerError } = await supabase
    .from('open_game_players')
    .insert({
      game_id: game.id,
      user_id: realUserId,
      player_account_id: resolvedAccountId,
      status: 'confirmed',
      position: 1,
    })

  if (playerError) {
    console.error('[OpenGames] Error adding creator to game:', playerError)
  }

  // Auto-register creator at this club (for future notifications)
  if (resolvedAccountId && params.clubId) {
    supabase
      .from('player_clubs')
      .select('id')
      .eq('player_account_id', resolvedAccountId)
      .eq('club_id', params.clubId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          return supabase
            .from('player_clubs')
            .insert({ player_account_id: resolvedAccountId, club_id: params.clubId })
        }
      })
      .catch((err) => console.error('[OpenGames] Error auto-registering player at club:', err))
  }

  // Add other players if provided (for private bookings)
  if (params.players && params.players.length > 0) {
    const otherPlayers = params.players.filter(p => p.player_account_id !== resolvedAccountId)
    if (otherPlayers.length > 0) {
      const accountIds = otherPlayers.map(p => p.player_account_id)
      const { data: accounts } = await supabase
        .from('player_accounts')
        .select('id, user_id')
        .in('id', accountIds)

      const userIdMap = new Map(
        (accounts || []).map((a: any) => [a.id, a.user_id])
      )

      const playerInserts = otherPlayers
        .filter(p => userIdMap.get(p.player_account_id))
        .map(p => ({
          game_id: game.id,
          user_id: userIdMap.get(p.player_account_id),
          player_account_id: p.player_account_id,
          status: 'confirmed' as const,
          position: p.position,
        }))

      if (playerInserts.length > 0) {
        const { error: otherPlayersError } = await supabase.from('open_game_players').insert(playerInserts)
        if (otherPlayersError) {
          console.error('[OpenGames] Error adding other players to game:', otherPlayersError)
        }
      }
    }
  }

  // === Sync: Create a court_booking in the Manager app's agenda ===
  try {
    // Get the club owner_id (needed for the booking user_id)
    const { data: club } = await supabase
      .from('clubs')
      .select('owner_id')
      .eq('id', params.clubId)
      .single()

    // Get the court name for the notification
    const { data: courtData } = await supabase
      .from('club_courts')
      .select('name')
      .eq('id', params.courtId)
      .maybeSingle()

    const courtName = courtData?.name || 'Campo'

    if (club) {
      const startDate = clubLocalToUTC(params.scheduledAt, tz)
      const endTime = new Date(startDate.getTime() + params.durationMinutes * 60000)
      const gameTypeLabel = params.gameType === 'competitive' ? 'Competitivo' : 'Amigável'
      const bookingName = resolvedName || (typeof window !== 'undefined' ? getTranslations().common.player : 'Jogador')

      const { data: bookingData } = await supabase.from('court_bookings').insert({
        user_id: realUserId,
        court_id: params.courtId,
        start_time: startDate.toISOString(),
        end_time: endTime.toISOString(),
        booked_by_name: bookingName,
        booked_by_phone: resolvedPhone || null,
        player1_name: bookingName,
        player1_phone: resolvedPhone || null,
        player1_is_member: false,
        player1_discount: 0,
        player2_is_member: false,
        player2_discount: 0,
        player3_is_member: false,
        player3_discount: 0,
        player4_is_member: false,
        player4_discount: 0,
        status: 'confirmed',
        price: params.pricePerPlayer * 4,
        payment_status: 'pending',
        event_type: 'open_game',
        notes: `Jogo Aberto (${gameTypeLabel}) - Criado pela app Player | ID: ${game.id}`
      }).select('id').maybeSingle()

      // Sync player details + member check to the booking
      await syncBookingPlayers(game.id)

      // === Notify Manager about the new booking ===
      try {
        const supabaseUrl = 'https://rqiwnxcexsccguruiteq.supabase.co'
        const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxaXdueGNleHNjY2d1cnVpdGVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3Njc5MzcsImV4cCI6MjA3NTM0MzkzN30.Dl05zPQDtPVpmvn_Y-JokT3wDq0Oh9uF3op5xcHZpkY'
        await fetch(`${supabaseUrl}/functions/v1/notify-manager`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`
          },
          body: JSON.stringify({
            userId: club.owner_id,
            type: 'booking_created',
            bookingId: bookingData?.id || game.id,
            courtName,
            playerName: bookingName,
            scheduledAt: scheduledAtISO
          })
        })
      } catch (notifyErr) {
        console.error('[OpenGames] Error notifying manager about booking:', notifyErr)
      }
    }
  } catch (syncErr) {
    console.error('[OpenGames] Error syncing court booking:', syncErr)
    // Don't fail the game creation if sync fails
  }

  // Award reward points for creating a game
  if (resolvedAccountId) {
    try {
      await awardGameRewardPoints(game.id, 'create_game')
      // Check if this is the player's first game on the platform
      await checkAndAwardFirstGame(game.id)
    } catch (err) {
      console.error('[Rewards] Error awarding create_game points:', err)
    }
  }

  // Notify matching players via server-side Edge Function (reliable)
  if (!params.isPrivate) {
    try {
      const { data: clubForNotif } = await supabase
        .from('clubs')
        .select('name')
        .eq('id', params.clubId)
        .maybeSingle()

      const supabaseUrl = 'https://rqiwnxcexsccguruiteq.supabase.co'
      const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxaXdueGNleHNjY2d1cnVpdGVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3Njc5MzcsImV4cCI6MjA3NTM0MzkzN30.Dl05zPQDtPVpmvn_Y-JokT3wDq0Oh9uF3op5xcHZpkY'
      const { data: { session } } = await supabase.auth.getSession()

      fetch(`${supabaseUrl}/functions/v1/notify-new-open-game`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          gameId: game.id,
          creatorUserId: realUserId,
          creatorPlayerAccountId: resolvedAccountId,
          creatorName: resolvedName,
          levelMin,
          levelMax,
          gender: params.gender,
          scheduledAt: scheduledAtISO,
          clubId: params.clubId,
          clubName: clubForNotif?.name || 'Clube',
          gameType: params.gameType,
        }),
      }).then(async (resp) => {
        const result = await resp.json().catch(() => null)
        console.log('[Push] notify-new-open-game response:', resp.status, result)
      }).catch(err => console.error('[Push] notify-new-open-game fetch error:', err))
    } catch (err) {
      console.error('[Push] Error triggering matching player notifications:', err)
    }
  }

  return { success: true, gameId: game.id }
}

// ============================
// Sync open game players → court_booking (names, phones, member discounts)
// ============================

async function syncBookingPlayers(gameId: string) {
  try {
    // 1. Get all confirmed players for this game
    const { data: gamePlayers } = await supabase
      .from('open_game_players')
      .select('player_account_id, user_id, position')
      .eq('game_id', gameId)
      .eq('status', 'confirmed')
      .order('position', { ascending: true })

    if (!gamePlayers) return

    // 2. Get player account details (name, phone)
    const accountIds = gamePlayers.map(p => p.player_account_id).filter(Boolean)
    let accountsMap: Record<string, { name: string; phone: string | null }> = {}

    if (accountIds.length > 0) {
      const { data: accounts } = await supabase
        .from('player_accounts')
        .select('id, name, phone_number')
        .in('id', accountIds)

      if (accounts) {
        accounts.forEach(a => {
          accountsMap[a.id] = { name: a.name, phone: a.phone_number }
        })
      }
    }

    // 3. Get the game's club to find club owner
    const { data: game } = await supabase
      .from('open_games')
      .select('club_id, price_per_player')
      .eq('id', gameId)
      .maybeSingle()

    if (!game) return

    const { data: club } = await supabase
      .from('clubs')
      .select('owner_id')
      .eq('id', game.club_id)
      .maybeSingle()

    if (!club) return

    // 4. Build player data (up to 4 players)
    const playerSlots: { name: string | null; phone: string | null; isMember: boolean; discount: number }[] = []

    for (let i = 0; i < 4; i++) {
      const gp = gamePlayers[i]
      if (gp && gp.player_account_id && accountsMap[gp.player_account_id]) {
        const acct = accountsMap[gp.player_account_id]
        playerSlots.push({ name: acct.name, phone: acct.phone || null, isMember: false, discount: 0 })
      } else if (gp) {
        playerSlots.push({ name: null, phone: null, isMember: false, discount: 0 })
      } else {
        playerSlots.push({ name: null, phone: null, isMember: false, discount: 0 })
      }
    }

    // 5. Check member status for each player
    for (let i = 0; i < playerSlots.length; i++) {
      const ps = playerSlots[i]
      if (!ps.name && !ps.phone) continue

      const normalizedPhone = ps.phone ? ps.phone.replace(/[\s\-\(\)\.]/g, '').replace(/^00/, '+') : ''

      let query = supabase
        .from('member_subscriptions')
        .select('member_name, member_phone, plan:membership_plans(name, court_discount_percent)')
        .eq('club_owner_id', club.owner_id)
        .eq('status', 'active')

      if (normalizedPhone && normalizedPhone.length >= 6) {
        query = query.or(`member_phone.ilike.%${normalizedPhone}%`)
      } else if (ps.name && ps.name.length >= 2) {
        query = query.ilike('member_name', `%${ps.name}%`)
      } else {
        continue
      }

      const { data: memberData } = await query.limit(1).maybeSingle()

      if (memberData && memberData.plan) {
        playerSlots[i].isMember = true
        playerSlots[i].discount = (memberData.plan as any).court_discount_percent || 0
      }
    }

    // 6. Calculate price with discounts
    const pricePerPlayer = parseFloat(game.price_per_player) || 0
    let totalPrice = 0
    for (const ps of playerSlots) {
      if (ps.name) {
        const playerPrice = pricePerPlayer - (pricePerPlayer * (ps.discount / 100))
        totalPrice += playerPrice
      }
    }
    // If less than 4 named players, fill remaining with full price
    const namedCount = playerSlots.filter(p => p.name).length
    if (namedCount < 4) {
      totalPrice += pricePerPlayer * (4 - namedCount)
    }

    // 7. Update the court_booking
    const updateData: Record<string, any> = {
      booked_by_name: playerSlots[0].name || (typeof window !== 'undefined' ? getTranslations().common.player : 'Jogador'),
      booked_by_phone: playerSlots[0].phone || null,
      player1_name: playerSlots[0].name || null,
      player1_phone: playerSlots[0].phone || null,
      player1_is_member: playerSlots[0].isMember,
      player1_discount: playerSlots[0].discount,
      player2_name: playerSlots[1].name || null,
      player2_phone: playerSlots[1].phone || null,
      player2_is_member: playerSlots[1].isMember,
      player2_discount: playerSlots[1].discount,
      player3_name: playerSlots[2].name || null,
      player3_phone: playerSlots[2].phone || null,
      player3_is_member: playerSlots[2].isMember,
      player3_discount: playerSlots[2].discount,
      player4_name: playerSlots[3].name || null,
      player4_phone: playerSlots[3].phone || null,
      player4_is_member: playerSlots[3].isMember,
      player4_discount: playerSlots[3].discount,
      price: totalPrice,
    }

    await supabase
      .from('court_bookings')
      .update(updateData)
      .like('notes', `%ID: ${gameId}%`)
      .eq('event_type', 'open_game')

  } catch (err) {
    console.error('[OpenGames] Error syncing booking players:', err)
  }
}

// ============================
// Join an open game
// ============================

export async function joinOpenGame(params: {
  gameId: string
  userId: string
  playerAccountId?: string | null
  playerLevel: number
  gameLevelMin: number
  gameLevelMax: number
  position?: number // Optional: position to join (1-4). If not provided, uses next available position.
}): Promise<{ success: boolean; status: 'confirmed' | 'pending'; error?: string }> {
  // Always use real auth uid for RLS
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const realUserId = authUser?.id
  if (!realUserId) {
    return { success: false, status: 'pending', error: 'Utilizador não autenticado' }
  }

  // Check if player is within level range
  const isWithinRange = params.playerLevel >= params.gameLevelMin && params.playerLevel <= params.gameLevelMax
  const joinStatus = isWithinRange ? 'confirmed' : 'pending'

  // Use provided playerAccountId or look up
  let resolvedAccountId = params.playerAccountId || null
  if (!resolvedAccountId) {
    const { data: pa } = await supabase
      .from('player_accounts')
      .select('id')
      .eq('user_id', params.userId)
      .maybeSingle()
    resolvedAccountId = pa?.id || null
  }

  // Get current players to determine available positions
  const { data: existingPlayers } = await supabase
    .from('open_game_players')
    .select('position')
    .eq('game_id', params.gameId)
    .eq('status', 'confirmed')
  
  const occupiedPositions = new Set((existingPlayers || []).map(p => p.position).filter(Boolean))
  
  // If position is specified, check if it's available
  let selectedPosition: number
  if (params.position) {
    if (occupiedPositions.has(params.position)) {
      return { success: false, status: 'pending', error: 'Essa posição já está ocupada' }
    }
    selectedPosition = params.position
  } else {
    // Auto-select next available position (1-4)
    for (let pos = 1; pos <= 4; pos++) {
      if (!occupiedPositions.has(pos)) {
        selectedPosition = pos
        break
      }
    }
    // If all positions are taken (shouldn't happen), use next number
    if (!selectedPosition!) {
      selectedPosition = (existingPlayers && existingPlayers.length > 0) 
        ? (existingPlayers[existingPlayers.length - 1].position || 0) + 1 
        : 1
    }
  }

  const { error } = await supabase
    .from('open_game_players')
    .insert({
      game_id: params.gameId,
      user_id: realUserId,
      player_account_id: resolvedAccountId,
      status: joinStatus,
      position: joinStatus === 'confirmed' ? selectedPosition : null,
    })

  if (error) {
    if (error.code === '23505') {
      return { success: false, status: joinStatus, error: 'Já estás inscrito neste jogo' }
    }
    console.error('[OpenGames] Error joining game:', error)
    return { success: false, status: joinStatus, error: error.message }
  }

  // Check if game is now full
  if (joinStatus === 'confirmed') {
    const { data: confirmedPlayers } = await supabase
      .from('open_game_players')
      .select('id')
      .eq('game_id', params.gameId)
      .eq('status', 'confirmed')

    const { data: game } = await supabase
      .from('open_games')
      .select('max_players, club_id')
      .eq('id', params.gameId)
      .maybeSingle()

    if (confirmedPlayers && game && confirmedPlayers.length >= game.max_players) {
      await supabase
        .from('open_games')
        .update({ status: 'full' })
        .eq('id', params.gameId)
    }

    // Auto-register player at this club (for future notifications)
    if (resolvedAccountId && game?.club_id) {
      supabase
        .from('player_clubs')
        .select('id')
        .eq('player_account_id', resolvedAccountId)
        .eq('club_id', game.club_id)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) {
            return supabase
              .from('player_clubs')
              .insert({ player_account_id: resolvedAccountId, club_id: game.club_id })
          }
        })
        .catch((err) => console.error('[OpenGames] Error auto-registering player at club:', err))
    }
  }

  // Sync player details to court_booking
  await syncBookingPlayers(params.gameId)

  // Award reward points for joining
  if (joinStatus === 'confirmed') {
    try {
      await awardGameRewardPoints(params.gameId, 'join_game')
      // Check if this is the player's first game on the platform
      await checkAndAwardFirstGame(params.gameId)
    } catch (err) {
      console.error('[Rewards] Error awarding join_game points:', err)
    }
  }

  // 🔔 Push: notify game creator and other players
  try {
    const t = getTranslations()
    const playerName = await getPlayerName(resolvedAccountId)
    if (joinStatus === 'confirmed') {
      // Notify creator: someone joined
      notifyGameCreator(params.gameId, {
        title: t.notifications.newPlayerInYourGame,
        body: t.notifications.newPlayerInGameBody.replace('{name}', playerName),
        url: '/?screen=games',
        tag: `join-${params.gameId}`,
      })
      // Notify other players
      notifyOpenGamePlayers(params.gameId, resolvedAccountId, {
        title: t.notifications.newPlayerInGame,
        body: t.notifications.newPlayerInGameBody.replace('{name}', playerName),
        url: '/?screen=games',
        tag: `join-${params.gameId}`,
      })
    } else {
      // Pending request - notify confirmed players
      notifyOpenGamePlayers(params.gameId, resolvedAccountId, {
        title: t.notifications.joinRequest,
        body: t.notifications.joinRequestBody.replace('{name}', playerName),
        url: '/?screen=games',
        tag: `request-${params.gameId}`,
      })
    }
  } catch {}

  return { success: true, status: joinStatus }
}

// ============================
// Leave an open game
// ============================

export async function leaveOpenGame(gameId: string, userId: string): Promise<boolean> {
  // Use real auth uid for RLS
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const realUserId = authUser?.id || userId

  const { error } = await supabase
    .from('open_game_players')
    .delete()
    .eq('game_id', gameId)
    .eq('user_id', realUserId)

  if (error) {
    console.error('[OpenGames] Error leaving game:', error)
    return false
  }

  // Re-open game if it was full
  await supabase
    .from('open_games')
    .update({ status: 'open' })
    .eq('id', gameId)
    .eq('status', 'full')

  // Sync player details to court_booking
  await syncBookingPlayers(gameId)

  // 🔔 Push: notify game players that someone left
  try {
    // Get player_account_id for the leaving user
    const { data: pa } = await supabase
      .from('player_accounts')
      .select('id, name')
      .eq('user_id', realUserId)
      .maybeSingle()
    const t = getTranslations()
    const leavingName = pa?.name || t.notifications.aPlayer
    
    notifyGameCreator(gameId, {
      title: t.notifications.playerLeftGame,
      body: t.notifications.playerLeftYourGame.replace('{name}', leavingName),
      url: '/?screen=games',
      tag: `leave-${gameId}`,
    })
    notifyOpenGamePlayers(gameId, pa?.id || null, {
      title: t.notifications.playerLeftGame,
      body: t.notifications.playerLeftGameBody.replace('{name}', leavingName),
      url: '/?screen=games',
      tag: `leave-${gameId}`,
    })
  } catch {}

  return true
}

// ============================
// Remove a player from an open game (creator or club owner can remove any player)
// ============================

export async function removePlayerFromOpenGame(params: {
  gameId: string
  playerId: string // open_game_players.id
  playerAccountId?: string | null
  playerName?: string
}): Promise<boolean> {
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser?.id) return false

  // Delete the player from the game
  const { error } = await supabase
    .from('open_game_players')
    .delete()
    .eq('id', params.playerId)
    .eq('game_id', params.gameId)

  if (error) {
    console.error('[OpenGames] Error removing player from game:', error)
    return false
  }

  // Re-open game if it was full
  await supabase
    .from('open_games')
    .update({ status: 'open' })
    .eq('id', params.gameId)
    .in('status', ['full'])

  // Sync player details to court_booking
  await syncBookingPlayers(params.gameId)

  // 🔔 Push: notify the removed player
  try {
    if (params.playerAccountId) {
      const t = getTranslations()
      sendPushToPlayer(params.playerAccountId, {
        title: t.notifications.removedFromGame || 'Removido do jogo',
        body: t.notifications.removedFromGameBody || 'O organizador removeu-te do jogo.',
        url: '/?screen=games',
        tag: `removed-${params.gameId}`,
      })
    }
    // Notify other players
    const { data: pa } = await supabase
      .from('player_accounts')
      .select('id, name')
      .eq('user_id', authUser.id)
      .maybeSingle()
    const t = getTranslations()
    const removedName = params.playerName || 'Um jogador'
    notifyOpenGamePlayers(params.gameId, params.playerAccountId || null, {
      title: t.notifications.playerLeftGame,
      body: `${removedName} foi removido do jogo`,
      url: '/?screen=games',
      tag: `removed-${params.gameId}`,
    })
  } catch {}

  return true
}

// ============================
// Cancel an open game (creator only)
// ============================

export async function cancelOpenGame(gameId: string): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = session?.access_token || null

  // Gather booking/club context to notify Manager (email + push) on cancellation.
  let notifyPayload: {
    userId: string
    bookingId?: string
    courtName?: string
    playerName?: string
    playerNames?: string[]
    scheduledAt?: string
    endAt?: string
  } | null = null
  try {
    const { data: game } = await supabase
      .from('open_games')
      .select('id, club_id, court_id, scheduled_at, duration_minutes')
      .eq('id', gameId)
      .maybeSingle()

    if (game?.club_id) {
      const [{ data: club }, { data: court }, { data: booking }] = await Promise.all([
        supabase.from('clubs').select('owner_id').eq('id', game.club_id).maybeSingle(),
        game.court_id
          ? supabase.from('club_courts').select('name').eq('id', game.court_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
        supabase
          .from('court_bookings')
          .select('id, start_time, end_time, player1_name, player2_name, player3_name, player4_name, booked_by_name')
          .eq('event_type', 'open_game')
          .like('notes', `%ID: ${gameId}%`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      const fallbackEndAt = game.scheduled_at && game.duration_minutes
        ? new Date(new Date(game.scheduled_at).getTime() + Number(game.duration_minutes) * 60000).toISOString()
        : undefined

      if (club?.owner_id) {
        const names = [
          booking?.player1_name,
          booking?.player2_name,
          booking?.player3_name,
          booking?.player4_name,
        ].filter(Boolean) as string[]
        notifyPayload = {
          userId: club.owner_id,
          bookingId: booking?.id || gameId,
          courtName: court?.name || 'Campo',
          playerName: booking?.player1_name || booking?.booked_by_name || 'Cliente',
          playerNames: names.length ? names : undefined,
          scheduledAt: booking?.start_time || game.scheduled_at,
          endAt: booking?.end_time || fallbackEndAt,
        }
      }
    }
  } catch (ctxErr) {
    console.warn('[OpenGames] Failed to prepare manager cancellation payload:', ctxErr)
  }

  const { error } = await supabase
    .from('open_games')
    .update({ status: 'cancelled' })
    .eq('id', gameId)

  if (error) {
    console.error('[OpenGames] Error cancelling game:', error)
    return false
  }

  // Also cancel the corresponding court_booking
  try {
    const { error: bookingCancelError } = await supabase
      .from('court_bookings')
      .update({ status: 'cancelled' })
      .like('notes', `%ID: ${gameId}%`)
      .eq('event_type', 'open_game')
    if (bookingCancelError) throw bookingCancelError
  } catch (e) {
    // Fallback with service-role edge function for bookings created with another owner user_id.
    if (accessToken) {
      try {
        const resp = await fetch(`https://rqiwnxcexsccguruiteq.supabase.co/functions/v1/cancel-open-game-booking`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhc2UiLCJyZWYiOiJycWl3bnhjZXhzY2NndXJ1aXRlcSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzU5NzY3OTM3LCJleHAiOjIwNzUzNDM5Mzd9.Dl05zPQDtPVpmvn_Y-JokT3wDq0Oh9uF3op5xcHZpkY',
          },
          body: JSON.stringify({ gameId }),
        })
        const json = await resp.json().catch(() => ({}))
        if (!resp.ok || json?.success === false) {
          console.warn('[OpenGames] cancel-open-game-booking fallback failed:', json?.error || resp.status)
        }
      } catch (fallbackError) {
        console.warn('[OpenGames] cancel-open-game-booking fallback error:', fallbackError)
      }
    }
  }

  // Notify Manager about cancellation (triggers email to booking managers in Manager app).
  if (notifyPayload) {
    try {
      await fetch(`https://rqiwnxcexsccguruiteq.supabase.co/functions/v1/notify-manager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken || 'anon'}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhc2UiLCJyZWYiOiJycWl3bnhjZXhzY2NndXJ1aXRlcSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzU5NzY3OTM3LCJleHAiOjIwNzUzNDM5Mzd9.Dl05zPQDtPVpmvn_Y-JokT3wDq0Oh9uF3op5xcHZpkY',
        },
        body: JSON.stringify({
          ...notifyPayload,
          type: 'booking_cancelled',
        }),
      })
    } catch (notifyErr) {
      console.warn('[OpenGames] Error notifying manager about cancelled booking:', notifyErr)
    }
  }

  // Delete game players and game from DB after cancellation
  try {
    await supabase.from('open_game_players').delete().eq('game_id', gameId)
    await supabase.from('open_games').delete().eq('id', gameId)
    console.log('[OpenGames] Game and players deleted from DB after cancellation')
  } catch (delErr) {
    console.warn('[OpenGames] Error deleting cancelled game from DB:', delErr)
  }

  return true
}

// ============================
// Add a player (by player_account_id) to an open game
// Now uses RPC so any confirmed player or club owner can add
// ============================

export async function addPlayerToOpenGame(params: {
  gameId: string
  playerAccountId: string
  position?: number
}): Promise<{ success: boolean; error?: string }> {
  console.log('[addPlayerToOpenGame] calling RPC with:', { gameId: params.gameId, playerAccountId: params.playerAccountId, position: params.position })
  const { data, error } = await supabase.rpc('add_player_to_open_game', {
    p_game_id: params.gameId,
    p_player_account_id: params.playerAccountId,
  })

  console.log('[addPlayerToOpenGame] RPC result:', { data, error })

  if (error) {
    console.error('[OpenGames] Error adding player to game:', error)
    return { success: false, error: error.message }
  }

  const result = data as any
  if (!result?.success) {
    return { success: false, error: result?.error || 'Erro desconhecido' }
  }

  // Fix user_id: the SQL function may have used the caller's user_id as fallback
  try {
    const { data: account } = await supabase
      .from('player_accounts')
      .select('user_id')
      .eq('id', params.playerAccountId)
      .maybeSingle()
    
    await supabase
      .from('open_game_players')
      .update({ user_id: account?.user_id || null })
      .eq('game_id', params.gameId)
      .eq('player_account_id', params.playerAccountId)
  } catch (err) {
    console.error('[OpenGames] Error updating user_id after adding player:', err)
  }

  if (params.position) {
    try {
      const { data: existing } = await supabase
        .from('open_game_players')
        .select('id, player_account_id, position')
        .eq('game_id', params.gameId)
        .eq('status', 'confirmed')
      console.log('[addPlayerToOpenGame] existing players before reposition:', existing)
      const occupant = (existing || []).find(p => p.position === params.position && p.player_account_id !== params.playerAccountId)
      const newPlayer = (existing || []).find(p => p.player_account_id === params.playerAccountId)
      console.log('[addPlayerToOpenGame] reposition:', { targetPos: params.position, occupant, newPlayer })
      if (occupant && newPlayer) {
        await supabase.from('open_game_players').update({ position: newPlayer.position }).eq('id', occupant.id)
        await supabase.from('open_game_players').update({ position: params.position }).eq('id', newPlayer.id)
      } else if (newPlayer) {
        await supabase.from('open_game_players').update({ position: params.position }).eq('id', newPlayer.id)
      }
    } catch (err) {
      console.error('[OpenGames] Error repositioning player:', err)
    }
  }

  // Sync player details to court_booking
  await syncBookingPlayers(params.gameId)

  // 🔔 Push: notify the added player
  try {
    const t = getTranslations()
    const playerName = await getPlayerName(params.playerAccountId)
    sendPushToPlayer(params.playerAccountId, {
      title: t.notifications.addedToGame,
      body: t.notifications.addedToGameBody,
      url: '/?screen=games',
      tag: `added-${params.gameId}`,
    })
    // Also notify other players
    notifyOpenGamePlayers(params.gameId, params.playerAccountId, {
      title: t.notifications.newPlayerInGame,
      body: t.notifications.newPlayerInGameBody.replace('{name}', playerName),
      url: '/?screen=games',
      tag: `added-${params.gameId}`,
    })
  } catch {}

  return { success: true }
}

// ============================
// Vote on a join request (accept/reject a pending player)
// ============================

export async function voteOnJoinRequest(
  requestPlayerId: string,
  vote: 'accept' | 'reject'
): Promise<{ success: boolean; resolved?: boolean; newStatus?: string; votesCount?: number; votesNeeded?: number; error?: string }> {
  const { data, error } = await supabase.rpc('vote_on_join_request', {
    p_request_player_id: requestPlayerId,
    p_vote: vote,
  })

  if (error) {
    console.error('[OpenGames] Error voting on request:', error)
    return { success: false, error: error.message }
  }

  const result = data as any
  if (!result?.success) {
    return { success: false, error: result?.error || 'Erro desconhecido' }
  }

  // 🔔 Push: notify player if vote was resolved (accepted/rejected)
  if (result.resolved && result.new_status) {
    try {
      // requestPlayerId is the open_game_players.id, need to get the player_account_id
      const { data: reqPlayer } = await supabase
        .from('open_game_players')
        .select('player_account_id, game_id')
        .eq('id', requestPlayerId)
        .maybeSingle()
      
      if (reqPlayer?.player_account_id) {
        const t = getTranslations()
        if (result.new_status === 'confirmed') {
          sendPushToPlayer(reqPlayer.player_account_id, {
            title: t.notifications.requestApproved,
            body: t.notifications.requestApprovedBody,
            url: '/?screen=games',
            tag: `approved-${reqPlayer.game_id}`,
          })
        } else if (result.new_status === 'rejected') {
          sendPushToPlayer(reqPlayer.player_account_id, {
            title: t.notifications.requestRejected,
            body: t.notifications.requestRejectedBody,
            url: '/?screen=find-game',
            tag: `rejected-${reqPlayer.game_id}`,
          })
        }
      }
    } catch {}
  }

  return {
    success: true,
    resolved: result.resolved,
    newStatus: result.new_status,
    votesCount: result.votes_count,
    votesNeeded: result.votes_needed,
  }
}

// ============================
// Fetch votes for pending players in a game
// ============================

export async function fetchJoinVotes(gameId: string): Promise<{
  requestPlayerId: string
  voterUserId: string
  vote: 'accept' | 'reject'
}[]> {
  const { data, error } = await supabase
    .from('open_game_join_votes')
    .select('request_player_id, voter_user_id, vote')
    .eq('game_id', gameId)

  if (error || !data) return []
  return data as any[]
}

// ============================
// Fetch pending requests for games I'm in
// ============================

export async function fetchMyGamesPendingRequests(userId: string): Promise<{
  gameId: string
  pendingPlayers: OpenGamePlayer[]
  myVotes: { requestPlayerId: string; vote: string }[]
}[]> {
  // 1. Get games where I'm confirmed
  const { data: myGames } = await supabase
    .from('open_game_players')
    .select('game_id')
    .eq('user_id', userId)
    .eq('status', 'confirmed')

  if (!myGames || myGames.length === 0) return []

  const gameIds = myGames.map(g => g.game_id)

  // 2. Get all pending players in those games
  const { data: pendingData } = await supabase
    .from('open_game_players')
    .select('*')
    .in('game_id', gameIds)
    .eq('status', 'pending')

  if (!pendingData || pendingData.length === 0) return []

  // 3. Get player details
  const userIds = [...new Set(pendingData.map(p => p.user_id).filter(Boolean))]
  const accountIds = [...new Set(pendingData.map(p => p.player_account_id).filter(Boolean))]
  let detailsMap: Record<string, { name: string; avatar_url: string | null; level: number | null; player_category: string | null }> = {}

  const detailQueries: Promise<any>[] = []
  if (userIds.length > 0) {
    detailQueries.push(supabase.from('player_accounts').select('id, user_id, name, avatar_url, level, player_category').in('user_id', userIds))
  }
  if (accountIds.length > 0) {
    detailQueries.push(supabase.from('player_accounts').select('id, user_id, name, avatar_url, level, player_category').in('id', accountIds))
  }
  const detailResults = await Promise.all(detailQueries)
  detailResults.forEach(({ data: accounts }) => {
    if (accounts) {
      accounts.forEach((a: any) => {
        if (a.user_id) detailsMap[a.user_id] = { name: a.name, avatar_url: a.avatar_url, level: a.level, player_category: a.player_category }
        detailsMap['pa_' + a.id] = { name: a.name, avatar_url: a.avatar_url, level: a.level, player_category: a.player_category }
      })
    }
  })

  // 4. Get my votes
  const pendingIds = pendingData.map(p => p.id)
  const { data: votesData } = await supabase
    .from('open_game_join_votes')
    .select('request_player_id, voter_user_id, vote')
    .in('request_player_id', pendingIds)
    .eq('voter_user_id', userId)

  const myVotesMap = new Map<string, string>()
  ;(votesData || []).forEach((v: any) => myVotesMap.set(v.request_player_id, v.vote))

  // 5. Group by game
  const gamesMap = new Map<string, { pendingPlayers: OpenGamePlayer[]; myVotes: { requestPlayerId: string; vote: string }[] }>()

  for (const p of pendingData) {
    if (!gamesMap.has(p.game_id)) {
      gamesMap.set(p.game_id, { pendingPlayers: [], myVotes: [] })
    }
    const entry = gamesMap.get(p.game_id)!
    const details = (p.player_account_id ? detailsMap['pa_' + p.player_account_id] : null) || detailsMap[p.user_id]
    entry.pendingPlayers.push({
      id: p.id,
      user_id: p.user_id,
      player_account_id: p.player_account_id,
      status: p.status,
      position: p.position,
      name: details?.name || (typeof window !== 'undefined' ? getTranslations().common.player : 'Jogador'),
      avatar_url: details?.avatar_url || null,
      level: details?.level || null,
      player_category: details?.player_category || null,
    })
    if (myVotesMap.has(p.id)) {
      entry.myVotes.push({ requestPlayerId: p.id, vote: myVotesMap.get(p.id)! })
    }
  }

  return Array.from(gamesMap.entries()).map(([gameId, data]) => ({
    gameId,
    ...data,
  }))
}

// ============================
// Search player accounts by name
// ============================

export async function searchPlayerAccounts(query: string): Promise<{
  id: string
  name: string
  avatar_url: string | null
  level: number | null
  player_category: string | null
  phone_number: string | null
}[]> {
  if (!query || query.length < 2) return []

  const { data, error } = await supabase
    .rpc('search_player_accounts_unaccent', { search_query: query.trim() })

  if (error) console.error('[OpenGames] searchPlayerAccounts error:', error)
  if (error || !data) return []
  return data as any[]
}

// ============================
// Open Game Results
// ============================

export interface OpenGameResult {
  id: string
  game_id: string
  submitted_by_user_id: string
  submitted_by_player_account_id: string | null
  submitted_by_team: number
  team1_score_set1: number
  team2_score_set1: number
  team1_score_set2: number
  team2_score_set2: number
  team1_score_set3: number
  team2_score_set3: number
  status: 'pending' | 'confirmed' | 'disputed'
  confirmed_by_user_id: string | null
  confirmed_at: string | null
  rating_processed: boolean
  created_at: string
}

export async function fetchGameResult(gameId: string): Promise<OpenGameResult | null> {
  const { data, error } = await supabase
    .from('open_game_results')
    .select('*')
    .eq('game_id', gameId)
    .maybeSingle()

  if (error || !data) return null
  return data as OpenGameResult
}

export async function submitGameResult(params: {
  gameId: string
  t1Set1: number; t2Set1: number
  t1Set2: number; t2Set2: number
  t1Set3?: number; t2Set3?: number
}): Promise<{ success: boolean; submittedByTeam?: number; error?: string }> {
  const { data, error } = await supabase.rpc('submit_open_game_result', {
    p_game_id: params.gameId,
    p_t1_set1: params.t1Set1,
    p_t2_set1: params.t2Set1,
    p_t1_set2: params.t1Set2,
    p_t2_set2: params.t2Set2,
    p_t1_set3: params.t1Set3 ?? 0,
    p_t2_set3: params.t2Set3 ?? 0,
  })

  if (error) {
    console.error('[OpenGames] Error submitting result:', error)
    return { success: false, error: error.message }
  }

  const result = data as any
  if (!result?.success) {
    return { success: false, error: result?.error || 'Erro desconhecido' }
  }

  // Award reward points for submitting result
  try {
    await awardGameRewardPoints(params.gameId, 'submit_result')
  } catch (err) {
    console.error('[Rewards] Error awarding submit_result points:', err)
  }

  // 🔔 Push: notify other players that result was submitted
  try {
    const { data: { user: me } } = await supabase.auth.getUser()
    const { data: myAccount } = await supabase
      .from('player_accounts')
      .select('id')
      .eq('user_id', me?.id || '')
      .maybeSingle()

    const t = getTranslations()
    notifyOpenGamePlayers(params.gameId, myAccount?.id || null, {
      title: t.notifications.resultSubmitted,
      body: t.notifications.resultSubmittedBody,
      url: '/?screen=games',
      tag: `result-${params.gameId}`,
    })
  } catch {}

  return { success: true, submittedByTeam: result.submitted_by_team }
}

export async function confirmGameResult(gameId: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('confirm_open_game_result', {
    p_game_id: gameId,
  })

  if (error) {
    console.error('[OpenGames] Error confirming result:', error)
    return { success: false, error: error.message }
  }

  const result = data as any
  if (!result?.success) {
    return { success: false, error: result?.error || 'Erro desconhecido' }
  }

  // Update game status to 'completed' after result confirmation
  try {
    const { error: statusError } = await supabase
      .from('open_games')
      .update({ status: 'completed' })
      .eq('id', gameId)
    
    if (statusError) {
      console.error('[OpenGames] Error updating game status to completed:', statusError)
    } else {
      console.log('[OpenGames] Game status updated to completed:', gameId)
    }
  } catch (err) {
    console.error('[OpenGames] Error updating game status:', err)
  }

  // Process rating after confirmation
  try {
    await processOpenGameRating(gameId)
  } catch (err) {
    console.error('[OpenGames] Error processing rating after confirmation:', err)
  }

  // Award reward points to the confirmer
  try {
    await awardGameRewardPoints(gameId, 'confirm_result')
  } catch (err) {
    console.error('[Rewards] Error awarding confirm_result points:', err)
  }

  // Award confirm_result to ALL other players who didn't submit or confirm
  // (submitter already got submit_result, confirmer just got confirm_result)
  try {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    const { data: gamePlayers } = await supabase
      .from('open_game_players')
      .select('player_account_id, user_id')
      .eq('game_id', gameId)
      .eq('status', 'confirmed')

    const { data: gameResult } = await supabase
      .from('open_game_results')
      .select('submitted_by_user_id')
      .eq('game_id', gameId)
      .maybeSingle()

    if (gamePlayers) {
      for (const p of gamePlayers) {
        // Skip the current user (confirmer) and the submitter - they already got rewards
        if (p.user_id === currentUser?.id) continue
        if (p.user_id === gameResult?.submitted_by_user_id) continue
        if (p.player_account_id) {
          try {
            await awardGameRewardPoints(gameId, 'confirm_result', p.player_account_id)
          } catch {}
        }
      }
    }
  } catch (err) {
    console.error('[Rewards] Error awarding confirm_result to all players:', err)
  }

  // 🔔 Push: notify all players that result was confirmed
  try {
    const { data: { user: me } } = await supabase.auth.getUser()
    const { data: myAccount } = await supabase
      .from('player_accounts')
      .select('id')
      .eq('user_id', me?.id || '')
      .maybeSingle()

    const t = getTranslations()
    notifyOpenGamePlayers(gameId, myAccount?.id || null, {
      title: t.notifications.resultConfirmed,
      body: t.notifications.resultConfirmedBody,
      url: '/?screen=games',
      tag: `result-confirmed-${gameId}`,
    })
  } catch {}

  return { success: true }
}

export async function disputeGameResult(gameId: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('dispute_open_game_result', {
    p_game_id: gameId,
  })

  if (error) {
    console.error('[OpenGames] Error disputing result:', error)
    return { success: false, error: error.message }
  }

  const result = data as any
  if (!result?.success) {
    return { success: false, error: result?.error || 'Erro desconhecido' }
  }

  return { success: true }
}

// ============================
// Process rating for an open game
// ============================

async function processOpenGameRating(gameId: string): Promise<void> {
  console.log('[OpenGames] processOpenGameRating v3: Starting for game:', gameId)
  
  // 1. Get the confirmed result
  const { data: result, error: resultError } = await supabase
    .from('open_game_results')
    .select('*')
    .eq('game_id', gameId)
    .eq('status', 'confirmed')
    .single()

  if (resultError) {
    console.error('[OpenGames] processOpenGameRating: Error fetching result:', resultError)
    return
  }
  if (!result) {
    console.warn('[OpenGames] processOpenGameRating: No confirmed result found for game:', gameId)
    return
  }
  if (result.rating_processed) {
    console.log('[OpenGames] processOpenGameRating: Rating already processed for game:', gameId)
    return
  }
  
  console.log('[OpenGames] processOpenGameRating: Found confirmed result:', result.id, 
    'Scores:', result.team1_score_set1, '-', result.team2_score_set1, '|', 
    result.team1_score_set2, '-', result.team2_score_set2, '|',
    result.team1_score_set3, '-', result.team2_score_set3)

  // 2. Get all confirmed players sorted by position
  const { data: players, error: playersError } = await supabase
    .from('open_game_players')
    .select('player_account_id, position, user_id')
    .eq('game_id', gameId)
    .eq('status', 'confirmed')
    .order('position', { ascending: true })

  if (playersError) {
    console.error('[OpenGames] processOpenGameRating: Error fetching players:', playersError)
    return
  }
  if (!players || players.length < 4) {
    console.warn('[OpenGames] processOpenGameRating: Not enough players (need 4, got', players?.length || 0, ')')
    console.warn('[OpenGames] Players found:', JSON.stringify(players))
    return
  }
  
  console.log('[OpenGames] processOpenGameRating: Found', players.length, 'players:', 
    players.map(p => `pos${p.position}:${p.player_account_id}`).join(', '))

  // 3. Get player accounts (include level_reliability_percent for protected reliability)
  const accountIds = players.map(p => p.player_account_id).filter(Boolean) as string[]
  
  if (accountIds.length < 4) {
    console.warn('[OpenGames] processOpenGameRating: Not enough player_account_ids (need 4, got', accountIds.length, ')')
    console.warn('[OpenGames] Some players might not have player_account_id set')
    return
  }
  
  console.log('[OpenGames] processOpenGameRating: Account IDs:', accountIds)
  
  const { data: accounts, error: accountsError } = await supabase
    .from('player_accounts')
    .select('id, user_id, name, level, rated_matches, wins, losses, level_reliability_percent')
    .in('id', accountIds)

  if (accountsError) {
    console.error('[OpenGames] processOpenGameRating: Error fetching accounts:', accountsError)
    console.error('[OpenGames] This may be due to RLS restrictions on player_accounts table')
    return
  }
  if (!accounts || accounts.length < 4) {
    console.warn('[OpenGames] processOpenGameRating: Not enough accounts (need 4, got', accounts?.length || 0, ')')
    console.warn('[OpenGames] processOpenGameRating: This is likely due to RLS blocking access to player_accounts')
    return
  }
  
  console.log('[OpenGames] processOpenGameRating: Found', accounts.length, 'accounts:',
    accounts.map(a => `${a.name}(lvl:${a.level}, rm:${a.rated_matches}, rel:${a.level_reliability_percent}%)`).join(', '))

  const accountMap = new Map(accounts.map(a => [a.id, a]))

  // 4. Build ratings (positions 1,2 = team 1; positions 3,4 = team 2)

  const buildPlayerRating = (paId: string) => {
    const acct = accountMap.get(paId)
    if (!acct) return null
    return {
      id: acct.id,
      user_id: acct.user_id || '',
      name: acct.name || '',
      rating: acct.level ?? 3.0,
      matches: acct.rated_matches ?? ((acct.wins ?? 0) + (acct.losses ?? 0)),
    }
  }

  const p1 = buildPlayerRating(players[0].player_account_id!)
  const p2 = buildPlayerRating(players[1].player_account_id!)
  const p3 = buildPlayerRating(players[2].player_account_id!)
  const p4 = buildPlayerRating(players[3].player_account_id!)

  if (!p1 || !p2 || !p3 || !p4) {
    console.error('[OpenGames] processOpenGameRating: Could not build all player ratings', 
      { p1: !!p1, p2: !!p2, p3: !!p3, p4: !!p4 })
    return
  }

  console.log('[OpenGames] processOpenGameRating: Player ratings before:',
    `Team1: ${p1.name}(${p1.rating}) + ${p2.name}(${p2.rating})`,
    `vs Team2: ${p3.name}(${p3.rating}) + ${p4.name}(${p4.rating})`)

  const s1 = [result.team1_score_set1 ?? 0, result.team2_score_set1 ?? 0] as [number, number]
  const s2 = [result.team1_score_set2 ?? 0, result.team2_score_set2 ?? 0] as [number, number]
  const s3 = [result.team1_score_set3 ?? 0, result.team2_score_set3 ?? 0] as [number, number]

  const sets1 = (s1[0] > s1[1] ? 1 : 0) + (s2[0] > s2[1] ? 1 : 0) + (s3[0] > s3[1] ? 1 : 0)
  const sets2 = (s1[1] > s1[0] ? 1 : 0) + (s2[1] > s2[0] ? 1 : 0) + (s3[1] > s3[0] ? 1 : 0)
  const gamesTotal1 = s1[0] + s2[0] + s3[0]
  const gamesTotal2 = s1[1] + s2[1] + s3[1]

  console.log('[OpenGames] processOpenGameRating: Score analysis:',
    `sets ${sets1}-${sets2}, games ${gamesTotal1}-${gamesTotal2}`)

  if (sets1 === 0 && sets2 === 0 && gamesTotal1 === 0 && gamesTotal2 === 0) {
    console.warn('[OpenGames] processOpenGameRating: No scores at all, skipping')
    return
  }

  const ratingResult = calculateNewRatings(
    { p1, p2 },
    { p3, p4 },
    { sets1, sets2, gamesTotal1, gamesTotal2 }
  )

  if (ratingResult.skipped) {
    console.warn('[OpenGames] processOpenGameRating: Rating calculation skipped:', ratingResult.message)
    // Still mark as processed to avoid retrying forever
    await supabase
      .from('open_game_results')
      .update({ rating_processed: true, updated_at: new Date().toISOString() })
      .eq('id', result.id)
    return
  }

  if (!ratingResult.team1 || !ratingResult.team2) {
    console.error('[OpenGames] processOpenGameRating: No rating result teams')
    return
  }

  // 5. Update ratings with protected reliability
  const allPlayers = [
    ratingResult.team1.p1, ratingResult.team1.p2,
    ratingResult.team2.p3, ratingResult.team2.p4,
  ]

  console.log('[OpenGames] processOpenGameRating: Updating ratings for', allPlayers.length, 'players')
  
  for (const rp of allPlayers) {
    const formulaReliability = calculateReliability(rp.matches)
    const currentAccount = accountMap.get(rp.id)
    const currentReliability = currentAccount?.level_reliability_percent ?? 0
    const protectedReliability = calculateProtectedReliability(formulaReliability, currentReliability)
    
    console.log('[OpenGames] processOpenGameRating: Updating player', rp.name,
      `- rating: ${(currentAccount?.level ?? 3.0).toFixed(2)} → ${rp.rating.toFixed(2)} (Δ${rp.delta >= 0 ? '+' : ''}${rp.delta.toFixed(4)})`,
      `| reliability: ${currentReliability}% → ${protectedReliability}% (formula: ${formulaReliability}%)`,
      `| won: ${rp.won}`,
      `| matches: ${rp.matches}`)
    
    const levelBefore = currentAccount?.level ?? (rp.rating - rp.delta)

    const { error: rpcError } = await supabase.rpc('update_player_rating', {
      p_player_account_id: rp.id,
      p_new_level: rp.rating,
      p_new_reliability: protectedReliability,
      p_match_won: rp.won,
    })
    
    if (rpcError) {
      console.error('[OpenGames] processOpenGameRating: Error updating rating for', rp.id, rp.name, ':', rpcError)
    } else {
      console.log('[OpenGames] processOpenGameRating: ✅ Successfully updated', rp.name)
      logLevelChange(rp.id, levelBefore, rp.rating, rp.delta, 'open_game', rp.won)
    }
  }

  // 6. Mark result as processed
  const { error: markError } = await supabase
    .from('open_game_results')
    .update({ rating_processed: true, updated_at: new Date().toISOString() })
    .eq('id', result.id)

  if (markError) {
    console.error('[OpenGames] processOpenGameRating: Error marking as processed:', markError)
  }

  console.log('[OpenGames] ✅ Rating processed successfully for game:', gameId)
}

// ============================
// Award reward points for game actions
// ============================

export async function awardGameRewardPoints(gameId: string, actionType: string, specificPlayerAccountId?: string): Promise<void> {
  // Get the game's club
  const { data: game, error: gameError } = await supabase
    .from('open_games')
    .select('club_id')
    .eq('id', gameId)
    .maybeSingle()

  if (!game || !game.club_id) {
    console.error('[Rewards] Cannot award points - game not found or no club_id:', gameId, gameError)
    return
  }

  let playerAccountId = specificPlayerAccountId

  if (!playerAccountId) {
    // Get current user's player_account_id
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('[Rewards] Cannot award points - no auth user')
      return
    }

    const { data: pa } = await supabase
      .from('player_accounts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!pa) {
      console.error('[Rewards] Cannot award points - no player_account for user:', user.id)
      return
    }
    playerAccountId = pa.id
  }

  // Check if the club has reward rules configured
  const { data: existingRules } = await supabase
    .from('reward_rules')
    .select('id')
    .eq('club_id', game.club_id)
    .limit(1)

  if (!existingRules || existingRules.length === 0) {
    return
  }

  // Award the reward points
  const { data: rpcResult, error: rpcError } = await supabase.rpc('award_reward_points', {
    p_player_account_id: playerAccountId,
    p_club_id: game.club_id,
    p_action_type: actionType,
    p_reference_id: gameId,
  })

  if (rpcError) {
    console.error('[Rewards] RPC error awarding', actionType, 'for game', gameId, ':', rpcError)
  } else {
    const result = rpcResult as any
    if (result?.success) {
      console.log('[Rewards] ✅ Awarded', actionType, ':', result.points_earned, 'pts → total:', result.new_total, '(tier:', result.tier, ')')
    } else {
      console.warn('[Rewards] ⚠️ Award failed for', actionType, ':', result?.error || 'unknown error')
    }
  }
}

// Award first_game bonus if this is the player's first game
async function checkAndAwardFirstGame(gameId: string, playerAccountId?: string): Promise<void> {
  try {
    let paId = playerAccountId
    if (!paId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: pa } = await supabase
        .from('player_accounts')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!pa) return
      paId = pa.id
    }

    // Check if player has any previous reward transactions (not just first_game)
    const { data: prevGames } = await supabase
      .from('reward_transactions')
      .select('id')
      .eq('player_account_id', paId)
      .in('action_type', ['create_game', 'join_game'])
      .limit(2)

    // If this is the first create_game or join_game transaction (only 1 exists = the current one)
    if (!prevGames || prevGames.length <= 1) {
      console.log('[Rewards] 🎉 First game detected! Awarding first_game bonus for player:', paId)
      await awardGameRewardPoints(gameId, 'first_game', paId)
    }
  } catch (err) {
    console.error('[Rewards] Error checking first_game bonus:', err)
  }
}

// Award rewards to ALL confirmed players in a game
async function awardAllPlayersReward(gameId: string, actionType: string): Promise<void> {
  try {
    const { data: players } = await supabase
      .from('open_game_players')
      .select('player_account_id')
      .eq('game_id', gameId)
      .eq('status', 'confirmed')

    if (!players || players.length === 0) {
      console.warn('[Rewards] No confirmed players found for game:', gameId)
      return
    }

    console.log('[Rewards] Awarding', actionType, 'to', players.length, 'players in game:', gameId)
    for (const player of players) {
      if (player.player_account_id) {
        await awardGameRewardPoints(gameId, actionType, player.player_account_id)
      }
    }
  } catch (err) {
    console.error('[Rewards] Error awarding all players:', err)
  }
}

// ============================
// Fetch player reward points
// ============================

// ============================
// Retroactively award missing rewards for completed games
// Called when loading player rewards to ensure nothing was missed
// ============================
export async function retroactivelyAwardMissingRewards(playerAccountId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Quick check: does the player belong to any club with reward rules?
    const { data: playerRewardClubs } = await supabase
      .from('reward_rules')
      .select('club_id')
      .limit(1)

    if (!playerRewardClubs || playerRewardClubs.length === 0) return

    // Find games where the player participated but has no reward transactions
    const { data: myGames } = await supabase
      .from('open_game_players')
      .select('game_id, user_id, position')
      .eq('player_account_id', playerAccountId)
      .eq('status', 'confirmed')

    if (!myGames || myGames.length === 0) return

    // Get existing reward transactions for this player
    const { data: existingTx } = await supabase
      .from('reward_transactions')
      .select('reference_id, action_type')
      .eq('player_account_id', playerAccountId)
      .in('action_type', ['create_game', 'join_game', 'submit_result', 'confirm_result', 'first_game'])

    const txSet = new Set((existingTx || []).map(t => `${t.reference_id}_${t.action_type}`))

    let awardedCount = 0

    for (const gp of myGames) {
      const gameId = gp.game_id

      // Check if player created or joined this game
      const { data: game } = await supabase
        .from('open_games')
        .select('creator_user_id, club_id, status')
        .eq('id', gameId)
        .maybeSingle()

      if (!game || !game.club_id) continue

      const isCreator = game.creator_user_id === user.id

      // Award create_game or join_game if missing
      if (isCreator && !txSet.has(`${gameId}_create_game`)) {
        console.log('[Rewards] Retroactively awarding create_game for game:', gameId)
        await awardGameRewardPoints(gameId, 'create_game', playerAccountId)
        awardedCount++
      } else if (!isCreator && !txSet.has(`${gameId}_join_game`)) {
        console.log('[Rewards] Retroactively awarding join_game for game:', gameId)
        await awardGameRewardPoints(gameId, 'join_game', playerAccountId)
        awardedCount++
      }

      // Check if result was confirmed
      const { data: result } = await supabase
        .from('open_game_results')
        .select('status, submitted_by_user_id')
        .eq('game_id', gameId)
        .eq('status', 'confirmed')
        .maybeSingle()

      if (result) {
        // Award submit_result if player submitted and doesn't have it
        if (result.submitted_by_user_id === user.id && !txSet.has(`${gameId}_submit_result`)) {
          console.log('[Rewards] Retroactively awarding submit_result for game:', gameId)
          await awardGameRewardPoints(gameId, 'submit_result', playerAccountId)
          awardedCount++
        }
        // Award confirm_result if player doesn't have it and didn't submit
        if (result.submitted_by_user_id !== user.id && !txSet.has(`${gameId}_confirm_result`)) {
          console.log('[Rewards] Retroactively awarding confirm_result for game:', gameId)
          await awardGameRewardPoints(gameId, 'confirm_result', playerAccountId)
          awardedCount++
        }
      }
    }

    // Check first_game bonus
    if (!txSet.has(`${myGames[0]?.game_id}_first_game`)) {
      const hasFirstGame = (existingTx || []).some(t => t.action_type === 'first_game')
      if (!hasFirstGame && myGames.length > 0) {
        console.log('[Rewards] Retroactively awarding first_game bonus')
        await awardGameRewardPoints(myGames[0].game_id, 'first_game', playerAccountId)
        awardedCount++
      }
    }

    if (awardedCount > 0) {
      console.log('[Rewards] ✅ Retroactively awarded', awardedCount, 'missing rewards')
    }
  } catch (err) {
    console.error('[Rewards] Error in retroactive reward fix:', err)
  }
}

// ============================
// Fetch player reward points
// ============================

export async function fetchPlayerRewards(playerAccountId: string): Promise<{
  totalPoints: number
  tier: string
  rewards: { clubId: string; clubName: string; points: number; tier: string }[]
}> {
  const { data, error } = await supabase
    .from('player_rewards')
    .select('club_id, total_points, tier, club:clubs(name)')
    .eq('player_account_id', playerAccountId)
    .order('total_points', { ascending: false })

  if (error || !data) return { totalPoints: 0, tier: 'silver', rewards: [] }

  let totalPoints = 0
  const rewards = data.map((r: any) => {
    totalPoints += r.total_points
    return {
      clubId: r.club_id,
      clubName: (r.club as any)?.name || (typeof window !== 'undefined' ? getTranslations().common.club : 'Clube'),
      points: r.total_points,
      tier: r.tier || 'silver',
    }
  })

  const tier = totalPoints >= 1000 ? 'diamond' : totalPoints >= 500 ? 'platinum' : totalPoints >= 200 ? 'gold' : 'silver'

  return { totalPoints, tier, rewards }
}

export async function fetchRewardTransactions(playerAccountId: string, limit: number = 20): Promise<{
  id: string; actionType: string; points: number; description: string; clubName: string; createdAt: string
}[]> {
  const { data, error } = await supabase
    .from('reward_transactions')
    .select('id, action_type, points, description, created_at, club:clubs(name)')
    .eq('player_account_id', playerAccountId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data.map((t: any) => ({
    id: t.id,
    actionType: t.action_type,
    points: t.points,
    description: t.description || '',
    clubName: (t.club as any)?.name || 'Clube',
    createdAt: t.created_at,
  }))
}

// ============================
// Reward Catalog & Redemption (Player side)
// ============================

export interface CatalogItem {
  id: string
  club_id: string
  club_name: string
  club_logo_url: string | null
  title: string
  description: string | null
  image_url: string | null
  cost_points: number
  category: string
  stock: number | null
  is_active: boolean
}

export interface RedemptionEntry {
  id: string
  item_title: string
  club_name: string
  points_spent: number
  status: string
  redeemed_at: string
}

export async function fetchRewardCatalog(playerAccountId: string): Promise<{
  items: CatalogItem[]
  pointsByClub: Map<string, number>
}> {
  // Get clubs where the player has rewards
  const { data: playerRewards } = await supabase
    .from('player_rewards')
    .select('club_id, total_points')
    .eq('player_account_id', playerAccountId)

  const pointsByClub = new Map<string, number>()
  const clubIds: string[] = []

  if (playerRewards) {
    playerRewards.forEach(r => {
      pointsByClub.set(r.club_id, r.total_points)
      clubIds.push(r.club_id)
    })
  }

  // Get all active catalog items (from all clubs for now)
  const { data: catalogData, error } = await supabase
    .from('reward_catalog')
    .select('id, club_id, title, description, image_url, cost_points, category, stock, is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error || !catalogData) return { items: [], pointsByClub }

  // Get club names
  const allClubIds = [...new Set(catalogData.map(c => c.club_id))]
  const { data: clubs } = await supabase
    .from('clubs')
    .select('id, name, logo_url')
    .in('id', allClubIds)

  const clubMap = new Map((clubs || []).map(c => [c.id, c]))

  const items: CatalogItem[] = catalogData
    .filter(c => c.stock === null || c.stock > 0) // Hide out-of-stock
    .map(c => {
      const club = clubMap.get(c.club_id)
      return {
        ...c,
        club_name: club?.name || (typeof window !== 'undefined' ? getTranslations().common.club : 'Clube'),
        club_logo_url: club?.logo_url || null,
      }
    })

  return { items, pointsByClub }
}

export async function redeemReward(catalogItemId: string, playerAccountId: string): Promise<{
  success: boolean
  error?: string
  pointsSpent?: number
  remainingPoints?: number
  itemTitle?: string
}> {
  const { data, error } = await supabase.rpc('redeem_reward', {
    p_catalog_item_id: catalogItemId,
    p_player_account_id: playerAccountId,
  })

  if (error) {
    console.error('[Rewards] Error redeeming:', error)
    return { success: false, error: error.message }
  }

  const result = data as any
  if (!result?.success) {
    return { success: false, error: result?.error || 'Erro desconhecido' }
  }

  return {
    success: true,
    pointsSpent: result.points_spent,
    remainingPoints: result.remaining_points,
    itemTitle: result.item_title,
  }
}

export async function fetchMyRedemptions(playerAccountId: string): Promise<RedemptionEntry[]> {
  const { data, error } = await supabase
    .from('reward_redemptions')
    .select('id, points_spent, status, redeemed_at, catalog_item:reward_catalog(title), club:clubs(name)')
    .eq('player_account_id', playerAccountId)
    .order('redeemed_at', { ascending: false })
    .limit(30)

  if (error || !data) return []

  return data.map((r: any) => ({
    id: r.id,
    item_title: (r.catalog_item as any)?.title || 'Item',
    club_name: (r.club as any)?.name || 'Clube',
    points_spent: r.points_spent,
    status: r.status,
    redeemed_at: r.redeemed_at,
  }))
}

// ============================
// Fetch games awaiting result (past games with status full/completed but no result)
// ============================

export async function fetchGamesAwaitingResult(userId: string, playerAccountId?: string): Promise<OpenGame[]> {
  // IMPORTANT: First, update any open_game_players records that have player_account_id but missing user_id
  // This happens when a player was added by another player before they logged in
  if (playerAccountId) {
    try {
      const { data: updateResult, error: updateError } = await supabase
        .from('open_game_players')
        .update({ user_id: userId })
        .eq('player_account_id', playerAccountId)
        .is('user_id', null)
        .eq('status', 'confirmed')
      
      if (updateError) {
        console.error('[OpenGames] Error updating user_id for open_game_players:', updateError)
        console.error('[OpenGames] This may be due to RLS - ensure migration 20260225100003 is applied')
      } else {
        console.log('[OpenGames] Successfully updated user_id for player_account_id:', playerAccountId)
      }
    } catch (err) {
      console.error('[OpenGames] Error updating user_id for open_game_players:', err)
    }
  }

  // Get games where user is confirmed (by user_id OR player_account_id)
  // Priority: player_account_id is more reliable, but also check user_id
  const queries = []
  
  if (playerAccountId) {
    queries.push(
      supabase
        .from('open_game_players')
        .select('game_id')
        .eq('player_account_id', playerAccountId)
        .eq('status', 'confirmed')
    )
  }
  
  queries.push(
    supabase
      .from('open_game_players')
      .select('game_id')
      .eq('user_id', userId)
      .eq('status', 'confirmed')
  )

  const results = await Promise.all(queries)
  const gameIdSet = new Set<string>()
  results.forEach(r => {
    if (r.data) {
      r.data.forEach((g: any) => gameIdSet.add(g.game_id))
    }
    if (r.error) {
      console.error('[OpenGames] Error fetching game_ids from open_game_players:', r.error)
    }
  })

  console.log('[OpenGames] fetchGamesAwaitingResult found', gameIdSet.size, 'games for userId:', userId, 'playerAccountId:', playerAccountId)
  console.log('[OpenGames] Game IDs found:', Array.from(gameIdSet))

  if (gameIdSet.size === 0) return []
  const myGames = Array.from(gameIdSet).map(id => ({ game_id: id }))

  const gameIds = myGames.map(g => g.game_id)
  
  // Verify authentication
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
  console.log('[OpenGames] Auth check - user:', authUser?.id, 'error:', authError)

  // Fetch games that ended (scheduled_at + duration < now)
  const now = new Date().toISOString()
  console.log('[OpenGames] Fetching games with IDs:', gameIds, 'status: full/completed, scheduled_at <=', now)
  
  // First, let's check what games exist without any filters
  // Use .eq() for single ID, .in() for multiple
  let allGamesCheck: any[] | null = null
  let checkError: any = null
  
  if (gameIds.length === 1) {
    const { data, error } = await supabase
      .from('open_games')
      .select('id, status, scheduled_at, duration_minutes, created_at')
      .eq('id', gameIds[0])
    
    allGamesCheck = data
    checkError = error
  } else {
    const { data, error } = await supabase
      .from('open_games')
      .select('id, status, scheduled_at, duration_minutes, created_at')
      .in('id', gameIds)
    
    allGamesCheck = data
    checkError = error
  }
  
  console.log('[OpenGames] All games (no filters):', allGamesCheck)
  if (checkError) {
    console.error('[OpenGames] Error checking games:', checkError)
    console.error('[OpenGames] Error details:', JSON.stringify(checkError, null, 2))
  }
  
  if (!allGamesCheck || allGamesCheck.length === 0) {
    console.error('[OpenGames] No games found in open_games table for IDs:', gameIds)
    console.error('[OpenGames] This might be due to:')
    console.error('[OpenGames] 1. RLS (Row Level Security) blocking access')
    console.error('[OpenGames] 2. Game was deleted from open_games but still exists in open_game_players')
    console.error('[OpenGames] 3. Game ID mismatch')
    
    // Try alternative: fetch through open_game_players with JOIN
    console.log('[OpenGames] Trying alternative: fetch through open_game_players JOIN')
    console.log('[OpenGames] JOIN query params - gameIds:', gameIds, 'userId:', userId, 'playerAccountId:', playerAccountId)
    
    // First, verify we can see the open_game_players record
    const { data: playersCheck, error: playersCheckError } = await supabase
      .from('open_game_players')
      .select('id, game_id, user_id, player_account_id, status')
      .in('game_id', gameIds)
      .eq('status', 'confirmed')
    
    console.log('[OpenGames] Players check (no user filter):', playersCheck?.length || 0, 'records found')
    if (playersCheck && playersCheck.length > 0) {
      playersCheck.forEach((p: any) => {
        console.log('[OpenGames] Player record:', {
          id: p.id,
          game_id: p.game_id,
          user_id: p.user_id,
          player_account_id: p.player_account_id,
          matches_userId: p.user_id === userId,
          matches_playerAccountId: p.player_account_id === playerAccountId
        })
      })
    }
    if (playersCheckError) {
      console.error('[OpenGames] Players check error:', playersCheckError)
    }
    
    // Try with OR condition for user_id OR player_account_id
    // Since Supabase doesn't support OR directly, we'll try both queries
    const queries: Promise<any>[] = []
    
    if (userId) {
      queries.push(
        supabase
          .from('open_game_players')
          .select(`
            game_id,
            open_games!inner (
              id,
              status,
              scheduled_at,
              duration_minutes,
              created_at,
              club_id,
              court_id,
              game_type,
              gender,
              level_min,
              level_max,
              price_per_player,
              max_players,
              notes,
              creator_user_id
            )
          `)
          .in('game_id', gameIds)
          .eq('status', 'confirmed')
          .eq('user_id', userId)
      )
    }
    
    if (playerAccountId) {
      queries.push(
        supabase
          .from('open_game_players')
          .select(`
            game_id,
            open_games!inner (
              id,
              status,
              scheduled_at,
              duration_minutes,
              created_at,
              club_id,
              court_id,
              game_type,
              gender,
              level_min,
              level_max,
              price_per_player,
              max_players,
              notes,
              creator_user_id
            )
          `)
          .in('game_id', gameIds)
          .eq('status', 'confirmed')
          .eq('player_account_id', playerAccountId)
      )
    }
    
    const joinResults = await Promise.all(queries)
    let gamesViaPlayers: any[] = []
    let joinError: any = null
    
    joinResults.forEach((result, index) => {
      if (result.error) {
        console.error(`[OpenGames] JOIN query ${index} error:`, result.error)
        if (!joinError) joinError = result.error
      } else if (result.data) {
        console.log(`[OpenGames] JOIN query ${index} found:`, result.data.length, 'results')
        gamesViaPlayers = gamesViaPlayers.concat(result.data)
      }
    })
    
    console.log('[OpenGames] Total JOIN results:', gamesViaPlayers.length, 'games found')
    if (joinError) {
      console.error('[OpenGames] JOIN query error:', joinError)
    }
    
    // Since JOIN doesn't work due to RLS, try to fetch game data directly using RPC or alternative method
    // For now, let's try to fetch the game data using the game_id we know exists
    if (gamesViaPlayers.length === 0 && playersCheck && playersCheck.length > 0) {
      console.log('[OpenGames] JOIN failed but we have player records. Trying to fetch game via RPC or direct query with service role...')
      
      // Try using a workaround: fetch game data through open_game_results if it exists
      const { data: resultData } = await supabase
        .from('open_game_results')
        .select('game_id, open_games(*)')
        .in('game_id', gameIds)
        .limit(1)
      
      if (resultData && resultData.length > 0 && resultData[0].open_games) {
        console.log('[OpenGames] Found game via open_game_results:', resultData[0].open_games.id)
        const gameData = resultData[0].open_games as any
        allGamesCheck = [{
          id: gameData.id,
          status: gameData.status,
          scheduled_at: gameData.scheduled_at,
          duration_minutes: gameData.duration_minutes,
          created_at: gameData.created_at,
          _fullData: gameData
        }]
        console.log('[OpenGames] Using game from open_game_results:', allGamesCheck.length)
      } else {
        // Last resort: construct minimal game object from what we know
        // We know the game_id exists, so let's try to fetch it using a different approach
        console.log('[OpenGames] Trying to fetch game using service role or admin context...')
        // Note: This won't work from client-side, but we can at least log what we're trying
        console.log('[OpenGames] Game ID exists in open_game_players but RLS blocks access to open_games')
        console.log('[OpenGames] This requires a server-side RPC function or RLS policy fix')
      }
    } else if (gamesViaPlayers && gamesViaPlayers.length > 0) {
        // Extract unique games from the JOIN result
        const gamesMap = new Map()
        gamesViaPlayers.forEach((gp: any) => {
          if (gp.open_games && !gamesMap.has(gp.open_games.id)) {
            gamesMap.set(gp.open_games.id, gp.open_games)
          }
        })
        const gamesFromJoin = Array.from(gamesMap.values())
        console.log('[OpenGames] Extracted', gamesFromJoin.length, 'unique games from JOIN')
        
        if (gamesFromJoin.length > 0) {
          // Use the games from JOIN instead
          allGamesCheck = gamesFromJoin.map((g: any) => ({
            id: g.id,
            status: g.status,
            scheduled_at: g.scheduled_at,
            duration_minutes: g.duration_minutes,
            created_at: g.created_at,
            _fullData: g // Store full data for later use
          }))
          console.log('[OpenGames] Using games from JOIN query:', allGamesCheck.length)
        }
      }
    
    // If still no games, try direct queries
    if (!allGamesCheck || allGamesCheck.length === 0) {
      if (gameIds.length === 1) {
        // Try with .maybeSingle()
        const { data: singleGame, error: singleError } = await supabase
          .from('open_games')
          .select('*')
          .eq('id', gameIds[0])
          .maybeSingle()
        
        console.log('[OpenGames] Direct query (.maybeSingle) for game:', gameIds[0], 'result:', singleGame ? 'found' : 'not found', 'error:', singleError)
        
        // Try without .maybeSingle()
        const { data: singleGame2, error: singleError2 } = await supabase
          .from('open_games')
          .select('*')
          .eq('id', gameIds[0])
        
        console.log('[OpenGames] Direct query (without .maybeSingle) for game:', gameIds[0], 'result:', singleGame2 ? `${singleGame2.length} found` : 'not found', 'error:', singleError2)
      }
      
      return []
    }
  }
  
  // Log each game's details
  allGamesCheck.forEach((g: any) => {
    console.log('[OpenGames] Game details:', {
      id: g.id,
      status: g.status,
      scheduled_at: g.scheduled_at,
      scheduled_at_date: new Date(g.scheduled_at).toISOString(),
      now: now,
      scheduled_before_now: g.scheduled_at <= now,
      duration_minutes: g.duration_minutes
    })
  })
  
  // Check if we got games from JOIN query
  const hasFullDataFromJoin = allGamesCheck && allGamesCheck.length > 0 && allGamesCheck[0]._fullData
  
  // Use .eq() for single ID, .in() for multiple
  let gamesData: any[] | null = null
  let gamesError: any = null
  
  if (hasFullDataFromJoin) {
    // Use data from JOIN query, but filter by status and scheduled_at
    console.log('[OpenGames] Using games from JOIN query, filtering by status and scheduled_at')
    const gamesFromJoin = allGamesCheck.map((g: any) => g._fullData || g)
    gamesData = gamesFromJoin.filter((g: any) => {
      const hasCorrectStatus = ['full', 'completed', 'expired'].includes(g.status)
      const scheduledBeforeNow = g.scheduled_at <= now
      console.log('[OpenGames] Game from JOIN:', g.id, 'status:', g.status, 'hasCorrectStatus:', hasCorrectStatus, 'scheduledBeforeNow:', scheduledBeforeNow)
      return hasCorrectStatus && scheduledBeforeNow
    })
    gamesError = null
  } else {
    // Try direct query to open_games
    if (gameIds.length === 1) {
      const { data, error } = await supabase
        .from('open_games')
        .select('*')
        .eq('id', gameIds[0])
        .in('status', ['full', 'completed', 'expired'])
        .lte('scheduled_at', now)
        .order('scheduled_at', { ascending: false })
        .limit(20)
      
      gamesData = data
      gamesError = error
    } else {
      const { data, error } = await supabase
        .from('open_games')
        .select('*')
        .in('id', gameIds)
        .in('status', ['full', 'completed', 'expired'])
        .lte('scheduled_at', now)
        .order('scheduled_at', { ascending: false })
        .limit(20)
      
      gamesData = data
      gamesError = error
    }
  }

  if (gamesError) {
    console.error('[OpenGames] Error fetching games:', gamesError)
  }
  
  console.log('[OpenGames] Found', gamesData?.length || 0, 'games with status full/completed and scheduled_at <= now')
  if (gamesData && gamesData.length > 0) {
    gamesData.forEach((g: any) => {
      console.log('[OpenGames] Game:', g.id, 'status:', g.status, 'scheduled_at:', g.scheduled_at, 'duration:', g.duration_minutes)
    })
  }

  if (!gamesData || gamesData.length === 0) {
    console.error('[OpenGames] No games passed the filters. Games found:', allGamesCheck?.map((g: any) => ({
      id: g.id,
      status: g.status,
      hasCorrectStatus: ['full', 'completed', 'expired'].includes(g.status),
      scheduled_at: g.scheduled_at,
      scheduled_before_now: g.scheduled_at <= now
    })))
    return []
  }

  // Filter: only games whose end time has passed
  const pastGames = gamesData.filter(g => {
    const endTime = new Date(new Date(g.scheduled_at).getTime() + (g.duration_minutes || 90) * 60000)
    const hasEnded = endTime <= new Date()
    console.log('[OpenGames] Game', g.id, 'endTime:', endTime.toISOString(), 'now:', new Date().toISOString(), 'hasEnded:', hasEnded)
    return hasEnded
  })

  console.log('[OpenGames] Past games (after end time filter):', pastGames.length)
  if (pastGames.length === 0) return []

  // Check which games already have results
  const pastGameIds = pastGames.map(g => g.id)
  console.log('[OpenGames] fetchGamesAwaitingResult will return', pastGames.length, 'games total')
  const { data: existingResults } = await supabase
    .from('open_game_results')
    .select('game_id, status, submitted_by_team')
    .in('game_id', pastGameIds)

  console.log('[OpenGames] Existing results:', existingResults?.length || 0)
  if (existingResults && existingResults.length > 0) {
    existingResults.forEach((r: any) => {
      console.log('[OpenGames] Result for game', r.game_id, 'status:', r.status, 'submitted_by_team:', r.submitted_by_team)
    })
  }

  const resultsMap = new Map((existingResults || []).map(r => [r.game_id, r.status]))
  const submittedByTeamMap = new Map((existingResults || []).map(r => [r.game_id, r.submitted_by_team]))

  // Fetch full data for these games using fetchOpenGames pattern
  const gameIdsForFetch = pastGames.map(g => g.id)
  
  const { data: playersData } = await supabase
    .from('open_game_players')
    .select('*')
    .in('game_id', gameIdsForFetch)
    .eq('status', 'confirmed')

  const userIds = [...new Set((playersData || []).map((p: any) => p.user_id).filter(Boolean))]
  const paIdsForPast = [...new Set((playersData || []).map((p: any) => p.player_account_id).filter(Boolean))]
  let playerAccountsMap: { [key: string]: { name: string; avatar_url: string | null; level: number | null; player_category: string | null } } = {}
  
  const pastQueries: Promise<any>[] = []
  if (userIds.length > 0) {
    pastQueries.push(supabase.from('player_accounts').select('id, user_id, name, avatar_url, level, player_category').in('user_id', userIds))
  }
  if (paIdsForPast.length > 0) {
    pastQueries.push(supabase.from('player_accounts').select('id, user_id, name, avatar_url, level, player_category').in('id', paIdsForPast))
  }
  const pastResults = await Promise.all(pastQueries)
  pastResults.forEach(({ data: accounts }) => {
    if (accounts) {
      accounts.forEach((a: any) => {
        if (a.user_id) playerAccountsMap[a.user_id] = { name: a.name, avatar_url: a.avatar_url, level: a.level, player_category: a.player_category }
        playerAccountsMap['pa_' + a.id] = { name: a.name, avatar_url: a.avatar_url, level: a.level, player_category: a.player_category }
      })
    }
  })

  const clubIds = [...new Set(pastGames.map(g => g.club_id))]
  let clubsMap: { [id: string]: { name: string; logo_url: string | null; city: string | null } } = {}
  if (clubIds.length > 0) {
    const { data: clubs } = await supabase.from('clubs').select('id, name, logo_url, city').in('id', clubIds)
    if (clubs) clubs.forEach((c: any) => { clubsMap[c.id] = { name: c.name, logo_url: c.logo_url, city: c.city } })
  }

  const courtIds = [...new Set(pastGames.filter(g => g.court_id).map(g => g.court_id))]
  let courtsMap: { [id: string]: { name: string; type: string | null } } = {}
  if (courtIds.length > 0) {
    const { data: courts } = await supabase.from('club_courts').select('id, name, type').in('id', courtIds)
    if (courts) courts.forEach((c: any) => { courtsMap[c.id] = { name: c.name, type: c.type || null } })
  }

  const allResults = pastGames.map((g: any) => {
    const gamePlayers = (playersData || [])
      .filter((p: any) => p.game_id === g.id)
      .map((p: any) => {
        const account = (p.player_account_id ? playerAccountsMap['pa_' + p.player_account_id] : null) || playerAccountsMap[p.user_id]
        return {
          id: p.id, user_id: p.user_id, player_account_id: p.player_account_id,
          status: p.status, position: p.position,
          name: account?.name || (typeof window !== 'undefined' ? getTranslations().common.player : 'Jogador'), avatar_url: account?.avatar_url || null,
          level: account?.level || null, player_category: account?.player_category || null,
        }
      })

    const club = clubsMap[g.club_id] || { name: (typeof window !== 'undefined' ? getTranslations().common.club : 'Clube'), logo_url: null, city: null }
    const court = g.court_id ? courtsMap[g.court_id] : null
    const resultStatus = resultsMap.get(g.id) || null

    const game = {
      id: g.id, creator_user_id: g.creator_user_id, club_id: g.club_id,
      club_name: club.name, club_logo_url: club.logo_url, club_city: club.city,
      court_id: g.court_id, court_name: court?.name || null,
      court_type: (court?.type as any) || null,
      scheduled_at: g.scheduled_at, duration_minutes: g.duration_minutes,
      game_type: g.game_type, gender: g.gender,
      level_min: parseFloat(g.level_min) || 1.0, level_max: parseFloat(g.level_max) || 7.0,
      price_per_player: parseFloat(g.price_per_player) || 0,
      max_players: g.max_players, status: g.status, notes: g.notes,
      players: gamePlayers, created_at: g.created_at,
      _resultStatus: resultStatus, // extra field for UI
      _submittedByTeam: submittedByTeamMap.get(g.id) || 0, // which team submitted the result
    } as OpenGame & { _resultStatus?: string | null; _submittedByTeam?: number }
    
    console.log('[OpenGames] Returning game:', game.id, 'resultStatus:', resultStatus, 'players:', gamePlayers.length)
    return game
  })

  // Exclude incomplete games (< 4 confirmed players) that have no result submitted
  return allResults.filter(g => {
    const confirmedCount = (g.players || []).length
    if (confirmedCount < 4 && !(g as any)._resultStatus) {
      console.log('[OpenGames] Excluding incomplete game', g.id, ':', confirmedCount, '/4 players, no result')
      return false
    }
    return true
  })
}

// ============================
// Fetch confirmed open game results for dashboard/history
// Returns PlayerMatch-compatible objects for recentMatches
// ============================

export interface OpenGameMatchResult {
  id: string
  game_id: string
  start_time: string
  tournament_id: string
  tournament_name: string
  court: string
  team1_name: string
  team2_name: string
  player1_name?: string
  player2_name?: string
  player3_name?: string
  player4_name?: string
  player1_avatar?: string | null
  player2_avatar?: string | null
  player3_avatar?: string | null
  player4_avatar?: string | null
  score1: number | null
  score2: number | null
  status: string
  round: string
  is_winner?: boolean
  set1?: string
  set2?: string
  set3?: string
  is_open_game: boolean
  open_game_id: string
  club_name?: string
}

export async function fetchConfirmedOpenGameResults(userId: string, playerAccountId?: string): Promise<OpenGameMatchResult[]> {
  // IMPORTANT: First, update any open_game_players records that have player_account_id but missing user_id
  if (playerAccountId) {
    try {
      await supabase
        .from('open_game_players')
        .update({ user_id: userId })
        .eq('player_account_id', playerAccountId)
        .is('user_id', null)
        .eq('status', 'confirmed')
    } catch (err) {
      console.error('[OpenGames] Error updating user_id for open_game_players:', err)
    }
  }

  // Auto-fix: Try to process ratings for any unprocessed confirmed results
  // This catches cases where processOpenGameRating failed silently
  try {
    const { data: unprocessedResults } = await supabase
      .from('open_game_results')
      .select('game_id')
      .eq('status', 'confirmed')
      .or('rating_processed.eq.false,rating_processed.is.null')
      .limit(5)

    if (unprocessedResults && unprocessedResults.length > 0) {
      console.log('[OpenGames] Found', unprocessedResults.length, 'unprocessed confirmed results, retrying...')
      for (const r of unprocessedResults) {
        try {
          await processOpenGameRating(r.game_id)
        } catch (err) {
          console.error('[OpenGames] Retry failed for game:', r.game_id, err)
        }
      }
    }
  } catch (err) {
    console.warn('[OpenGames] Error checking for unprocessed results:', err)
  }

  // Get all games where user participated (priority: player_account_id, then user_id)
  const queries = []
  
  if (playerAccountId) {
    queries.push(
      supabase
        .from('open_game_players')
        .select('game_id')
        .eq('player_account_id', playerAccountId)
        .eq('status', 'confirmed')
    )
  }
  
  queries.push(
    supabase
      .from('open_game_players')
      .select('game_id')
      .eq('user_id', userId)
      .eq('status', 'confirmed')
  )

  const results = await Promise.all(queries)
  const gameIdSet = new Set<string>()
  results.forEach(r => {
    (r.data || []).forEach((g: any) => gameIdSet.add(g.game_id))
  })

  if (gameIdSet.size === 0) return []
  const gameIds = Array.from(gameIdSet)

  // Fetch confirmed results for these games
  const { data: confirmedResults, error: resultsError } = await supabase
    .from('open_game_results')
    .select('*')
    .in('game_id', gameIds)
    .eq('status', 'confirmed')
    .order('created_at', { ascending: false })
    .limit(20)

  if (resultsError) {
    console.error('[OpenGames] Error fetching confirmed results:', resultsError)
  }
  console.log('[OpenGames] fetchConfirmedOpenGameResults: found', confirmedResults?.length || 0, 'confirmed results for', gameIds.length, 'games')

  if (!confirmedResults || confirmedResults.length === 0) {
    console.log('[OpenGames] No confirmed results found for games:', gameIds)
    return []
  }

  const confirmedGameIds = confirmedResults.map(r => r.game_id)
  console.log('[OpenGames] fetchConfirmedOpenGameResults: found', confirmedResults.length, 'confirmed results for', confirmedGameIds.length, 'games')

  // Fetch game details - use 'let' to allow fallback reassignment
  let gamesData: any[] | null = null
  
  const { data: directGamesData, error: gamesError } = await supabase
    .from('open_games')
    .select('id, scheduled_at, club_id, court_id')
    .in('id', confirmedGameIds)
  
  if (gamesError) {
    console.error('[OpenGames] Error fetching game details:', gamesError)
  }
  
  gamesData = directGamesData
  console.log('[OpenGames] Fetched', gamesData?.length || 0, 'game details directly')
  
  if (!gamesData || gamesData.length === 0) {
    console.warn('[OpenGames] No game details found directly - RLS may be blocking. Trying JOIN workaround...')
    // Try to fetch through open_game_results JOIN as workaround
    const { data: gamesViaResults, error: joinError } = await supabase
      .from('open_game_results')
      .select('game_id, open_games(id, scheduled_at, club_id, court_id)')
      .in('game_id', confirmedGameIds)
      .eq('status', 'confirmed')
    
    if (joinError) {
      console.error('[OpenGames] JOIN workaround error:', joinError)
    }
    
    if (gamesViaResults && gamesViaResults.length > 0) {
      console.log('[OpenGames] Found', gamesViaResults.length, 'games via open_game_results JOIN')
      const gamesFromJoin = gamesViaResults
        .map((r: any) => r.open_games)
        .filter(Boolean)
        .map((g: any) => ({
          id: g.id,
          scheduled_at: g.scheduled_at,
          club_id: g.club_id,
          court_id: g.court_id
        }))
      if (gamesFromJoin.length > 0) {
        gamesData = gamesFromJoin
        console.log('[OpenGames] Using games from JOIN:', gamesData.length)
      }
    }
    
    // If still no data, try constructing minimal game data from the results themselves
    if (!gamesData || gamesData.length === 0) {
      console.warn('[OpenGames] JOIN workaround also failed. Constructing minimal game data from results...')
      gamesData = confirmedResults.map(r => ({
        id: r.game_id,
        scheduled_at: r.created_at, // Use result creation date as fallback
        club_id: null,
        court_id: null
      }))
      console.log('[OpenGames] Constructed', gamesData.length, 'minimal game entries from results')
    }
  }

  // Fetch players
  const { data: playersData } = await supabase
    .from('open_game_players')
    .select('game_id, user_id, player_account_id, position')
    .in('game_id', confirmedGameIds)
    .eq('status', 'confirmed')
    .order('position', { ascending: true })

  // Fetch player accounts with avatars
  const userIds = [...new Set((playersData || []).map((p: any) => p.user_id).filter(Boolean))]
  const paIds = [...new Set((playersData || []).map((p: any) => p.player_account_id).filter(Boolean))]
  const accountsMap = new Map<string, { name: string; avatar_url: string | null }>()
  const playersMap = new Map<string, { name: string; avatar_url: string | null; position: number }>() // Map by game_id + position
  
  if (userIds.length > 0 || paIds.length > 0) {
    const accountQueries = []
    if (userIds.length > 0) {
      accountQueries.push(supabase.from('player_accounts').select('id, user_id, name, avatar_url').in('user_id', userIds))
    }
    if (paIds.length > 0) {
      accountQueries.push(supabase.from('player_accounts').select('id, user_id, name, avatar_url').in('id', paIds))
    }
    const accountResults = await Promise.all(accountQueries)
    accountResults.forEach(r => {
      (r.data || []).forEach((a: any) => {
        if (a.user_id) accountsMap.set('u_' + a.user_id, { name: a.name, avatar_url: a.avatar_url })
        accountsMap.set('pa_' + a.id, { name: a.name, avatar_url: a.avatar_url })
      })
    })
  }
  
  // Build players map for easy access
  ;(playersData || []).forEach((p: any) => {
    const acct = (p.player_account_id ? accountsMap.get('pa_' + p.player_account_id) : null) || accountsMap.get('u_' + p.user_id)
    if (acct) {
      playersMap.set(`${p.game_id}_${p.position}`, {
        name: acct.name,
        avatar_url: acct.avatar_url,
        position: p.position || 0
      })
    }
  })

  // Fetch clubs
  const clubIds = [...new Set((gamesData || []).map(g => g.club_id).filter(Boolean))]
  const clubsMap = new Map<string, string>()
  if (clubIds.length > 0) {
    const { data: clubs } = await supabase.from('clubs').select('id, name').in('id', clubIds)
    ;(clubs || []).forEach((c: any) => clubsMap.set(c.id, c.name))
  }

  const gamesMap = new Map((gamesData || []).map((g: any) => [g.id, g]))
  console.log('[OpenGames] Games map size:', gamesMap.size, 'for', confirmedGameIds.length, 'game IDs')

  return confirmedResults.map(result => {
    const game = gamesMap.get(result.game_id)
    if (!game) {
      console.warn('[OpenGames] Game not found in map for result:', result.game_id, '- skipping this result')
      return null // Skip results where game is not found
    }
    const gamePlayers = (playersData || [])
      .filter((p: any) => p.game_id === result.game_id)
      .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))

    const getPlayerInfo = (idx: number) => {
      const p = gamePlayers[idx]
      if (!p) return { name: 'TBD', avatar_url: null }
      const acct = (p.player_account_id ? accountsMap.get('pa_' + p.player_account_id) : null) || accountsMap.get('u_' + p.user_id)
      return { name: acct?.name || (typeof window !== 'undefined' ? getTranslations().common.player : 'Jogador'), avatar_url: acct?.avatar_url || null }
    }

    const p1 = getPlayerInfo(0)
    const p2 = getPlayerInfo(1)
    const p3 = getPlayerInfo(2)
    const p4 = getPlayerInfo(3)
    
    const p1Name = p1.name
    const p2Name = p2.name
    const p3Name = p3.name
    const p4Name = p4.name

    const s1 = `${result.team1_score_set1 || 0}-${result.team2_score_set1 || 0}`
    const s2 = (result.team1_score_set2 > 0 || result.team2_score_set2 > 0) ? `${result.team1_score_set2}-${result.team2_score_set2}` : undefined
    const s3 = (result.team1_score_set3 > 0 || result.team2_score_set3 > 0) ? `${result.team1_score_set3}-${result.team2_score_set3}` : undefined

    // Calculate who won
    const sets1 = (result.team1_score_set1 > result.team2_score_set1 ? 1 : 0) +
      (result.team1_score_set2 > result.team2_score_set2 ? 1 : 0) +
      (result.team1_score_set3 > result.team2_score_set3 ? 1 : 0)
    const sets2 = (result.team2_score_set1 > result.team1_score_set1 ? 1 : 0) +
      (result.team2_score_set2 > result.team1_score_set2 ? 1 : 0) +
      (result.team2_score_set3 > result.team1_score_set3 ? 1 : 0)

    // Determine if current user is in team 1 (positions 1,2) or team 2 (positions 3,4)
    const myPlayer = gamePlayers.find((p: any) => p.user_id === userId || (playerAccountId && p.player_account_id === playerAccountId))
    const myTeam = myPlayer ? ((myPlayer.position || 0) <= 2 ? 1 : 2) : 0
    const is_winner = myTeam === 1 ? sets1 > sets2 : myTeam === 2 ? sets2 > sets1 : undefined

    const t = typeof window !== 'undefined' ? getTranslations() : null
    const clubName = game ? clubsMap.get(game.club_id) || (t?.common.club || 'Clube') : (t?.common.club || 'Clube')

    return {
      id: `open_result_${result.game_id}`,
      game_id: result.game_id,
      start_time: game?.scheduled_at || result.created_at,
      tournament_id: '',
      tournament_name: 'Jogo Aberto',
      court: '',
      team1_name: `${p1Name} / ${p2Name}`,
      team2_name: `${p3Name} / ${p4Name}`,
      player1_name: p1Name,
      player2_name: p2Name,
      player3_name: p3Name,
      player4_name: p4Name,
      player1_avatar: p1.avatar_url,
      player2_avatar: p2.avatar_url,
      player3_avatar: p3.avatar_url,
      player4_avatar: p4.avatar_url,
      score1: sets1,
      score2: sets2,
      status: 'completed',
      round: '',
      is_winner,
      set1: s1,
      set2: s2,
      set3: s3,
      is_open_game: true,
      open_game_id: result.game_id,
      club_name: clubName,
    } as OpenGameMatchResult & { player1_avatar?: string | null; player2_avatar?: string | null; player3_avatar?: string | null; player4_avatar?: string | null }
  }).filter((r: any) => r !== null) // Filter out null results where game was not found
}

// ============================
// Fetch games with PENDING results that need action from current user
// (either no result at all, or result submitted by other team waiting confirmation)
// ============================

export async function fetchPendingResultGames(userId: string, playerAccountId?: string): Promise<(OpenGame & { _resultStatus?: string | null; _submittedByTeam?: number })[]> {
  const allGames = await fetchGamesAwaitingResult(userId, playerAccountId)
  console.log('[OpenGames] fetchPendingResultGames: received', allGames.length, 'games from fetchGamesAwaitingResult')
  
  // Return only games without confirmed results AND with 4 confirmed players
  const filtered = allGames.filter(g => {
    const status = (g as any)._resultStatus
    if (status === 'confirmed') return false

    // Exclude incomplete games (< 4 confirmed players)
    const confirmedCount = (g.players || []).filter((p: any) => p.status === 'confirmed').length
    if (confirmedCount < 4) {
      console.log('[OpenGames] Game', g.id, 'excluded: only', confirmedCount, '/4 confirmed players')
      return false
    }

    return true
  })
  
  console.log('[OpenGames] fetchPendingResultGames: returning', filtered.length, 'games after filtering')
  return filtered
}

// ============================
// Helper: Get player name from account ID
// ============================

async function getPlayerName(playerAccountId: string | null): Promise<string> {
  if (!playerAccountId) return 'Um jogador'
  try {
    const { data } = await supabase
      .from('player_accounts')
      .select('name')
      .eq('id', playerAccountId)
      .maybeSingle()
    return data?.name || 'Um jogador'
  } catch {
    return 'Um jogador'
  }
}

// ============================
// Quick Result Game — create a game just to record a result (no reservation)
// ============================

export async function createQuickResultGame(params: {
  userId: string
  playerAccountId?: string | null
  clubId: string
  scheduledAt: string      // ISO date string of when the game was played
  gameType: 'competitive' | 'friendly'
  players: { player_account_id: string; position: number; name: string | null }[]
  sets: { t1s1: number; t2s1: number; t1s2: number; t2s2: number; t1s3?: number; t2s3?: number }
}): Promise<{ success: boolean; gameId?: string; error?: string }> {
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const realUserId = authUser?.id
  if (!realUserId) return { success: false, error: 'Utilizador não autenticado' }

  // Get player level for range
  let playerLevel = 3.0
  if (params.playerAccountId) {
    const { data: pa } = await supabase
      .from('player_accounts')
      .select('level')
      .eq('id', params.playerAccountId)
      .maybeSingle()
    if (pa?.level) playerLevel = pa.level
  }

  const levelMin = Math.max(0.5, playerLevel - 1.0)
  const levelMax = playerLevel + 1.0

  // Create the game as completed with no court
  const { data: game, error: gameError } = await supabase
    .from('open_games')
    .insert({
      creator_user_id: realUserId,
      club_id: params.clubId,
      court_id: null,
      scheduled_at: params.scheduledAt,
      duration_minutes: 90,
      game_type: params.gameType,
      gender: 'all',
      level_min: levelMin,
      level_max: levelMax,
      price_per_player: 0,
      max_players: 4,
      status: 'completed',
      is_private: true,
      is_quick_result: true,
    })
    .select('id')
    .single()

  if (gameError || !game) {
    console.error('[QuickResult] Error creating game:', gameError)
    return { success: false, error: gameError?.message || 'Erro ao criar jogo' }
  }

  // Insert all 4 players
  const playerInserts = params.players.map(p => ({
    game_id: game.id,
    user_id: p.player_account_id === params.playerAccountId ? realUserId : null,
    player_account_id: p.player_account_id,
    status: 'confirmed' as const,
    position: p.position,
  }))

  // For players we don't know the user_id of, try to look it up
  for (const pi of playerInserts) {
    if (!pi.user_id && pi.player_account_id) {
      const { data: pa } = await supabase
        .from('player_accounts')
        .select('user_id')
        .eq('id', pi.player_account_id)
        .maybeSingle()
      if (pa?.user_id) pi.user_id = pa.user_id
    }
  }

  const { error: playersError } = await supabase.from('open_game_players').insert(playerInserts)
  if (playersError) {
    console.error('[QuickResult] Error adding players:', playersError)
    await supabase.from('open_games').delete().eq('id', game.id)
    return { success: false, error: 'Erro ao adicionar jogadores: ' + playersError.message }
  }

  // Insert result directly into open_game_results (auto-confirmed since creator is entering it)
  const { error: resultError } = await supabase
    .from('open_game_results')
    .insert({
      game_id: game.id,
      submitted_by_user_id: realUserId,
      submitted_by_player_account_id: params.playerAccountId || null,
      submitted_by_team: 1,
      team1_score_set1: params.sets.t1s1,
      team2_score_set1: params.sets.t2s1,
      team1_score_set2: params.sets.t1s2,
      team2_score_set2: params.sets.t2s2,
      team1_score_set3: params.sets.t1s3 ?? 0,
      team2_score_set3: params.sets.t2s3 ?? 0,
      status: 'confirmed',
      confirmed_by_user_id: realUserId,
      confirmed_at: new Date().toISOString(),
      rating_processed: false,
    })

  if (resultError) {
    console.error('[QuickResult] Error inserting result:', resultError)
    return { success: false, error: resultError.message }
  }

  // Process ratings if competitive
  if (params.gameType === 'competitive') {
    try {
      await processOpenGameRating(game.id)
    } catch (err) {
      console.error('[QuickResult] Error processing rating:', err)
    }
  }

  return { success: true, gameId: game.id }
}

export async function swapPlayerTeam(playerIdA: string, playerIdB: string): Promise<{ success: boolean; error?: string }> {
  const { data: players, error: fetchErr } = await supabase
    .from('open_game_players')
    .select('id, position')
    .in('id', [playerIdA, playerIdB])

  if (fetchErr || !players || players.length !== 2) {
    return { success: false, error: fetchErr?.message || 'Jogadores não encontrados' }
  }

  const pA = players.find(p => p.id === playerIdA)!
  const pB = players.find(p => p.id === playerIdB)!

  const { error: e1 } = await supabase
    .from('open_game_players')
    .update({ position: pB.position })
    .eq('id', playerIdA)

  if (e1) return { success: false, error: e1.message }

  const { error: e2 } = await supabase
    .from('open_game_players')
    .update({ position: pA.position })
    .eq('id', playerIdB)

  if (e2) return { success: false, error: e2.message }

  return { success: true }
}
