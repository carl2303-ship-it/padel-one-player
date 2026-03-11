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

export async function checkIsSubscribed(playerAccountId: string): Promise<boolean> {
  if (!isPushSupported()) return false

  try {
    const registration = await navigator.serviceWorker.ready
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

    const registration = await navigator.serviceWorker.ready
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

    console.log('[Push] Subscribed successfully')
    return true
  } catch (err) {
    console.error('[Push] Subscribe error:', err)
    return false
  }
}

export async function unsubscribeFromPush(playerAccountId: string): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (subscription) {
      await subscription.unsubscribe()

      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('player_account_id', playerAccountId)
        .eq('endpoint', subscription.endpoint)
    }

    console.log('[Push] Unsubscribed successfully')
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
      body: JSON.stringify({ playerAccountId, payload }),
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
