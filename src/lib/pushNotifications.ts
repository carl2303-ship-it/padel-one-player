import { supabase } from './supabase'

// Same VAPID key used in tour app
const VAPID_PUBLIC_KEY = 'BET_2Ji1WCUYQHQEzqyUiOzpKsmfQn9LuPTbNemOY0pxOiO4wbwpMYIfRcAMdJncZmo7vBDggAcih1IIxSdGi58'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from(rawData, char => char.charCodeAt(0))
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function getPermission(): NotificationPermission {
  if ('Notification' in window) return Notification.permission
  return 'denied'
}

/** Get an active SW registration with timeout + re-register fallback (fixes Samsung/mobile hangs). */
async function getSwRegistration(timeoutMs = 8000): Promise<ServiceWorkerRegistration> {
  const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('SW ready timeout')), ms)),
    ])

  try {
    return await withTimeout(navigator.serviceWorker.ready, timeoutMs)
  } catch {
    console.warn('[Push] SW ready timed out, re-registering...')
    const reg = await navigator.serviceWorker.register('/sw.js')
    if (reg.active) return reg
    await new Promise<void>((resolve) => {
      const sw = reg.installing || reg.waiting
      if (!sw) { resolve(); return }
      sw.addEventListener('statechange', () => {
        if (sw.state === 'activated') resolve()
      })
      setTimeout(resolve, 5000)
    })
    return reg
  }
}

export async function checkIsSubscribed(playerAccountId: string): Promise<boolean> {
  if (!isPushSupported()) return false

  try {
    const registration = await getSwRegistration()
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return false

    const { data } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('player_account_id', playerAccountId)
      .eq('endpoint', subscription.endpoint)
      .maybeSingle()

    return !!data
  } catch {
    return false
  }
}

export async function subscribeToPush(playerAccountId: string): Promise<boolean> {
  if (!isPushSupported()) {
    console.warn('[Push] Not supported')
    return false
  }

  try {
    const permissionResult = await Notification.requestPermission()
    if (permissionResult !== 'granted') {
      console.warn('[Push] Permission denied')
      return false
    }

    const registration = await getSwRegistration()
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }

    const subscriptionJson = subscription.toJSON()
    if (!subscriptionJson.keys?.p256dh || !subscriptionJson.keys?.auth) {
      throw new Error('Invalid subscription keys')
    }

    // Get auth user_id too
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        player_account_id: playerAccountId,
        user_id: user?.id || null,
        endpoint: subscription.endpoint,
        p256dh: subscriptionJson.keys.p256dh,
        auth: subscriptionJson.keys.auth,
        updated_at: new Date().toISOString(),
        app_source: 'player',
      }, {
        onConflict: 'player_account_id,endpoint',
        ignoreDuplicates: false,
      })

    if (error) {
      console.error('[Push] Upsert error:', error)
      // Try with user_id conflict instead
      const { error: error2 } = await supabase
        .from('push_subscriptions')
        .upsert({
          player_account_id: playerAccountId,
          user_id: user?.id || null,
          endpoint: subscription.endpoint,
          p256dh: subscriptionJson.keys.p256dh,
          auth: subscriptionJson.keys.auth,
          updated_at: new Date().toISOString(),
          app_source: 'player',
        }, {
          onConflict: 'user_id,endpoint',
          ignoreDuplicates: false,
        })
      if (error2) {
        console.error('[Push] Upsert error2:', error2)
        return false
      }
    }

    return true
  } catch (err) {
    console.error('[Push] Subscribe error:', err)
    return false
  }
}

export async function unsubscribeFromPush(playerAccountId: string): Promise<boolean> {
  try {
    const registration = await getSwRegistration()
    const subscription = await registration.pushManager.getSubscription()

    if (subscription) {
      await subscription.unsubscribe()

      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('player_account_id', playerAccountId)
        .eq('endpoint', subscription.endpoint)
    }

    return true
  } catch (err) {
    console.error('[Push] Unsubscribe error:', err)
    return false
  }
}

// ============================
// Send push notification to a player (calls edge function)
// ============================

interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

export async function sendPushToPlayer(playerAccountId: string, payload: PushPayload): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const supabaseUrl = 'https://rqiwnxcexsccguruiteq.supabase.co'
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxaXdueGNleHNjY2d1cnVpdGVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3Njc5MzcsImV4cCI6MjA3NTM0MzkzN30.Dl05zPQDtPVpmvn_Y-JokT3wDq0Oh9uF3op5xcHZpkY'

    await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({ playerAccountId, payload, appSource: 'player' }),
    })
  } catch (err) {
    console.error('[Push] Send error:', err)
  }
}

// ============================
// Notify all players in an open game (except the actor)
// ============================

export async function notifyOpenGamePlayers(
  gameId: string,
  excludePlayerAccountId: string | null,
  payload: PushPayload
): Promise<void> {
  try {
    // Get all confirmed players in the game
    const { data: players } = await supabase
      .from('open_game_players')
      .select('player_account_id')
      .eq('game_id', gameId)
      .eq('status', 'confirmed')

    if (!players || players.length === 0) return

    const targets = players
      .map(p => p.player_account_id)
      .filter((id): id is string => !!id && id !== excludePlayerAccountId)

    // Send to each player
    await Promise.allSettled(targets.map(id => sendPushToPlayer(id, payload)))
  } catch (err) {
    console.error('[Push] NotifyGamePlayers error:', err)
  }
}

// ============================
// Notify the game creator specifically
// ============================

export async function notifyGameCreator(
  gameId: string,
  payload: PushPayload
): Promise<void> {
  try {
    // Get game creator
    const { data: game } = await supabase
      .from('open_games')
      .select('creator_user_id')
      .eq('id', gameId)
      .single()

    if (!game?.creator_user_id) return

    // Find player_account for creator
    const { data: account } = await supabase
      .from('player_accounts')
      .select('id')
      .eq('user_id', game.creator_user_id)
      .maybeSingle()

    if (!account) return

    await sendPushToPlayer(account.id, payload)
  } catch (err) {
    console.error('[Push] NotifyCreator error:', err)
  }
}

// ============================
// Notify matching players when a new game is created
// Matches: level range, gender, and preferred play time
// ============================

function getTimeOfDay(isoDate: string): 'morning' | 'afternoon' | 'evening' {
  const date = new Date(isoDate)
  const hour = date.getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

export async function notifyMatchingPlayersForNewGame(params: {
  gameId: string
  creatorPlayerAccountId: string | null
  levelMin: number
  levelMax: number
  gender: 'all' | 'male' | 'female' | 'mixed'
  scheduledAt: string
  clubName: string
}): Promise<void> {
  try {
    const timeOfDay = getTimeOfDay(params.scheduledAt)
    const gameDate = new Date(params.scheduledAt)
    const timeStr = `${gameDate.getHours().toString().padStart(2, '0')}:${gameDate.getMinutes().toString().padStart(2, '0')}`

    // Query matching player_accounts:
    // - Level within range
    // - Has push subscription (we check later)
    // - preferred_time matches or is all_day
    let query = supabase
      .from('player_accounts')
      .select('id, name, level, gender, preferred_time')
      .gte('level', params.levelMin)
      .lte('level', params.levelMax)
      .not('id', 'is', null)

    const { data: matchingPlayers, error } = await query

    if (error || !matchingPlayers || matchingPlayers.length === 0) {
      return
    }

    // Filter by gender
    let filtered = matchingPlayers.filter(p => {
      // If game is for all or mixed, everyone can join
      if (params.gender === 'all' || params.gender === 'mixed') return true
      // If game is for male, only male players
      if (params.gender === 'male') return p.gender === 'male'
      // If game is for female, only female players
      if (params.gender === 'female') return p.gender === 'female'
      return true
    })

    // Filter by preferred time
    filtered = filtered.filter(p => {
      if (!p.preferred_time || p.preferred_time === 'all_day') return true
      return p.preferred_time === timeOfDay
    })

    // Exclude the creator
    if (params.creatorPlayerAccountId) {
      filtered = filtered.filter(p => p.id !== params.creatorPlayerAccountId)
    }

    if (filtered.length === 0) {
      return
    }


    const genderLabel = params.gender === 'male' ? '♂️' : params.gender === 'female' ? '♀️' : '🎾'
    const payload: PushPayload = {
      title: `Novo Jogo ${genderLabel} - Nível ${params.levelMin.toFixed(1)}-${params.levelMax.toFixed(1)}`,
      body: `${params.clubName} às ${timeStr}. Junta-te!`,
      url: '/?screen=findGame',
      tag: `new-game-${params.gameId}`,
    }

    // Send to all matching (limit to 50 to avoid overload)
    const targets = filtered.slice(0, 50)
    await Promise.allSettled(targets.map(p => sendPushToPlayer(p.id, payload)))

  } catch (err) {
    console.error('[Push] NotifyMatchingPlayers error:', err)
  }
}
