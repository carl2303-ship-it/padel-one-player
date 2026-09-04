import { useState, useEffect, useMemo, useRef, useCallback, Fragment, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { supabase, PlayerAccount } from './lib/supabase'
import { useI18n } from './lib/i18nContext'
import PlayerLandingPage from './components/PlayerLandingPage'
import ClubLandingPage from './components/ClubLandingPage'
import PlayerLadderTournamentPanel from './components/PlayerLadderTournamentPanel'

// Ecrãs extraídos para ficheiros próprios e carregados sob demanda (code-splitting).
// Cada um só é descarregado quando o utilizador realmente navega para lá.
const ClubScreen = lazy(() => import('./components/screens/ClubScreen'))
const PaymentsScreen = lazy(() => import('./components/screens/PaymentsScreen'))
const RewardsScreen = lazy(() => import('./components/screens/RewardsScreen'))
const RankingsScreen = lazy(() => import('./components/screens/RankingsScreen'))
const ClubsListScreen = lazy(() => import('./components/screens/ClubsListScreen'))
const ClubDetailScreen = lazy(() => import('./components/screens/ClubDetailScreen'))
const LearnScreen = lazy(() => import('./components/screens/LearnScreen'))
const BookingScreen = lazy(() => import('./components/screens/BookingScreen'))
const CompeteScreen = lazy(() => import('./components/screens/CompeteScreen'))
const FindGameScreen = lazy(() => import('./components/screens/FindGameScreen'))
const GamesScreen = lazy(() => import('./components/screens/GamesScreen'))

// Fallback simples e consistente com o spinner já usado no resto da app,
// mostrado só por instantes enquanto o chunk do ecrã é descarregado.
function ScreenLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
import {
  fetchPlayerDashboardData,
  enrichDashboardWithEdgeFunction,
  type PlayerDashboardData,
} from './lib/playerDashboardData'
import { fetchPlayerAccountByPhone, resolvePlayerAccountForUser } from './lib/resolvePlayerAccount'
import { 
  Home, 
  Trophy, 
  Calendar, 
  User, 
  ChevronRight,
  Clock,
  MapPin,
  TrendingUp,
  Target,
  Award,
  Bell,
  Search,
  Plus,
  Smartphone,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  Settings,
  Edit2,
  Camera,
  Building2,
  Gamepad2,
  ArrowLeft,
  Phone,
  Mail,
  Globe,
  GraduationCap,
  Users,
  ExternalLink,
  Save,
  X,
  ChevronDown,
  Menu,
  KeyRound,
  HelpCircle,
  Shield,
  CreditCard,
  Heart,
  Image,
  Video,
  UserPlus,
  RefreshCw,
  Send,
  Trash2,
  ChevronLeft,
  Gift,
  ShoppingBag,
  CheckCircle,
  AlertCircle,
  Star,
  Check,
  Navigation
} from 'lucide-react'
import {
  followUser,
  unfollowUser,
  getFollowingIds,
  getFollowingCount,
  getFollowersCount,
  getSuggestedPlayers,
  createPost,
  deletePost,
  searchPlayers,
  getPlayerProfile,
  getFollowingList,
  getFollowersList,
  levelColors,
  getInitials,
  type CommunityPlayer,
  type PlayerProfile,
  type CommunityPost,
  type FeedItem,
  type FeedMatchItem,
  getUnifiedFeed,
} from './lib/communityData'
import { fetchAllClubs, fetchClubById, fetchUpcomingTournaments, fetchTournamentsByIds, fetchTournamentEnrolledCounts, fetchEnrolledByCategory, fetchTournamentFullDetail, getTournamentRegistrationUrl, fetchMyTournamentInvites, updateTournamentInviteStatus, fetchPlayerClubs, togglePlayerClub, fetchNearbyFullClubs, updatePlayerLocation, requestBrowserGeolocation, type ClubDetail, type UpcomingTournamentFromTour, type EnrolledByCategory, type EnrolledItem, type EnrolledPlayer, type TournamentFullDetail, type NearbyFullClub } from './lib/clubAndTournaments'
import { fetchPlayerPreview, type PlayerPreviewData } from './lib/playerPreview'
import { preloadAllPlayerData, getCachedPlayerData } from './lib/playerDataCache'
import { fetchLevelHistory, type LevelHistoryEntry } from './lib/levelHistory'
import { geocodeAddress } from './lib/geocoding'
import {
  createGroup,
  updateGroup,
  deleteGroup,
  getMyGroups,
  getGroupDetails,
  getGroupMembers,
  removeGroupMember,
  leaveGroup,
  inviteToGroup,
  getMyGroupInvites,
  respondToGroupInvite,
  uploadGroupImage,
  type CommunityGroup,
  type GroupMember,
  type GroupInvite,
} from './lib/communityGroups'
import {
  sendMessage,
  getMessages,
  addReaction,
  removeReaction,
  deleteMessage,
  uploadChatImage,
  subscribeToGroupChat,
  type ChatMessage,
} from './lib/groupChat'
import { isPushSupported, checkIsSubscribed, subscribeToPush, unsubscribeFromPush } from './lib/pushNotifications'
import {
  normalizePhone,
  isValidPhone,
  composeInternationalPhone,
  COUNTRY_DIAL_CODES,
  defaultCountryIso,
  dialCodeForIso,
  formatPhoneDisplay,
} from './lib/phoneUtils'
import { resolveFourPlayerNames, getPartnerNamesFromMatch, isLikelyTeamLabel } from './lib/matchPlayerNames'
import {
  requestPartnerMatch,
  fetchPendingPartnerInvites,
  fetchPartnerMatchRequesterSummary,
  acceptPartnerInvite,
  confirmPartnerMatch,
  declinePartnerInvite,
  cancelPartnerRequest,
  type PartnerInvite,
  type PartnerMatchRequesterSummary,
} from './lib/partnerMatch'
import { fetchClientModules, derivePlayerFeatures, EMPTY_MODULES, type ClientModulesResult } from './lib/useClientModules'


import {
  formatDate,
  formatDateTime,
  formatDateWithTime,
  shortPlayerLabel,
  OpenGameResultScores,
  ActionButton,
  MatchCard,
  EnrolledItemRow,
  PlayerPreviewPopup,
  GameCardPlaytomic,
  TournamentCard,
  OpenGameCard,
  PlayerCircle,
  initialFor,
  type PlayerMatchForCard,
} from './components/shared/matchUi'

type Screen = 'home' | 'games' | 'profile-view' | 'profile-edit' | 'club' | 'club-detail' | 'clubs-list' | 'compete' | 'community' | 'player-profile' | 'follows-list' | 'learn' | 'find-game' | 'game-results' | 'rewards' | 'booking' | 'payments' | 'group-detail' | 'rankings'

function App() {
  const { t, language, setLanguage, languageNames, languageFlags } = useI18n()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [player, setPlayer] = useState<PlayerAccount | null>(null)
  const [authUserId, setAuthUserId] = useState<string | null>(null) // The real auth.uid() from Supabase
  const [currentScreen, setCurrentScreen] = useState<Screen>('home')
  const [pendingTournamentId, setPendingTournamentId] = useState<string | null>(null)
  const [selectedPlayerUserId, setSelectedPlayerUserId] = useState<string | null>(null)
  const [selectedPlayerAccountId, setSelectedPlayerAccountId] = useState<string | null>(null)
  const [selectedPlayerNameHint, setSelectedPlayerNameHint] = useState<string | null>(null)
  const [followsListUserId, setFollowsListUserId] = useState<string | null>(null) // For FollowsListScreen
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [createGameForGroupId, setCreateGameForGroupId] = useState<string | null>(null)
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const openPlayerProfile = (uid: string, opts?: { accountId?: string | null; nameHint?: string | null }) => {
    setSelectedPlayerUserId(uid)
    setSelectedPlayerAccountId(opts?.accountId ?? null)
    setSelectedPlayerNameHint(opts?.nameHint ?? null)
    setCurrentScreen('player-profile')
  }
  
  // Auth states
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  const [isAuthLoading, setIsAuthLoading] = useState(false)

  // Dashboard data (mesma fonte que Padel One Tour – dados nos dois lados)
  const [dashboardData, setDashboardData] = useState<PlayerDashboardData | null>(null)
  // Edge function data — estado separado que NUNCA é sobrescrito por setDashboardData
  // Guarda TODOS os dados enriquecidos (recentMatches, stats, pastTournamentDetails, etc.)
  const [edgeEnrichedData, setEdgeEnrichedData] = useState<Partial<PlayerDashboardData> | null>(null)
  const [gamesInitialTab, setGamesInitialTab] = useState<'upcoming' | 'history'>('upcoming')
  const [menuOpen, setMenuOpen] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  // Push notifications
  const [pushSupported] = useState(isPushSupported())
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState<'help' | 'howItWorks' | 'privacy' | null>(null)
  const [showRegister, setShowRegister] = useState(false)
  const [publicPage, setPublicPage] = useState<'landing' | 'clubs' | 'login' | 'register'>(() => {
    const p = window.location.pathname
    if (p === '/clubs') return 'clubs'
    if (p === '/login') return 'login'
    if (p === '/register') return 'register'
    return 'landing'
  })
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false)
  const [clientModules, setClientModules] = useState<ClientModulesResult>(EMPTY_MODULES)
  const playerFeatures = useMemo(() => {
    if (!player?.favorite_club_id) {
      return {
        isLiteMode: true,
        canBook: false,
        canFindGame: false,
        canLearn: false,
        canRewards: false,
      }
    }
    return derivePlayerFeatures(clientModules)
  }, [clientModules, player?.favorite_club_id])
  const { isLiteMode, canBook, canFindGame, canLearn, canRewards } = playerFeatures

  useEffect(() => {
    if (!player?.favorite_club_id) {
      setClientModules(EMPTY_MODULES)
      return
    }
    let cancelled = false
    const clubIdAtRequest = player.favorite_club_id
    fetchClientModules('club', clubIdAtRequest).then((modules) => {
      // Evita sobrescrever com dados desatualizados se o clube activo mudou
      // enquanto este pedido estava em curso (troca rápida de clube).
      if (!cancelled && player?.favorite_club_id === clubIdAtRequest) {
        setClientModules(modules)
      }
    })
    return () => { cancelled = true }
  }, [player?.favorite_club_id])

  // GPS pontual: actualiza lat/lng do jogador (descoberta zona 50 km)
  useEffect(() => {
    if (!player?.id || !isAuthenticated) return
    let cancelled = false
    ;(async () => {
      const coords = await requestBrowserGeolocation()
      if (!coords || cancelled) return
      await updatePlayerLocation(player.id, coords.lat, coords.lng)
      if (cancelled) return
      setPlayer(prev => prev ? { ...prev, lat: coords.lat, lng: coords.lng } as any : prev)
    })()
    return () => { cancelled = true }
  }, [player?.id, isAuthenticated])

  useEffect(() => {
    if (currentScreen === 'booking' && !canBook) setCurrentScreen('home')
    if (currentScreen === 'find-game' && !canFindGame) setCurrentScreen('home')
    if (currentScreen === 'learn' && !canLearn) setCurrentScreen('home')
  }, [canBook, canFindGame, canLearn, currentScreen])

  useEffect(() => {
    const onPopState = () => {
      const p = window.location.pathname
      if (p === '/clubs') setPublicPage('clubs')
      else if (p === '/login') setPublicPage('login')
      else if (p === '/register') { setPublicPage('register'); setShowRegister(true) }
      else { setPublicPage('landing'); setShowRegister(false) }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    checkAuth()
  }, [])

  // Auto-refresh when app returns to foreground (e.g., user switches back to the app on iPhone/Android)
  const lastForegroundRefresh = useRef(Date.now())
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        // Reconnect Supabase Realtime (iOS kills websockets in background)
        try {
          supabase.realtime.disconnect()
          supabase.realtime.connect()
        } catch {}

        const elapsed = Date.now() - lastForegroundRefresh.current
        if (elapsed > 30_000 && isAuthenticated && player?.user_id) {
          lastForegroundRefresh.current = Date.now()
          const data = await fetchPlayerDashboardData(player.user_id, {
            id: player.id,
            name: player.name,
            phone_number: (player as any).phone_number ?? null,
          })
          setDashboardData(data)
          enrichDashboardWithEdgeFunction(data).then(enriched => {
            if (enriched) {
              setEdgeEnrichedData(prev => ({
                ...prev,
                ...enriched,
                stats: enriched.stats ?? prev?.stats,
                recentMatches: enriched.recentMatches ?? prev?.recentMatches,
              }))
              setDashboardData(prev => prev ? {
                ...prev,
                ...enriched,
                stats: enriched.stats ?? prev.stats,
              } : prev)
              if (enriched.stats) {
                setPlayer(p => p ? { ...p, wins: enriched.stats!.wins, losses: enriched.stats!.losses } as any : p)
              }
            }
          })
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isAuthenticated, player?.user_id])

  // Handle Stripe payment return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const paymentStatus = params.get('payment')
    const gameId = params.get('game_id')
    if (paymentStatus === 'success' && gameId) {
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname)
      // Show success and navigate to games
      setTimeout(() => {
        alert(t.payments.paymentSuccess)
        setCurrentScreen('games')
      }, 500)
    } else if (paymentStatus === 'cancelled') {
      window.history.replaceState({}, '', window.location.pathname)
      setTimeout(() => {
        alert(t.payments.paymentCancelled)
      }, 500)
    }
  }, [])

  // Deep link: chat do desafio da escada (push / partilha) — ?group=<uuid>
  useEffect(() => {
    if (!player?.user_id) return
    let params: URLSearchParams
    try {
      params = new URLSearchParams(window.location.search)
    } catch {
      return
    }
    const gid = params.get('group')
    if (!gid || !/^[0-9a-f-]{36}$/i.test(gid.trim())) return
    window.history.replaceState({}, '', window.location.pathname)
    setSelectedGroupId(gid.trim())
    setCurrentScreen('group-detail')
  }, [player?.user_id])

  // Check push subscription status when player is loaded
  useEffect(() => {
    if (player?.id && pushSupported) {
      checkIsSubscribed(player.id).then(setPushSubscribed)
    }
  }, [player?.id, pushSupported])

  const handleTogglePush = async () => {
    if (!player?.id) return
    setPushLoading(true)
    try {
      if (pushSubscribed) {
        const ok = await unsubscribeFromPush(player.id)
        if (ok) setPushSubscribed(false)
      } else {
        const ok = await subscribeToPush(player.id)
        if (ok) setPushSubscribed(true)
      }
    } finally {
      setPushLoading(false)
    }
  }

  const checkAuth = async () => {
    setIsLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const authUid = session?.user?.id || null

    // If no valid Supabase session, clear local state and force re-login
    if (!session) {
      const savedPhone = localStorage.getItem('padel_one_player_phone')
      if (savedPhone) {
        // Session expired but phone is saved - user needs to re-login
      }
      setIsLoading(false)
      return
    }

    // Priority 1: Find player by saved phone (most reliable - user's actual phone)
    const savedPhone = localStorage.getItem('padel_one_player_phone')
    if (savedPhone) {
      const fullAccount = await fetchPlayerAccountByPhone(savedPhone)

      if (fullAccount) {
        setPlayer(fullAccount as any)
        setIsAuthenticated(true)
        setAuthUserId(authUid || fullAccount.user_id || null)
        fetchPlayerClubs(fullAccount.id).then(ids => setPlayer(prev => prev ? { ...prev, club_ids: ids } as any : prev))
        // Cache de todos os jogadores (usado só para fuzzy-match de nomes em cards de jogo) —
        // não bloqueia o ecrã inicial, corre em segundo plano.
        preloadAllPlayerData()
        if (fullAccount.user_id) {
          const dash = await fetchPlayerDashboardData(fullAccount.user_id, {
            id: fullAccount.id,
            name: fullAccount.name,
            phone_number: fullAccount.phone_number ?? null,
          })
          setDashboardData(dash)
          enrichDashboardWithEdgeFunction(dash).then(enriched => {
            if (enriched) {
              setEdgeEnrichedData(prev => ({
                ...prev,
                ...enriched,
                stats: enriched.stats ?? prev?.stats,
                recentMatches: enriched.recentMatches ?? prev?.recentMatches,
              }))
              setDashboardData(prev => prev ? {
                ...prev,
                ...enriched,
                stats: enriched.stats ?? prev.stats,
              } : prev)
              if (enriched.stats) {
                setPlayer(p => p ? { ...p, wins: enriched.stats!.wins, losses: enriched.stats!.losses } as any : p)
              }
            }
          })
        }
        setIsLoading(false)
        return
      }
    }

    // Priority 2: Find player by auth session user_id (only if phone lookup failed)
    if (session?.user) {
      const savedPhone = localStorage.getItem('padel_one_player_phone')
      const playerAccount = await resolvePlayerAccountForUser(session.user.id, {
        phoneNumber: savedPhone || undefined,
      })

      if (playerAccount) {
        setPlayer(playerAccount as any)
        setAuthUserId(session.user.id)
        setIsAuthenticated(true)
        fetchPlayerClubs(playerAccount.id).then(ids => setPlayer(prev => prev ? { ...prev, club_ids: ids } as any : prev))
        preloadAllPlayerData()
        const data = await fetchPlayerDashboardData(session.user.id, {
          id: playerAccount.id,
          name: playerAccount.name,
          phone_number: playerAccount.phone_number ?? null,
        })
        setDashboardData(data)
        enrichDashboardWithEdgeFunction(data).then(enriched => {
          if (enriched) {
            setEdgeEnrichedData(prev => ({
              ...prev,
              ...enriched,
              stats: enriched.stats ?? prev?.stats,
              recentMatches: enriched.recentMatches ?? prev?.recentMatches,
            }))
            setDashboardData(prev => prev ? {
              ...prev,
              ...enriched,
              stats: enriched.stats ?? prev.stats,
            } : prev)
            if (enriched.stats) {
              setPlayer(p => p ? { ...p, wins: enriched.stats!.wins, losses: enriched.stats!.losses } as any : p)
            }
          }
        })
        setIsLoading(false)
        return
      }
    }

    setIsLoading(false)
  }

  const refreshDashboard = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user && player) {
      const data = await fetchPlayerDashboardData(session.user.id, {
        id: player.id,
        name: player.name,
        phone_number: (player as any).phone_number ?? null,
      })
      setDashboardData(data)
      // Enrich with Edge Function in background
      enrichDashboardWithEdgeFunction(data).then(enriched => {
        if (enriched) {
          setEdgeEnrichedData(prev => ({
            ...prev,
            ...enriched,
            stats: enriched.stats ?? prev?.stats,
            recentMatches: enriched.recentMatches ?? prev?.recentMatches,
          }))
          setDashboardData(prev => prev ? {
            ...prev,
            ...enriched,
            stats: enriched.stats ?? prev.stats,
          } : prev)
          if (enriched.stats) {
            setPlayer(p => p ? { ...p, wins: enriched.stats!.wins, losses: enriched.stats!.losses } as any : p)
          }
        }
      })
    }
  }

  const handleSaveFavoriteClub = async (clubId: string | null) => {
    if (!player?.id) return
    const { data: updated } = await supabase
      .from('player_accounts')
      .update({ favorite_club_id: clubId })
      .eq('id', player.id)
      .select()
      .single()
    if (updated) {
      setPlayer({ ...player, ...updated } as any)
    }
    if (clubId !== null && clubId !== undefined) {
      localStorage.setItem('padel_one_player_favorite_club_id', clubId)
    } else {
      localStorage.removeItem('padel_one_player_favorite_club_id')
    }
  }

  const handleSaveProfile = async (updates: Partial<PlayerAccount>) => {
    if (!player?.id) return
    const { data: updated, error } = await supabase
      .from('player_accounts')
      .update(updates)
      .eq('id', player.id)
      .select()
      .single()
    if (error) {
      console.error('[PROFILE]', t.common.profileSaveError + ':', error)
      throw error
    }
    if (updated) {
      setPlayer({ ...player, ...updated } as any)
    }
  }

  const handleLogin = async () => {
    setAuthError('')
    setIsAuthLoading(true)

    try {
      let playerAccount: any = null

      // Login via telefone - usa Edge Function como o Tour
      const normalizedPhone = normalizePhone(phone)

      // Chamar Edge Function para obter o email (usa Service Role Key, ignora RLS)
      const response = await fetch(
        'https://rqiwnxcexsccguruiteq.supabase.co/functions/v1/get-player-login-email',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxaXdueGNleHNjY2d1cnVpdGVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3Njc5MzcsImV4cCI6MjA3NTM0MzkzN30.Dl05zPQDtPVpmvn_Y-JokT3wDq0Oh9uF3op5xcHZpkY',
          },
          body: JSON.stringify({ phone_number: normalizedPhone }),
        }
      )

      const emailData = await response.json()
      if (!response.ok || !emailData?.success || !emailData?.email) {
        if (emailData?.error === 'Player account not found') {
          setAuthError(t.common.phoneNotFound)
        } else if (emailData?.error === 'Player account has no email') {
          setAuthError(t.common.accountNoEmail)
        } else {
          setAuthError(emailData?.error || t.common.verifyPhoneError)
        }
        setIsAuthLoading(false)
        return
      }

      const emailToUse = emailData.email
      // Fazer login com Supabase Auth
      const { error: authError, data: authData } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: password,
      })

      if (authError) {
        if (authError.message.includes('Invalid login')) {
          setAuthError(t.auth.incorrectPassword)
        } else {
          setAuthError(t.common.loginError + ': ' + authError.message)
        }
        setIsAuthLoading(false)
        return
      }

      // Buscar player_account pelo telefone (mais fiável que auth user_id)
      const phoneResolved = await fetchPlayerAccountByPhone(normalizedPhone)
      if (phoneResolved) {
        playerAccount = phoneResolved
      }

      // Fallback: buscar pelo auth user_id se telefone não encontrou
      if (!playerAccount && authData?.user) {
        const resolved = await resolvePlayerAccountForUser(authData.user.id, {
          phoneNumber: normalizedPhone,
        })
        if (resolved) {
          playerAccount = resolved
        }
      }

      localStorage.setItem('padel_one_player_phone', normalizedPhone)

      if (playerAccount) {
        setPlayer(playerAccount as any)
        setAuthUserId(authData?.user?.id || playerAccount.user_id || null)
        fetchPlayerClubs(playerAccount.id).then(ids => setPlayer(prev => prev ? { ...prev, club_ids: ids } as any : prev))
        preloadAllPlayerData()
        if (playerAccount.user_id) {
          const data = await fetchPlayerDashboardData(playerAccount.user_id, {
            id: playerAccount.id,
            name: playerAccount.name,
            phone_number: playerAccount.phone_number,
          })
          setDashboardData(data)
          enrichDashboardWithEdgeFunction(data).then(enriched => {
            if (enriched) {
              setEdgeEnrichedData(prev => ({
                ...prev,
                ...enriched,
                stats: enriched.stats ?? prev?.stats,
                recentMatches: enriched.recentMatches ?? prev?.recentMatches,
              }))
              setDashboardData(prev => prev ? {
                ...prev,
                ...enriched,
                stats: enriched.stats ?? prev.stats,
              } : prev)
              if (enriched.stats) {
                setPlayer(p => p ? { ...p, wins: enriched.stats!.wins, losses: enriched.stats!.losses } as any : p)
              }
            }
          })
        }
      }
      setIsAuthenticated(true)
    } catch (err) {
      console.error('Login error:', err)
      setAuthError(t.common.loginError)
    }
    
    setIsAuthLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('padel_one_player_phone')
    setPlayer(null)
    setIsAuthenticated(false)
    setPhone('')
    setPassword('')
  }

  // DADOS EFETIVOS: merge dashboardData (client-side) + edgeEnrichedData (edge function)
  // Edge stats are authoritative — never let a later client refresh wipe draws back to losses
  // NOTA: Este useMemo TEM de estar ANTES de qualquer return condicional (Rules of Hooks)
  const effectiveDashboard = useMemo(() => {
    if (!dashboardData) return null
    if (!edgeEnrichedData) return dashboardData
    return {
      ...dashboardData,
      ...edgeEnrichedData,
      playerName: edgeEnrichedData.playerName || dashboardData.playerName,
      stats: edgeEnrichedData.stats ?? dashboardData.stats,
      recentMatches: edgeEnrichedData.recentMatches ?? dashboardData.recentMatches,
      pastTournaments: edgeEnrichedData.pastTournaments?.length
        ? edgeEnrichedData.pastTournaments
        : dashboardData.pastTournaments,
      pastTournamentDetails: edgeEnrichedData.pastTournamentDetails &&
        Object.keys(edgeEnrichedData.pastTournamentDetails).length > 0
        ? edgeEnrichedData.pastTournamentDetails
        : dashboardData.pastTournamentDetails,
    }
  }, [dashboardData, edgeEnrichedData])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">{t.common.loading}</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    const navigateTo = (page: typeof publicPage, path: string) => {
      window.history.pushState({}, '', path)
      setPublicPage(page)
      if (page === 'register') setShowRegister(true)
      else setShowRegister(false)
    }

    if (publicPage === 'clubs') {
      return <ClubLandingPage />
    }

    if (publicPage === 'register' || showRegister) {
      const returnTo = new URLSearchParams(window.location.search).get('returnTo')
      return <RegisterScreen onBack={() => navigateTo('landing', '/')} returnTo={returnTo} onSuccess={async (pa) => {
        if (returnTo) {
          window.location.href = returnTo
          return
        }
        setPlayer(pa as any)
        setAuthUserId(pa.user_id || null)
        setIsAuthenticated(true)
        window.history.pushState({}, '', '/')
        setPublicPage('landing')
        fetchPlayerClubs(pa.id).then(ids => setPlayer(prev => prev ? { ...prev, club_ids: ids } as any : prev))
        preloadAllPlayerData()
        if (pa.user_id) {
          const data = await fetchPlayerDashboardData(pa.user_id, { id: pa.id, name: pa.name, phone_number: pa.phone_number })
          setDashboardData(data)
        }
      }} />
    }

    if (publicPage === 'login') {
      const loginIntent = new URLSearchParams(window.location.search).get('intent')?.toLowerCase()
      const registerPath = (loginIntent === 'full' || loginIntent === 'padel' || loginIntent === 'player')
        ? '/register?mode=full'
        : '/register'
      return <LoginScreen 
        phone={phone}
        setPhone={setPhone}
        password={password}
        setPassword={setPassword}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        error={authError}
        isLoading={isAuthLoading}
        onLogin={handleLogin}
        onRegister={() => navigateTo('register', registerPath)}
      />
    }

    return <PlayerLandingPage
      onLogin={() => navigateTo('login', '/login')}
      onRegister={() => navigateTo('register', '/register')}
    />
  }

  const displayName = effectiveDashboard?.playerName || player?.name?.split(' ')[0] || t.common.player

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-light safe-area-top">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/icon.png" 
              alt="Padel One" 
              className="w-10 h-10 rounded-xl shadow-sm"
            />
            <div>
              <p className="text-xs text-gray-500">{t.common.hello},</p>
              <p className="font-semibold text-gray-900">{displayName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
              <Search className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setMenuOpen(true)}
              className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Menu Mobile - overlay */}
      {menuOpen && (
        <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setMenuOpen(false)}>
          <div 
            className="absolute top-0 right-0 h-full w-[min(320px,85vw)] bg-white shadow-xl animate-fade-in safe-area-top"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-bold text-gray-900">{t.common.menu}</h2>
              <button onClick={() => setMenuOpen(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="p-2 overflow-y-auto max-h-[calc(100vh-60px)]">
              <button onClick={() => { setCurrentScreen('profile-edit'); setMenuOpen(false) }} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left">
                <Settings className="w-5 h-5 text-gray-500" />
                <span className="font-medium text-gray-900">{t.menu.settings}</span>
              </button>
              <div className="w-full">
                <button
                  onClick={() => setLanguageDropdownOpen(!languageDropdownOpen)}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-gray-50 text-left"
                >
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-gray-500" />
                    <span className="font-medium text-gray-900">{t.menu.language}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{languageFlags[language]}</span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${languageDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {languageDropdownOpen && (
                  <div className="px-3 pb-2 space-y-1 animate-fade-in">
                    {(['pt', 'en', 'es', 'fr'] as const).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => {
                          setLanguage(lang)
                          setLanguageDropdownOpen(false)
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                          language === lang
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-lg">{languageFlags[lang]}</span>
                        <span>{languageNames[lang]}</span>
                        {language === lang && (
                          <CheckCircle className="w-4 h-4 ml-auto text-blue-600" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => { setShowChangePassword(true); setMenuOpen(false) }} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left">
                <KeyRound className="w-5 h-5 text-gray-500" />
                <span className="font-medium text-gray-900">{t.menu.changePassword}</span>
              </button>
              <button 
                onClick={async () => {
                  if (!pushSupported) {
                    alert(t.menu.notificationsNotSupported)
                    return
                  }
                  await handleTogglePush()
                  setMenuOpen(false)
                }} 
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left"
                disabled={pushLoading}
              >
                <Bell className={`w-5 h-5 ${pushSubscribed ? 'text-green-500' : 'text-gray-500'}`} />
                <div className="flex-1">
                  <span className="font-medium text-gray-900">
                    {pushLoading ? t.menu.notificationsLoading : pushSubscribed ? t.menu.deactivateNotifications : t.menu.activateNotifications}
                  </span>
                  {pushSubscribed && (
                    <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">{t.menu.notificationsActive}</span>
                  )}
                  {!pushSupported && (
                    <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">{t.menu.notificationsNotSupportedBadge}</span>
                  )}
                </div>
              </button>
              <div className="border-t my-2" />
              <a href="https://padel1.app/help" target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left">
                <HelpCircle className="w-5 h-5 text-red-500" />
                <span className="font-medium text-gray-900">{t.help.helpCenter}</span>
                <ExternalLink className="w-3.5 h-3.5 text-gray-400 ml-auto" />
              </a>
              <button onClick={() => { setShowInfoModal('help'); setMenuOpen(false) }} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left">
                <HelpCircle className="w-5 h-5 text-gray-500" />
                <span className="font-medium text-gray-900">{t.common.help}</span>
              </button>
              <button onClick={() => { setShowInfoModal('privacy'); setMenuOpen(false) }} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left">
                <Shield className="w-5 h-5 text-gray-500" />
                <span className="font-medium text-gray-900">{t.menu.privacy}</span>
              </button>
              <button onClick={() => { setMenuOpen(false); setCurrentScreen('payments') }} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left">
                <CreditCard className="w-5 h-5 text-gray-500" />
                <span className="font-medium text-gray-900">{t.menu.payments}</span>
              </button>
              <div className="border-t my-2" />
              <button onClick={() => { handleLogout(); setMenuOpen(false) }} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-50 text-left text-red-600">
                <LogOut className="w-5 h-5" />
                <span className="font-medium">{t.menu.logout}</span>
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Modal: Mudar Password */}
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}

      {/* Modal: Informações (Ajuda, Como funciona, Privacidade) */}
      {showInfoModal && <InfoModal type={showInfoModal} onClose={() => setShowInfoModal(null)} />}

      {/* Main Content */}
      <main className="px-4 py-4">
        {currentScreen === 'home' && (
          <HomeScreen
            player={player}
            dashboardData={effectiveDashboard}
            userId={authUserId || player?.user_id || null}
            onRefresh={refreshDashboard}
            onOpenClub={() => setCurrentScreen('club')}
            onOpenCompete={() => setCurrentScreen('compete')}
            onOpenLearn={() => setCurrentScreen('learn')}
            onOpenGames={(tab?: 'upcoming' | 'history') => {
              if (tab) setGamesInitialTab(tab)
              setCurrentScreen('games')
            }}
            onOpenFollowsList={(uid: string) => { setFollowsListUserId(uid); setCurrentScreen('follows-list') }}
            onOpenPlayerProfile={(uid: string, opts) => openPlayerProfile(uid, opts)}
            onOpenFindGame={() => setCurrentScreen('find-game')}
            onOpenRewards={() => setCurrentScreen('rewards')}
            onOpenBooking={() => setCurrentScreen('booking')}
            onOpenTournamentDetail={(id: string) => { setPendingTournamentId(id); setCurrentScreen('compete') }}
            onSaveFavoriteClub={handleSaveFavoriteClub}
            onToggleClub={async (clubId, add) => {
              if (!player?.id) return
              const updated = await togglePlayerClub(player.id, clubId, add)
              setPlayer(prev => prev ? { ...prev, club_ids: updated } as any : prev)
              if (add && !player.favorite_club_id) {
                await handleSaveFavoriteClub(clubId)
              } else if (!add && player.favorite_club_id === clubId) {
                await handleSaveFavoriteClub(updated.length > 0 ? updated[0] : null)
              }
            }}
            onOpenClubsList={() => setCurrentScreen('clubs-list')}
            onOpenClubDetail={(clubId: string) => { setSelectedClubId(clubId); setCurrentScreen('club-detail') }}
            onOpenRankings={() => setCurrentScreen('rankings')}
            onOpenGameResults={() => setCurrentScreen('game-results')}
            isLiteMode={isLiteMode}
            canBook={canBook}
            canFindGame={canFindGame}
            canLearn={canLearn}
            canRewards={canRewards}
          />
        )}
        {currentScreen === 'rankings' && (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <RankingsScreen
              userId={player?.user_id ?? null}
              playerAccountId={player?.id ?? null}
              onBack={() => setCurrentScreen('home')}
              onOpenPlayerProfile={(uid: string, opts) => openPlayerProfile(uid, opts)}
            />
          </Suspense>
        )}
        {currentScreen === 'booking' && canBook && (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <BookingScreen
              player={player}
              userId={player?.user_id ?? null}
              onBack={() => setCurrentScreen('home')}
              onOpenPlayerProfile={(uid: string, opts) => openPlayerProfile(uid, opts)}
              onRefresh={refreshDashboard}
            />
          </Suspense>
        )}
        {currentScreen === 'games' && (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <GamesScreen
              player={player}
              dashboardData={effectiveDashboard}
              onRefresh={refreshDashboard}
              onBack={() => setCurrentScreen('home')}
              onOpenPlayerProfile={(uid: string, opts) => openPlayerProfile(uid, opts)}
              onOpenFindGame={() => setCurrentScreen('find-game')}
              onOpenGameResults={() => setCurrentScreen('game-results')}
              initialTab={gamesInitialTab}
              isLiteMode={isLiteMode}
              canFindGame={canFindGame}
            />
          </Suspense>
        )}
        {currentScreen === 'club' && (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <ClubScreen
              favoriteClubId={player?.favorite_club_id ?? null}
              onBack={() => setCurrentScreen('home')}
            />
          </Suspense>
        )}
        {currentScreen === 'compete' && (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <CompeteScreen
              dashboardData={effectiveDashboard}
              favoriteClubId={player?.favorite_club_id ?? null}
              clubIds={player?.club_ids ?? []}
              userId={authUserId || player?.user_id || null}
              playerAccountId={player?.id ?? null}
              player={player}
              onBack={() => setCurrentScreen('home')}
              initialTournamentId={pendingTournamentId}
              onInitialTournamentConsumed={() => setPendingTournamentId(null)}
              onOpenCommunityGroupChat={
                player?.user_id
                  ? (groupId: string) => {
                      setSelectedGroupId(groupId)
                      setCurrentScreen('group-detail')
                    }
                  : undefined
              }
              onOpenPlayerProfile={(uid: string, opts) => openPlayerProfile(uid, opts)}
            />
          </Suspense>
        )}
        {currentScreen === 'learn' && canLearn && (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <LearnScreen
              userId={player?.user_id ?? null}
              playerAccountId={player?.id ?? null}
              onBack={() => setCurrentScreen('home')}
              onOpenPlayerProfile={(uid: string, opts) => openPlayerProfile(uid, opts)}
              onOpenClub={(clubId: string) => { setSelectedClubId(clubId); setCurrentScreen('club-detail') }}
            />
          </Suspense>
        )}
        {currentScreen === 'find-game' && canFindGame && (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <FindGameScreen
              player={player}
              userId={authUserId || player?.user_id || null}
              onBack={() => { const wasGroup = !!createGameForGroupId; setCreateGameForGroupId(null); setCurrentScreen(wasGroup ? 'group-detail' : 'home') }}
              onOpenPlayerProfile={(uid: string, opts) => openPlayerProfile(uid, opts)}
              onRefresh={refreshDashboard}
              groupId={createGameForGroupId}
            />
          </Suspense>
        )}
        {currentScreen === 'game-results' && (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <FindGameScreen
              player={player}
              userId={authUserId || player?.user_id || null}
              onBack={() => setCurrentScreen('home')}
              onOpenPlayerProfile={(uid: string, opts) => openPlayerProfile(uid, opts)}
              onRefresh={refreshDashboard}
              resultsOnly
            />
          </Suspense>
        )}
        {currentScreen === 'clubs-list' && !isLiteMode && (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <ClubsListScreen
              playerClubIds={player?.club_ids ?? []}
              favoriteClubId={player?.favorite_club_id ?? null}
              onBack={() => setCurrentScreen('home')}
              onOpenClubDetail={(clubId: string) => { setSelectedClubId(clubId); setCurrentScreen('club-detail') }}
              onSaveFavoriteClub={handleSaveFavoriteClub}
              onToggleClub={async (clubId, add) => {
                if (!player?.id) return
                const updated = await togglePlayerClub(player.id, clubId, add)
                setPlayer(prev => prev ? { ...prev, club_ids: updated } as any : prev)
                if (add && !player.favorite_club_id) {
                  await handleSaveFavoriteClub(clubId)
                } else if (!add && player.favorite_club_id === clubId) {
                  await handleSaveFavoriteClub(updated.length > 0 ? updated[0] : null)
                }
              }}
            />
          </Suspense>
        )}
        {currentScreen === 'club-detail' && selectedClubId && (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <ClubDetailScreen
              clubId={selectedClubId}
              onBack={() => setCurrentScreen('clubs-list')}
              isSelected={(player?.club_ids ?? []).includes(selectedClubId)}
              isFavorite={player?.favorite_club_id === selectedClubId}
              onToggleClub={async (cId, add) => {
                if (!player?.id) return
                const updated = await togglePlayerClub(player.id, cId, add)
                setPlayer(prev => prev ? { ...prev, club_ids: updated } as any : prev)
                if (add && !player.favorite_club_id) {
                  await handleSaveFavoriteClub(cId)
                } else if (!add && player.favorite_club_id === cId) {
                  await handleSaveFavoriteClub(updated.length > 0 ? updated[0] : null)
                }
              }}
              onSaveFavoriteClub={handleSaveFavoriteClub}
            />
          </Suspense>
        )}
        {currentScreen === 'profile-view' && (
          <ProfileViewScreen
            player={player}
            dashboardData={effectiveDashboard}
            userId={authUserId || player?.user_id || null}
            onOpenGames={(tab?: 'upcoming' | 'history') => {
              if (tab) setGamesInitialTab(tab)
              setCurrentScreen('games')
            }}
            onOpenFollowsList={(uid: string) => { setFollowsListUserId(uid); setCurrentScreen('follows-list') }}
            onOpenPlayerProfile={(uid: string, opts) => openPlayerProfile(uid, opts)}
          />
        )}
        {currentScreen === 'profile-edit' && (
          <ProfileEditScreen
            player={player}
            onSaveProfile={handleSaveProfile}
            onOpenInfo={(type) => setShowInfoModal(type)}
          />
        )}
        {currentScreen === 'rewards' && player && canRewards && (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <RewardsScreen
              player={player}
              onBack={() => setCurrentScreen('home')}
            />
          </Suspense>
        )}

        {currentScreen === 'payments' && player && (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <PaymentsScreen
              player={player}
              userId={authUserId}
              onBack={() => setCurrentScreen('home')}
            />
          </Suspense>
        )}
        {currentScreen === 'community' && player?.user_id && (
          <CommunityScreen userId={player.user_id} playerAccountId={player.id} playerAvatar={player.avatar_url} playerName={player.name} onOpenPlayerProfile={(uid, opts) => openPlayerProfile(uid, opts)} onOpenGroup={(groupId: string) => { setSelectedGroupId(groupId); setCurrentScreen('group-detail') }} />
        )}
        {currentScreen === 'group-detail' && selectedGroupId && player?.user_id && (
          <GroupDetailScreen
            groupId={selectedGroupId}
            userId={player.user_id}
            playerAccountId={player.id}
            playerName={player.name}
            playerAvatar={player.avatar_url}
            playerLevel={player.level}
            onBack={() => setCurrentScreen('community')}
            onOpenPlayerProfile={(uid: string, opts) => openPlayerProfile(uid, opts)}
            onCreateGroupGame={(gId: string) => { setCreateGameForGroupId(gId); setCurrentScreen('find-game') }}
          />
        )}
        {currentScreen === 'player-profile' && selectedPlayerUserId && player?.user_id && (
          <OtherPlayerProfileScreen
            targetUserId={selectedPlayerUserId}
            preferredAccountId={selectedPlayerAccountId}
            preferredName={selectedPlayerNameHint}
            myUserId={player.user_id}
            onBack={() => setCurrentScreen('community')}
            onOpenFollowsList={(uid: string) => { setFollowsListUserId(uid); setCurrentScreen('follows-list') }}
            onOpenPlayerProfile={(uid: string, opts) => openPlayerProfile(uid, opts)}
          />
        )}
        {currentScreen === 'follows-list' && followsListUserId && player?.user_id && (
          <FollowsListScreen
            targetUserId={followsListUserId}
            myUserId={player.user_id}
            onBack={() => setCurrentScreen('player-profile')}
            onOpenPlayerProfile={(uid: string, opts) => openPlayerProfile(uid, opts)}
          />
        )}
      </main>

      {/* Bottom Navigation - 3 items like Playtomic */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom z-50">
        <div className="flex items-center justify-around py-2">
          <NavItem 
            icon={Home} 
            label={t.menu.home} 
            active={currentScreen === 'home'} 
            onClick={() => setCurrentScreen('home')} 
          />
          <NavItem 
            icon={Users} 
            label={t.menu.community} 
            active={currentScreen === 'community'} 
            onClick={() => setCurrentScreen('community')} 
          />
          <NavItem 
            icon={User} 
            label={t.menu.profile} 
            active={currentScreen === 'profile-view'} 
            onClick={() => setCurrentScreen('profile-view')} 
          />
        </div>
      </nav>
    </div>
  )
}

// ==================== COMPONENTS ====================

function NavItem({ icon: Icon, label, active, onClick }: {
  icon: any
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center px-6 py-2 rounded-lg transition-all ${
        active 
          ? 'text-red-600' 
          : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      <Icon className={`w-6 h-6 ${active ? 'stroke-[2.5]' : ''}`} />
      <span className={`text-xs mt-1 ${active ? 'font-semibold' : ''}`}>{label}</span>
    </button>
  )
}

function LoginScreen({ phone, setPhone, password, setPassword, showPassword, setShowPassword, error, isLoading, onLogin, onRegister }: {
  phone: string
  setPhone: (v: string) => void
  password: string
  setPassword: (v: string) => void
  showPassword: boolean
  setShowPassword: (v: boolean) => void
  error: string
  isLoading: boolean
  onLogin: () => void
  onRegister?: () => void
}) {
  const { t, language, setLanguage, languageNames, languageFlags } = useI18n()
  const [langOpen, setLangOpen] = useState(false)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Language selector — top right */}
      <div className="flex justify-end px-4 pt-4">
        <div className="relative">
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-sm"
          >
            <Globe className="w-4 h-4 text-gray-500" />
            <span className="text-lg">{languageFlags[language]}</span>
            <span className="text-gray-700 font-medium">{languageNames[language]}</span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
          </button>
          {langOpen && (
            <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden min-w-[160px]">
              {(Object.keys(languageNames) as Array<keyof typeof languageNames>).map((lang) => (
                <button
                  key={lang}
                  onClick={() => { setLanguage(lang as any); setLangOpen(false) }}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors ${language === lang ? 'bg-red-50 text-red-700 font-semibold' : 'text-gray-700'}`}
                >
                  <span className="text-lg">{languageFlags[lang]}</span>
                  <span>{languageNames[lang]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {/* Logo */}
        <div className="mb-8 animate-fade-in">
          <img 
            src="/icon.png" 
            alt="Padel One" 
            className="w-24 h-24 rounded-3xl shadow-xl"
          />
        </div>

        {/* Title */}
        <div className="text-center mb-10 animate-slide-up">
          <h1 className="text-4xl font-black text-gray-900 mb-2">
            {t.common.appName.split(' ')[0]} <span className="text-red-600">{t.common.appName.split(' ')[1]}</span>
          </h1>
          <p className="text-gray-500">{t.common.appTagline}</p>
        </div>

        {/* Login Form */}
        <div className="w-full max-w-sm space-y-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <div className="relative">
            <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="tel"
              placeholder={t.login.phonePlaceholder}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder={t.login.passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onLogin()}
              className="w-full pl-12 pr-12 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <button
            onClick={onLogin}
            disabled={isLoading || !phone || !password}
            className="w-full py-4 btn-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {t.login.enter}
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>

          <p className="text-center text-gray-500 text-sm">
            {t.login.helpText}
          </p>

          {onRegister && (
            <div className="text-center pt-2">
              <span className="text-gray-500 text-sm">{t.common.stillNoAccount}</span>
              <button onClick={onRegister} className="text-red-600 font-semibold text-sm hover:underline">
                {t.common.createAccount}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="px-6 pb-8">
        <div className="grid grid-cols-3 gap-3">
          <FeatureCard icon={Trophy} label={t.login.tournaments} />
          <FeatureCard icon={Calendar} label={t.login.bookings} />
          <FeatureCard icon={TrendingUp} label={t.login.rankings} />
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ icon: Icon, label }: { icon: any, label: string }) {
  return (
    <div className="card p-3 text-center">
      <Icon className="w-6 h-6 text-red-600 mx-auto mb-1" />
      <p className="text-xs text-gray-600">{label}</p>
    </div>
  )
}


// Helpers de UI (formatDate, cards, etc.) → components/shared/matchUi.tsx
// CompeteScreen, FindGameScreen, GamesScreen → components/screens/ (React.lazy)

// ==================== REWARDS SCREEN ====================
// PaymentsScreen, RewardsScreen e RankingsScreen foram extraídos para
// src/components/screens/ e são carregados sob demanda (React.lazy).

// ==================== HOME SCREEN ====================

function HomeScreen({
  player,
  dashboardData,
  userId,
  onRefresh,
  onOpenClub,
  onOpenCompete,
  onOpenLearn,
  onOpenGames,
  onOpenFollowsList,
  onOpenPlayerProfile,
  onOpenFindGame,
  onOpenRewards,
  onOpenBooking,
  onOpenTournamentDetail,
  onSaveFavoriteClub,
  onToggleClub,
  onOpenClubsList,
  onOpenClubDetail,
  onOpenRankings,
  onOpenGameResults,
  isLiteMode = false,
  canBook = true,
  canFindGame = true,
  canLearn = true,
  canRewards = true,
}: {
  player: PlayerAccount | null
  dashboardData: PlayerDashboardData | null
  userId: string | null
  onRefresh: () => Promise<void>
  onOpenClub: () => void
  onOpenCompete: () => void
  onOpenTournamentDetail: (tournamentId: string) => void
  onOpenLearn: () => void
  onOpenGames: (tab?: 'upcoming' | 'history') => void
  onOpenFollowsList: (userId: string) => void
  onOpenPlayerProfile: (userId: string, opts?: { accountId?: string | null; nameHint?: string | null }) => void
  onOpenFindGame: () => void
  onOpenRewards: () => void
  onOpenBooking: () => void
  onSaveFavoriteClub: (clubId: string | null) => Promise<void>
  onToggleClub: (clubId: string, add: boolean) => Promise<void>
  onOpenClubsList: () => void
  onOpenClubDetail: (clubId: string) => void
  onOpenRankings: () => void
  onOpenGameResults: () => void
  isLiteMode?: boolean
  canBook?: boolean
  canFindGame?: boolean
  canLearn?: boolean
  canRewards?: boolean
}) {
  const { t } = useI18n()
  const [followingCount, setFollowingCount] = useState(0)
  const [followersCount, setFollowersCount] = useState(0)
  const [nearbyFullClubs, setNearbyFullClubs] = useState<NearbyFullClub[]>([])
  const [nearbyClubsDismissed, setNearbyClubsDismissed] = useState(false)
  const [activatingClubId, setActivatingClubId] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    getFollowingCount(userId).then(setFollowingCount)
    getFollowersCount(userId).then(setFollowersCount)
  }, [userId])

  useEffect(() => {
    const lat = (player as any)?.lat
    const lng = (player as any)?.lng
    if (lat == null || lng == null) return
    let active = true
    fetchNearbyFullClubs(Number(lat), Number(lng), 50).then((clubs) => {
      if (!active) return
      const already = new Set(player?.club_ids || [])
      setNearbyFullClubs(clubs.filter((c) => !already.has(c.id)))
    })
    return () => { active = false }
  }, [player?.lat, player?.lng, player?.club_ids])

  const handleActivateNearbyClub = async (clubId: string) => {
    setActivatingClubId(clubId)
    try {
      await onToggleClub(clubId, true)
      setNearbyFullClubs((prev) => prev.filter((c) => c.id !== clubId))
    } finally {
      setActivatingClubId(null)
    }
  }

  const handlePlayerClick = async (playerName: string) => {
    if (!playerName || isLikelyTeamLabel(playerName)) return
    const { findPlayerAccountByName } = await import('./lib/classes')
    const acc = await findPlayerAccountByName(playerName)
    if (acc?.user_id) {
      onOpenPlayerProfile(acc.user_id, { accountId: acc.id, nameHint: playerName })
    }
  }

  // Available open games for player's level
  const [homeOpenGames, setHomeOpenGames] = useState<import('./lib/openGames').OpenGame[]>([])
  const [homeOpenGamesLoading, setHomeOpenGamesLoading] = useState(false)

  useEffect(() => {
    if (!userId || !player?.level || isLiteMode || !canFindGame) return
    let active = true
    const load = async () => {
      setHomeOpenGamesLoading(true)
      try {
        const { fetchOpenGamesForLevel } = await import('./lib/openGames')
        const data = await fetchOpenGamesForLevel(player.level!, userId)
        if (active) setHomeOpenGames(data)
      } catch (err) {
        console.error('[Home] Error fetching open games for level:', err)
      }
      if (active) setHomeOpenGamesLoading(false)
    }
    load()
    return () => { active = false }
  }, [userId, player?.level, isLiteMode, canFindGame])

  const d = dashboardData
  const name = d?.playerName || player?.name?.split(' ')[0] || t.common.player
  const wins = d?.stats.wins ?? player?.wins ?? 0
  const draws = d?.stats?.draws ?? 0
  const points = d?.leagueStandings?.[0]?.points ?? player?.points ?? 0
  const upcomingMatches = d?.upcomingMatches ?? []
  const upcomingTournaments = d?.upcomingTournaments ?? []

  const totalMatches = d?.stats?.totalMatches ?? 0
  const losses = d?.stats?.losses ?? 0
  const winRate = d?.stats?.winRate ?? 0
  const bio = player?.bio || ''
  const truncatedBio = bio.length > 160 ? bio.substring(0, 160) + '...' : bio

  // Reward points - fetch from player_rewards
  const [rewardData, setRewardData] = useState<{ totalPoints: number; tier: string } | null>(null)
  useEffect(() => {
    if (player?.id) {
      import('./lib/openGames').then(({ fetchPlayerRewards, retroactivelyAwardMissingRewards }) => {
        // First, retroactively fix any missing rewards, then fetch updated data
        retroactivelyAwardMissingRewards(player.id)
          .then(() => fetchPlayerRewards(player.id))
          .then(data => setRewardData(data))
          .catch(err => console.error('[Rewards] Error loading rewards:', err))
      })
    }
  }, [player?.id])

  const rewardPoints = rewardData?.totalPoints ?? player?.total_reward_points ?? 0

  const [homePartnerInvites, setHomePartnerInvites] = useState<PartnerInvite[]>([])
  const [homePartnerInvitesLoading, setHomePartnerInvitesLoading] = useState(false)

  const loadHomePartnerInvites = useCallback(async () => {
    if (!player?.id) {
      setHomePartnerInvites([])
      return
    }
    setHomePartnerInvitesLoading(true)
    try {
      const list = await fetchPendingPartnerInvites(player.id)
      setHomePartnerInvites(list)
    } catch {
      setHomePartnerInvites([])
    } finally {
      setHomePartnerInvitesLoading(false)
    }
  }, [player?.id])

  useEffect(() => {
    if (!player?.id) return
    void loadHomePartnerInvites()
    const interval = window.setInterval(() => void loadHomePartnerInvites(), 25000)
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadHomePartnerInvites()
    }
    document.addEventListener('visibilitychange', onVis)
    const rtFilter = userId
      ? `invitee_user_id=eq.${userId}`
      : `invitee_player_account_id=eq.${player.id}`
    const channel = supabase
      .channel(`home-partner-invites-${userId ?? player.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'partner_match_invites',
          filter: rtFilter,
        },
        () => void loadHomePartnerInvites(),
      )
      .subscribe()
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVis)
      void supabase.removeChannel(channel)
    }
  }, [player?.id, userId, loadHomePartnerInvites])

  const handleHomeAcceptPartnerInvite = async (inv: PartnerInvite) => {
    try {
      const result = await acceptPartnerInvite(inv.id)
      await loadHomePartnerInvites()
      await onRefresh()
      alert(
        result?.awaitingConfirmation
          ? `Aceitaste o convite! Aguarda que ${result.requesterName || 'o parceiro'} confirme a inscrição da dupla.`
          : ((t as any).partner?.pairCreatedSuccess || 'Dupla criada e inscrita com sucesso.'),
      )
    } catch (error: any) {
      alert(error?.message || (t as any).partner?.acceptError || 'Não foi possível aceitar o convite.')
    }
  }

  const handleHomeDeclinePartnerInvite = async (inv: PartnerInvite) => {
    try {
      await declinePartnerInvite(inv.id)
      await loadHomePartnerInvites()
      await onRefresh()
    } catch (error: any) {
      alert(error?.message || (t as any).partner?.declineError || 'Não foi possível recusar o convite.')
    }
  }

  const [homeTournamentInvites, setHomeTournamentInvites] = useState<{ tournament_id: string; status: string; tournament_name?: string; tournament_start_date?: string; tournament_image_url?: string | null }[]>([])
  const [homeTournamentInvitesLoading, setHomeTournamentInvitesLoading] = useState(false)

  useEffect(() => {
    if (!player?.id) return
    let active = true
    setHomeTournamentInvitesLoading(true)
    fetchMyTournamentInvites(player.id).then(list => {
      if (active) {
        setHomeTournamentInvites(list.filter(i => i.status === 'pending'))
        setHomeTournamentInvitesLoading(false)
      }
    }).catch(() => {
      if (active) setHomeTournamentInvitesLoading(false)
    })
    return () => { active = false }
  }, [player?.id])

  const handleTournamentInviteDecline = async (tournamentId: string) => {
    if (!player?.id) return
    await updateTournamentInviteStatus(player.id, tournamentId, 'declined')
    setHomeTournamentInvites(prev => prev.filter(i => i.tournament_id !== tournamentId))
  }

  // Determinar nível de reward
  const getRewardTier = (pts: number) => {
    if (pts >= 1000) return { name: 'Diamond', emoji: '💎', bgColor: 'bg-gradient-to-br from-cyan-50 to-cyan-100', textColor: 'text-cyan-700' }
    if (pts >= 500) return { name: 'Platinum', emoji: '🏅', bgColor: 'bg-gradient-to-br from-purple-50 to-purple-100', textColor: 'text-purple-700' }
    if (pts >= 200) return { name: 'Gold', emoji: '🥇', bgColor: 'bg-gradient-to-br from-yellow-50 to-amber-100', textColor: 'text-amber-700' }
    return { name: 'Silver', emoji: '🥈', bgColor: 'bg-gradient-to-br from-gray-100 to-gray-200', textColor: 'text-gray-700' }
  }

  const rewardTier = getRewardTier(rewardPoints)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Clubes Full perto (raio 50 km) */}
      {!nearbyClubsDismissed && nearbyFullClubs.length > 0 && (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-sm font-bold text-gray-900">Clubes perto de ti</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Encontrámos {nearbyFullClubs.length} clube{nearbyFullClubs.length > 1 ? 's' : ''} com reservas a menos de 50 km.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNearbyClubsDismissed(true)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Fechar
            </button>
          </div>
          <div className="space-y-2">
            {nearbyFullClubs.slice(0, 5).map((club) => (
              <div
                key={club.id}
                className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                  {club.logo_url ? (
                    <img src={club.logo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <Building2 className="w-5 h-5" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{club.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {club.distance_km} km{club.city ? ` · ${club.city}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={activatingClubId === club.id}
                  onClick={() => handleActivateNearbyClub(club.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {activatingClubId === club.id ? '...' : 'Activar'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
        {canBook && !isLiteMode && <ActionButton icon={Calendar} label={t.home.book} color="lime" onClick={onOpenBooking} />}
        {!isLiteMode && <ActionButton icon={Building2} label="Clubes" color="blue" onClick={onOpenClubsList} />}
        <ActionButton icon={TrendingUp} label={t.home.rankings} color="rose" onClick={onOpenRankings} />
        <ActionButton icon={Trophy} label={t.home.tournaments} color="amber" onClick={onOpenCompete} />
        {isLiteMode || !canFindGame ? (
          <ActionButton icon={Target} label={t.common.quickResult} color="emerald" emoji="📊" onClick={onOpenGameResults} />
        ) : (
          <>
            <ActionButton icon={Gamepad2} label={t.home.findGame} color="purple" emoji="🎾" onClick={onOpenFindGame} />
            <ActionButton icon={GraduationCap} label={t.home.learn} color="emerald" onClick={onOpenLearn} />
          </>
        )}
      </div>

      {/* Profile Card - Foto + Nome + Bio */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            {player?.avatar_url ? (
              <img
                src={player.avatar_url}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover border-4 border-red-100"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-padel flex items-center justify-center">
                <span className="text-white font-bold text-2xl">
                  {player?.name?.charAt(0)?.toUpperCase() || 'P'}
                </span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-xl text-gray-900">{player?.name || name || t.common.player}</h2>
            {truncatedBio && (
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">{truncatedBio}</p>
            )}
          </div>
        </div>
      </div>

      {/* Nível + Fiabilidade + Categoria */}
      {(() => {
        const colors = levelColors(player?.level)
        const hasGradient = colors && colors.hex !== '#e5e7eb'
        const bgStyle = hasGradient 
          ? { background: `linear-gradient(135deg, ${colors.hex} 0%, ${colors.hexTo} 100%)` }
          : {}

        return (
          <div 
            className={`rounded-xl shadow-sm overflow-hidden p-6 ${!hasGradient ? 'bg-gradient-to-br from-red-50 to-red-100' : ''}`}
            style={bgStyle}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className={`text-5xl font-bold ${hasGradient ? 'text-white' : 'text-red-600'}`}>
                  {t.home.level} {player?.level?.toFixed(2) || '3.00'}
                </p>
                <p className={`text-sm mt-2 flex items-center gap-1.5 ${hasGradient ? 'text-white/90' : 'text-gray-600'}`}>
                  <span>📊</span> {t.home.reliability} {player?.level_reliability_percent?.toFixed(0) ?? '85'}%
                </p>
              </div>
            </div>
          </div>
        )
      })()}

      {(isLiteMode || !canFindGame) && (
        <button
          onClick={onOpenGameResults}
          className="w-full p-4 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md hover:shadow-lg transition-shadow text-left"
        >
          <p className="font-bold text-base flex items-center gap-2">
            <span>📊</span> {t.common.quickResultTitle}
          </p>
          <p className="text-sm text-white/90 mt-1">{t.common.quickResultDesc}</p>
        </button>
      )}

      {/* Estatísticas - Jogos, Vitórias, %, Derrotas, Seguidores */}
      <div className="grid grid-cols-5 gap-2">
        <div className="card p-3 text-center">
          <p className="text-lg mb-0.5">🎾</p>
          <p className="text-xl font-bold text-gray-900">{totalMatches}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Jogos</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg mb-0.5">🏆</p>
          <p className="text-xl font-bold text-green-600">{wins}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Vitórias</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg mb-0.5">📊</p>
          <p className="text-xl font-bold text-blue-600">{winRate}%</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Vitórias %</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg mb-0.5">📉</p>
          <p className="text-xl font-bold text-red-600">{losses}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Derrotas</p>
        </div>
        <div className="card p-3 text-center cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => userId && onOpenFollowsList(userId)}>
          <p className="text-lg mb-0.5">❤️</p>
          <p className="text-xl font-bold text-red-600">{followersCount}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Seguidores</p>
        </div>
      </div>

      {/* Pontos Reward + Medalhas */}
      {canRewards && (!isLiteMode || !canBook) && (
      <div className={`rounded-xl shadow-sm overflow-hidden p-5 ${rewardTier.bgColor} cursor-pointer hover:shadow-md transition-shadow`} onClick={onOpenRewards}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm font-medium mb-1 flex items-center gap-1.5 ${rewardTier.textColor}`}>
              <span className="text-lg">{rewardTier.emoji}</span> {t.home.rewardPoints} · {rewardTier.name}
            </p>
            <p className={`text-4xl font-bold ${rewardTier.textColor}`}>{rewardPoints}</p>
          </div>
          <div className="flex items-center gap-2">
            {wins >= 50 && <span className="text-3xl" title="50+ Vitórias">🏆</span>}
            {wins >= 100 && <span className="text-3xl" title="100+ Vitórias">🥇</span>}
            {totalMatches >= 100 && <span className="text-3xl" title="100+ Jogos">⭐</span>}
            {wins < 50 && totalMatches < 100 && <span className="text-2xl opacity-30">🏅</span>}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onOpenRewards() }}
          className={`mt-3 w-full py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all
            ${rewardTier.textColor === 'text-cyan-700' ? 'bg-cyan-600 text-white hover:bg-cyan-700' :
              rewardTier.textColor === 'text-purple-700' ? 'bg-purple-600 text-white hover:bg-purple-700' :
              rewardTier.textColor === 'text-amber-700' ? 'bg-amber-600 text-white hover:bg-amber-700' :
              'bg-gray-600 text-white hover:bg-gray-700'}`}
        >
          🎁 {t.home.spendPoints}
        </button>
      </div>
      )}

      {/* Próximos Jogos – lista horizontal ao estilo Playtomic */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>📅</span> {t.home.upcomingGames}
          </h2>
          <button onClick={() => onOpenGames('upcoming')} className="text-red-600 text-sm font-medium flex items-center gap-1">
            {t.home.viewAll} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {upcomingMatches.length > 0 ? (
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth games-horizontal-scroll">
            <div className="flex gap-4" style={{ width: 'max-content' }}>
              {upcomingMatches.map((match) => (
                <div key={match.id} className="snap-center">
                  {match.is_open_game && match.open_game_id ? (
                    <OpenGameCard
                      gameId={match.open_game_id}
                      match={match}
                      userId={player?.user_id}
                      playerAccountId={player?.id}
                      onRefresh={onRefresh}
                    />
                  ) : (
                    <GameCardPlaytomic 
                      match={match} 
                      currentPlayerAvatar={player?.avatar_url} 
                      currentPlayerName={player?.name}
                      onPlayerClick={handlePlayerClick}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card p-6 text-center">
            <span className="text-4xl mb-2 block">🎾</span>
            <p className="text-gray-700 font-medium">{t.home.noGamesScheduled}</p>
            <p className="text-sm text-gray-500 mt-1">{t.home.enrollTournament}</p>
          </div>
        )}
      </div>

      {/* Jogos Abertos — jogos disponíveis para o nível do jogador */}
      {canFindGame && !isLiteMode && (homeOpenGames.length > 0 || homeOpenGamesLoading) && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>🎾</span> Jogos Abertos
            </h2>
            <button onClick={onOpenFindGame} className="text-red-600 text-sm font-medium flex items-center gap-1">
              {t.home.viewAll} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {homeOpenGamesLoading ? (
            <div className="card p-6 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">A carregar jogos...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {homeOpenGames.slice(0, 5).map((game) => {
                const confirmedPlayers = game.players.filter(p => p.status === 'confirmed')
                const spotsLeft = game.max_players - confirmedPlayers.length
                const gameDate = new Date(game.scheduled_at)
                const days = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
                const dateLabel = `${days[gameDate.getDay()]}, ${gameDate.getDate()}/${(gameDate.getMonth() + 1).toString().padStart(2, '0')} · ${String(gameDate.getHours()).padStart(2, '0')}:${String(gameDate.getMinutes()).padStart(2, '0')}`

                return (
                  <div key={game.id} className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                    <div className="p-4">
                      {/* Club info */}
                      <div className="flex items-center gap-2 mb-2">
                        {game.club_logo_url ? (
                          <img src={game.club_logo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-sm">🏟️</div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{game.club_name}</p>
                          {game.club_city && <p className="text-[11px] text-gray-500 truncate">{game.club_city}</p>}
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${spotsLeft <= 1 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {spotsLeft} {spotsLeft === 1 ? 'lugar' : 'lugares'}
                        </span>
                      </div>

                      {/* Date & Time */}
                      <p className="font-bold text-gray-900 text-sm mb-1">{dateLabel}</p>

                      {/* Tags */}
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3 flex-wrap">
                        <span className="flex items-center gap-1">
                          {game.game_type === 'competitive' ? '🏆' : '🤝'} {game.game_type === 'competitive' ? 'Competitivo' : 'Amigável'}
                        </span>
                        <span className="flex items-center gap-1">📊 {game.level_min.toFixed(1)}-{game.level_max.toFixed(1)}</span>
                        <span className="flex items-center gap-1">⏱️ {game.duration_minutes}min</span>
                        {game.court_name && (
                          <span className="flex items-center gap-1">
                            🏟️ {game.court_name}
                            {game.court_type && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                game.court_type === 'indoor' ? 'bg-blue-100 text-blue-700' :
                                game.court_type === 'outdoor' ? 'bg-amber-100 text-amber-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {game.court_type === 'indoor' ? t.games.indoor : game.court_type === 'outdoor' ? t.games.outdoor : t.games.covered}
                              </span>
                            )}
                          </span>
                        )}
                        {game.price_per_player > 0 && (
                          <span className="flex items-center gap-1">💰 {game.price_per_player.toFixed(2)}€</span>
                        )}
                      </div>

                      {/* Player circles - 2v2 layout */}
                      <div className="flex items-start gap-4 mb-3">
                        {[[1, 2], [3, 4]].map((positions, teamIdx) => (
                          <Fragment key={teamIdx}>
                            {teamIdx === 1 && <div className="w-px h-16 bg-gray-200 self-center" />}
                            <div className="flex gap-3 flex-1 justify-center">
                              {positions.map(position => {
                                const p = confirmedPlayers.find(pl => pl.position === position)
                                if (p) {
                                  const pColors = levelColors(p.level)
                                  return (
                                    <div key={p.id} className="flex flex-col items-center">
                                      <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                                        {p.avatar_url ? (
                                          <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" />
                                        ) : (
                                          <span className="text-lg font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                                        )}
                                      </div>
                                      <span className="text-[10px] text-gray-700 font-medium mt-1 truncate max-w-[60px] text-center">{(p.name || '').split(' ')[0]}</span>
                                      {p.level != null && (
                                        <div className="mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: pColors?.hex || '#9ca3af' }}>
                                          {p.level.toFixed(2)}
                                        </div>
                                      )}
                                    </div>
                                  )
                                }
                                return (
                                  <div key={`empty-${position}`} className="flex flex-col items-center">
                                    <button
                                      className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 hover:border-red-400 hover:bg-red-50 flex items-center justify-center transition-colors"
                                      onClick={async () => {
                                        if (!userId || !player?.id) {
                                          alert('Tens de ter sessão iniciada para entrar num jogo.')
                                          return
                                        }
                                        const { joinOpenGame } = await import('./lib/openGames')
                                        const result = await joinOpenGame({
                                          gameId: game.id,
                                          userId,
                                          playerAccountId: player.id,
                                          playerLevel: player.level || 3.0,
                                          gameLevelMin: game.level_min,
                                          gameLevelMax: game.level_max,
                                          position,
                                        })
                                        if (result.success) {
                                          setHomeOpenGames(prev => prev.filter(g => g.id !== game.id))
                                          onRefresh()
                                        } else {
                                          alert(result.error || 'Erro ao juntar-se ao jogo.')
                                        }
                                      }}
                                    >
                                      <Plus className="w-5 h-5 text-gray-400" />
                                    </button>
                                    <span className="text-[10px] font-medium mt-1 text-blue-600">Livre</span>
                                  </div>
                                )
                              })}
                            </div>
                          </Fragment>
                        ))}
                      </div>
                    </div>

                    {/* Join button - goes to first available position */}
                    <div className="px-4 pb-4">
                      <button
                        onClick={async () => {
                          if (!userId || !player?.id) {
                            alert('Tens de ter sessão iniciada para entrar num jogo.')
                            return
                          }
                          const occupiedPositions = new Set(confirmedPlayers.map(p => p.position).filter(Boolean))
                          let firstAvailable = 1
                          for (let pos = 1; pos <= 4; pos++) {
                            if (!occupiedPositions.has(pos)) { firstAvailable = pos; break }
                          }
                          const { joinOpenGame } = await import('./lib/openGames')
                          const result = await joinOpenGame({
                            gameId: game.id,
                            userId,
                            playerAccountId: player.id,
                            playerLevel: player.level || 3.0,
                            gameLevelMin: game.level_min,
                            gameLevelMax: game.level_max,
                            position: firstAvailable,
                          })
                          if (result.success) {
                            setHomeOpenGames(prev => prev.filter(g => g.id !== game.id))
                            onRefresh()
                          } else {
                            alert(result.error || 'Erro ao juntar-se ao jogo.')
                          }
                        }}
                        className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
                      >
                        🎾 Juntar-me
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Convites de parceiro (torneios) — visível na home para resposta rápida */}
      <div
        className={`card p-4 ${homePartnerInvites.length > 0 ? 'border-2 border-blue-200 bg-blue-50/40' : 'border border-gray-100'}`}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            {t.home.partnerInvites}
          </h2>
          {homePartnerInvites.length > 0 && (
            <span className="shrink-0 bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {homePartnerInvites.length}
            </span>
          )}
        </div>
        {homePartnerInvitesLoading ? (
          <p className="text-sm text-gray-500">{t.home.loadingInvites}</p>
        ) : homePartnerInvites.length === 0 ? (
          <p className="text-sm text-gray-600">{t.home.noPartnerInvites}</p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-600">{t.home.pendingInvitesHint}</p>
            {homePartnerInvites.slice(0, 5).map((inv) => (
              <div key={inv.id} className="rounded-xl border border-blue-100 bg-white/80 p-3">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg flex-shrink-0 overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                    onClick={() => { if (inv.requester_user_id) onOpenPlayerProfile(inv.requester_user_id) }}
                  >
                    {inv.requester_avatar_url ? (
                      <img src={inv.requester_avatar_url} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <span className="text-blue-600 font-bold text-sm">{(inv.requester_name || 'J').charAt(0).toUpperCase()}</span>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">
                      <button
                        type="button"
                        className="font-semibold text-blue-700 hover:underline cursor-pointer"
                        onClick={() => { if (inv.requester_user_id) onOpenPlayerProfile(inv.requester_user_id) }}
                      >{inv.requester_name || 'Jogador'}</button>
                      {' '}{(t as any).partner?.invitedYouTo || 'convidou-te para o torneio'}{' '}
                      <span className="font-semibold">{inv.tournament_name || 'Torneio'}</span>
                      {inv.category_name ? (
                        <span className="text-gray-600"> · {inv.category_name}</span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 ml-[52px]">
                  <button
                    type="button"
                    onClick={() => handleHomeAcceptPartnerInvite(inv)}
                    className="flex-1 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700"
                  >
                    {t.home.accept}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleHomeDeclinePartnerInvite(inv)}
                    className="flex-1 py-2 rounded-lg bg-gray-200 text-gray-800 text-xs font-semibold hover:bg-gray-300"
                  >
                    {t.home.decline}
                  </button>
                </div>
              </div>
            ))}
            {homePartnerInvites.length > 5 && (
              <p className="text-xs text-gray-500 text-center">+{homePartnerInvites.length - 5} mais em Competir</p>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={onOpenCompete}
          className="mt-3 w-full py-2.5 rounded-xl border border-blue-200 text-blue-700 text-sm font-semibold hover:bg-blue-50 transition-colors"
        >
          {t.home.openCompete}
        </button>
      </div>

      {/* Convites de torneio */}
      {homeTournamentInvites.length > 0 && (
        <div className="card p-4 border-2 border-amber-200 bg-amber-50/40">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              🔒 {t.home.tournamentInvites}
            </h2>
            <span className="shrink-0 bg-amber-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {homeTournamentInvites.length}
            </span>
          </div>
          <div className="space-y-3">
            <p className="text-xs text-gray-600">Foste convidado para torneios exclusivos. Vê os detalhes antes de aceitar.</p>
            {homeTournamentInvites.slice(0, 5).map(inv => (
              <div key={inv.tournament_id} className="p-3 bg-white rounded-xl border border-amber-100">
                <div className="flex items-center gap-3">
                  {inv.tournament_image_url ? (
                    <img src={inv.tournament_image_url} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" alt="" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Trophy className="w-7 h-7 text-amber-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{inv.tournament_name || 'Torneio'}</p>
                    {inv.tournament_start_date && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {new Date(inv.tournament_start_date).toLocaleDateString('pt-PT')}
                      </p>
                    )}
                    <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded-full">Convite pendente</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => onOpenTournamentDetail(inv.tournament_id)}
                    className="flex-1 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
                  >
                    Ver detalhes
                  </button>
                  <button
                    onClick={() => handleTournamentInviteDecline(inv.tournament_id)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
                  >
                    {t.home.decline}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Os Meus Torneios */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>🏆</span> {t.home.myTournaments}
          </h2>
          <button onClick={onOpenCompete} className="text-red-600 text-sm font-medium flex items-center gap-1">
            {t.home.viewAll} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          {upcomingTournaments.length > 0 ? (
            upcomingTournaments.slice(0, 3).map((tournament) => (
              <TournamentCard
                key={tournament.id}
                tournament={tournament}
                onClick={() => onOpenTournamentDetail(tournament.id)}
              />
            ))
          ) : (
            <div className="card p-6 text-center">
              <span className="text-4xl mb-2 block">🏆</span>
              <p className="text-gray-700 font-medium">Nenhum torneio em que estejas inscrito</p>
              <p className="text-sm text-gray-500 mt-1">{t.common.enterTourApp}</p>
            </div>
          )}
        </div>
      </div>

      {/* Resultados Recentes – lista horizontal ao estilo Playtomic */}
      {d && d.recentMatches.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>📊</span> {t.home.recentResults}
            </h2>
            <button onClick={() => onOpenGames('history')} className="text-red-600 text-sm font-medium flex items-center gap-1">
              {t.home.viewAll} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth games-horizontal-scroll">
            <div className="flex gap-4" style={{ width: 'max-content' }}>
              {d.recentMatches.map((match) => (
                <div key={match.id} className="snap-center">
                  <GameCardPlaytomic 
                    match={match} 
                    currentPlayerAvatar={player?.avatar_url} 
                    currentPlayerName={player?.name}
                    onPlayerClick={handlePlayerClick}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ---------- Comunidade ----------
function CommunityScreen({ userId, playerAccountId, playerAvatar, playerName, onOpenPlayerProfile, onOpenGroup }: { userId: string; playerAccountId: string; playerAvatar?: string | null; playerName?: string; onOpenPlayerProfile: (userId: string, opts?: { accountId?: string | null; nameHint?: string | null }) => void; onOpenGroup: (groupId: string) => void }) {
  const { t } = useI18n()
  // Feed state
  const [suggestions, setSuggestions] = useState<CommunityPlayer[]>([])
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set())

  // Groups state
  const [myGroups, setMyGroups] = useState<CommunityGroup[]>([])
  const [groupInvites, setGroupInvites] = useState<GroupInvite[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')
  const [newGroupImage, setNewGroupImage] = useState<File | null>(null)
  const [creatingGroup, setCreatingGroup] = useState(false)

  const handlePlayerClick = async (playerNameClicked: string) => {
    if (!playerNameClicked || isLikelyTeamLabel(playerNameClicked)) return
    const { findPlayerAccountByName } = await import('./lib/classes')
    const acc = await findPlayerAccountByName(playerNameClicked)
    if (acc?.user_id) {
      onOpenPlayerProfile(acc.user_id, { accountId: acc.id, nameHint: playerNameClicked })
    }
  }

  // New post modal
  const [showNewPost, setShowNewPost] = useState(false)
  const [newPostText, setNewPostText] = useState('')
  const [newPostImage, setNewPostImage] = useState<File | null>(null)
  const [newPostVideo, setNewPostVideo] = useState<File | null>(null)
  const [postingLoading, setPostingLoading] = useState(false)

  // Global player search
  const [playerSearchQuery, setPlayerSearchQuery] = useState('')
  const [playerSearchResults, setPlayerSearchResults] = useState<CommunityPlayer[]>([])
  const [playerSearching, setPlayerSearching] = useState(false)
  const [showPlayerSearch, setShowPlayerSearch] = useState(false)

  // Load feed + groups data
  useEffect(() => {
    loadFeed()
    loadGroups()
  }, [userId])

  async function loadFeed() {
    setFeedLoading(true)
    try {
      const [suggestedData, unifiedData, ids] = await Promise.all([
        getSuggestedPlayers(userId),
        getUnifiedFeed(userId),
        getFollowingIds(userId),
      ])
      setSuggestions(suggestedData)
      setFeedItems(unifiedData)
      setPosts(unifiedData.filter(i => i.type === 'post').map(i => i.data as CommunityPost))
      setFollowingSet(new Set(ids))
    } catch (err) {
      console.error('[Community] Load feed error:', err)
    }
    setFeedLoading(false)
  }

  async function loadGroups() {
    setGroupsLoading(true)
    try {
      const [groups, invites] = await Promise.all([
        getMyGroups(userId),
        getMyGroupInvites(userId),
      ])
      setMyGroups(groups)
      setGroupInvites(invites)
    } catch (err) {
      console.error('[Community] Load groups error:', err)
    }
    setGroupsLoading(false)
  }

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return
    setCreatingGroup(true)
    let imageUrl: string | undefined
    if (newGroupImage) {
      imageUrl = (await uploadGroupImage(newGroupImage)) || undefined
    }
    const result = await createGroup({ name: newGroupName.trim(), description: newGroupDesc.trim() || undefined, imageUrl })
    if (result.success && result.groupId) {
      setShowCreateGroup(false)
      setNewGroupName('')
      setNewGroupDesc('')
      setNewGroupImage(null)
      await loadGroups()
      onOpenGroup(result.groupId)
    } else {
      alert(result.error || 'Erro ao criar grupo')
    }
    setCreatingGroup(false)
  }

  async function handleRespondInvite(inviteId: string, accept: boolean) {
    const result = await respondToGroupInvite(inviteId, accept)
    if (result.success) {
      setGroupInvites(prev => prev.filter(i => i.id !== inviteId))
      if (accept) loadGroups()
    }
  }

  async function handleFollow(targetUserId: string) {
    const ok = await followUser(userId, targetUserId)
    if (ok) {
      setFollowingSet(prev => new Set([...prev, targetUserId]))
      setSuggestions(prev => prev.filter(s => s.user_id !== targetUserId))
    }
  }

  async function handleUnfollow(targetUserId: string) {
    const ok = await unfollowUser(userId, targetUserId)
    if (ok) {
      setFollowingSet(prev => {
        const next = new Set(prev)
        next.delete(targetUserId)
        return next
      })
    }
  }

  async function handleCreatePost() {
    if (!newPostText.trim() && !newPostImage && !newPostVideo) return
    setPostingLoading(true)
    const ok = await createPost(userId, newPostText, newPostImage || undefined, newPostVideo || undefined)
    if (ok) {
      setNewPostText('')
      setNewPostImage(null)
      setNewPostVideo(null)
      setShowNewPost(false)
      await loadFeed()
    }
    setPostingLoading(false)
  }

  async function handleDeletePost(postId: string) {
    const ok = await deletePost(postId)
    if (ok) {
      setPosts(prev => prev.filter(p => p.id !== postId))
    }
  }

  // Auto-search when typing (debounced)
  useEffect(() => {
    if (playerSearchQuery.trim().length < 2) {
      setPlayerSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setPlayerSearching(true)
      const results = await searchPlayers(playerSearchQuery, [userId])
      const enriched = results.map(p => ({ ...p, is_following: followingSet.has(p.user_id) }))
      setPlayerSearchResults(enriched)
      setPlayerSearching(false)
      setShowPlayerSearch(true)
    }, 400)
    return () => clearTimeout(timer)
  }, [playerSearchQuery])

  async function handleFollowFromSearch(targetUserId: string) {
    const ok = await followUser(userId, targetUserId)
    if (ok) {
      setFollowingSet(prev => new Set([...prev, targetUserId]))
      setPlayerSearchResults(prev => prev.map(p => p.user_id === targetUserId ? { ...p, is_following: true } : p))
      setSuggestions(prev => prev.filter(s => s.user_id !== targetUserId))
    }
  }

  async function handleUnfollowFromSearch(targetUserId: string) {
    const ok = await unfollowUser(userId, targetUserId)
    if (ok) {
      setFollowingSet(prev => { const n = new Set(prev); n.delete(targetUserId); return n })
      setPlayerSearchResults(prev => prev.map(p => p.user_id === targetUserId ? { ...p, is_following: false } : p))
    }
  }

  function timeAgo(dateStr: string): string {
    const now = new Date()
    const d = new Date(dateStr)
    const diffMs = now.getTime() - d.getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'agora'
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d`
    return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="animate-fade-in pb-4">
      {/* Header */}
      <div className="mb-3">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-7 h-7 text-red-600" />
          Comunidade
        </h1>
      </div>

      {/* Search bar */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={playerSearchQuery}
            onChange={e => {
              setPlayerSearchQuery(e.target.value)
              if (e.target.value.trim().length === 0) {
                setPlayerSearchResults([])
                setShowPlayerSearch(false)
              } else {
                setShowPlayerSearch(true)
              }
            }}
            onFocus={() => { if (playerSearchQuery.trim().length >= 2) setShowPlayerSearch(true) }}
            placeholder={t.games.searchPlayers}
            className="w-full pl-9 pr-10 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-colors"
          />
          {playerSearchQuery && (
            <button
              onClick={() => { setPlayerSearchQuery(''); setPlayerSearchResults([]); setShowPlayerSearch(false) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search results dropdown */}
        {showPlayerSearch && (
          <div className="mt-2 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden max-h-80 overflow-y-auto">
            {playerSearching ? (
              <div className="text-center py-6 text-gray-400 text-sm">A pesquisar...</div>
            ) : playerSearchResults.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {playerSearchResults.map(p => {
                  const lvl = p.level
                  const colors = levelColors(p.level)
                  return (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => onOpenPlayerProfile(p.user_id)}>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                        {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" /> : getInitials(p.name)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {lvl && <span className={`text-xs font-black px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>Nv {lvl}</span>}
                          {p.location && <span className="text-xs text-gray-400">{p.location}</span>}
                        </div>
                      </div>
                    </div>
                    {p.is_following ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUnfollowFromSearch(p.user_id) }}
                        className="px-3 py-1.5 text-xs font-semibold border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50 transition-colors"
                      >
                        A seguir
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleFollowFromSearch(p.user_id) }}
                        className="px-3 py-1.5 text-xs font-semibold bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                      >
                        Seguir
                      </button>
                    )}
                  </div>
                  )
                })}
              </div>
            ) : playerSearchQuery.trim().length >= 2 ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-500">Nenhum jogador encontrado</p>
                <p className="text-xs text-gray-400 mt-1">Tenta outro nome</p>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-gray-400">Escreve pelo menos 2 letras para pesquisar</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================== GROUPS ==================== */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-red-600" />
            Meus Grupos
          </h2>
          <button onClick={() => setShowCreateGroup(true)} className="flex items-center gap-1 text-sm font-semibold text-red-600 hover:text-red-700">
            <Plus className="w-4 h-4" /> Criar
          </button>
        </div>

        {/* Group invites */}
        {groupInvites.length > 0 && (
          <div className="mb-3 space-y-2">
            {groupInvites.map(inv => (
              <div key={inv.id} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-lg flex-shrink-0 overflow-hidden">
                    {inv.group_image_url ? <img src={inv.group_image_url} className="w-full h-full rounded-full object-cover" /> : '👥'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{inv.group_name}</p>
                    <p className="text-xs text-gray-500">Convite de {inv.inviter_name}</p>
                  </div>
                </div>
                {inv.group_description && (
                  <p className="text-xs text-gray-600 mt-2 ml-[52px] line-clamp-2">{inv.group_description}</p>
                )}
                <div className="flex gap-2 mt-3 ml-[52px]">
                  <button onClick={() => handleRespondInvite(inv.id, true)} className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg">Aceitar</button>
                  <button onClick={() => handleRespondInvite(inv.id, false)} className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg">Recusar</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Group list */}
        {groupsLoading ? (
          <div className="text-center py-4 text-gray-400 text-sm">{t.common.loading}</div>
        ) : myGroups.length > 0 ? (
          <div className="space-y-2">
            {myGroups.map(group => (
              <div key={group.id} onClick={() => onOpenGroup(group.id)} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-orange-400 flex items-center justify-center text-white text-lg font-bold flex-shrink-0 overflow-hidden">
                  {group.image_url ? <img src={group.image_url} className="w-full h-full object-cover" /> : group.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{group.name}</p>
                    {group.my_role === 'admin' && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold">Admin</span>}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {group.member_count} {group.member_count === 1 ? 'membro' : 'membros'}
                    {group.last_message && <> · {group.last_message.substring(0, 30)}{group.last_message.length > 30 ? '...' : ''}</>}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-gray-50 rounded-xl">
            <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Ainda não tens grupos</p>
            <p className="text-xs text-gray-400 mt-1">Cria um grupo para jogar com os teus amigos</p>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateGroup && createPortal(
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={() => setShowCreateGroup(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Criar Grupo</h3>
                <button onClick={() => setShowCreateGroup(false)} className="p-1 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-gray-500" /></button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do grupo *</label>
                <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Ex: Padel às quintas" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500" maxLength={50} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)} placeholder="Descreve o grupo..." className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" rows={3} maxLength={200} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Foto do grupo</label>
                <input type="file" accept="image/*" onChange={e => setNewGroupImage(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100" />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100">
              <button onClick={handleCreateGroup} disabled={!newGroupName.trim() || creatingGroup} className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white text-sm font-semibold rounded-xl transition-colors">
                {creatingGroup ? 'A criar...' : 'Criar Grupo'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ==================== FEED ==================== */}
      <div>
          {feedLoading ? (
            <div className="text-center py-12 text-gray-400">{t.common.loading}</div>
          ) : (
            <>
              {/* Sugestões de jogadores */}
              {suggestions.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 px-1">{t.learn.suggestedPlayers}</h3>
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {suggestions.map((player, idx) => {
                      const lvl = player.level
                      const colors = levelColors(player.level)
                      return (
                      <div key={`sug-${player.id}-${idx}`} className="flex-shrink-0 w-36 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => onOpenPlayerProfile(player.user_id)}>
                        <div className="w-16 h-16 mx-auto rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-lg mb-2.5 overflow-hidden">
                          {player.avatar_url
                            ? <img src={player.avatar_url} className="w-full h-full object-cover" />
                            : getInitials(player.name)
                          }
                        </div>
                        <p className="text-sm font-semibold text-gray-900 truncate">{player.name}</p>
                        {lvl && (
                          <span className={`inline-block mt-1.5 text-xl font-black px-3 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>Nv {lvl}</span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleFollow(player.user_id) }}
                          className="mt-3 w-full py-1.5 text-xs font-semibold bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                        >
                          Seguir
                        </button>
                      </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Feed unificado (posts + jogos dos seguidos) */}
              {feedItems.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">O teu feed está vazio</p>
                  <p className="text-sm text-gray-400 mt-1">Segue jogadores para ver as suas publicações e jogos aqui.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {feedItems.map(item => {
                    if (item.type === 'post') {
                      const post = item.data as CommunityPost
                      return (
                        <div key={`post-${post.id}`} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                          {/* Post header */}
                          <div className="flex items-center justify-between p-3 pb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-9 h-9 rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-xs overflow-hidden">
                                {post.author_avatar
                                  ? <img src={post.author_avatar} className="w-full h-full object-cover" />
                                  : getInitials(post.author_name)
                                }
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{post.author_name}</p>
                                <p className="text-[11px] text-gray-400">{timeAgo(post.created_at)}</p>
                              </div>
                            </div>
                            {post.user_id === userId && (
                              <button onClick={() => handleDeletePost(post.id)} className="text-gray-300 hover:text-red-500">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          {/* Post content */}
                          {post.content && (
                            <p className="px-3 pb-2 text-sm text-gray-700">{post.content}</p>
                          )}
                          {/* Post image */}
                          {post.image_url && (
                            <img src={post.image_url} alt="" className="w-full max-h-80 object-cover" />
                          )}
                          {/* Post video */}
                          {post.video_url && (
                            <video src={post.video_url} controls className="w-full max-h-80" />
                          )}
                          {/* Post footer */}
                          <div className="px-3 py-2 border-t border-gray-50 flex items-center gap-4">
                            <button className="flex items-center gap-1 text-gray-400 hover:text-red-500 transition-colors">
                              <Heart className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )
                    } else {
                      // Match card do jogador seguido – usa layout GameCardPlaytomic
                      const match = item.data as FeedMatchItem
                      // Converter FeedMatchItem para PlayerMatchForCard
                      const matchForCard: PlayerMatchForCard = {
                        id: match.id,
                        tournament_id: match.tournament_id,
                        tournament_name: match.tournament_name,
                        court: match.court,
                        start_time: match.start_time || match.played_at,
                        team1_name: match.team1_name,
                        team2_name: match.team2_name,
                        player1_name: match.player1_name,
                        player2_name: match.player2_name,
                        player3_name: match.player3_name,
                        player4_name: match.player4_name,
                        player1_avatar: match.player1_avatar,
                        player2_avatar: match.player2_avatar,
                        player3_avatar: match.player3_avatar,
                        player4_avatar: match.player4_avatar,
                        score1: match.score1,
                        score2: match.score2,
                        status: match.status,
                        round: match.round,
                        set1: match.set1,
                        set2: match.set2,
                        set3: match.set3,
                      }

                      return (
                        <div key={`match-${match.id}`} className="space-y-0">
                          {/* Header: quem jogou */}
                          <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-gray-50 to-white rounded-t-2xl border border-b-0 border-gray-100">
                            <div 
                              className="w-9 h-9 rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-[10px] overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => handlePlayerClick(match.followed_player_name)}
                            >
                              {match.followed_player_avatar
                                ? <img src={match.followed_player_avatar} className="w-full h-full object-cover" />
                                : getInitials(match.followed_player_name)
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                <span 
                                  className="cursor-pointer hover:text-red-600 transition-colors"
                                  onClick={() => handlePlayerClick(match.followed_player_name)}
                                >
                                  {match.followed_player_name}
                                </span>
                                <span className={`ml-1.5 text-xs font-bold ${match.followed_player_won ? 'text-green-600' : 'text-red-500'}`}>
                                  {match.followed_player_won ? 'ganhou!' : 'perdeu'}
                                </span>
                              </p>
                              <p className="text-[11px] text-gray-400 flex items-center gap-1">
                                {match.tournament_name ? <><span>🏆</span> {match.tournament_name} · </> : null}
                                {timeAgo(match.played_at)}
                              </p>
                            </div>
                          </div>
                          {/* Card do jogo estilo Playtomic */}
                          <div className="[&>div]:rounded-t-none [&>div]:border-t-0">
                            <GameCardPlaytomic 
                              match={matchForCard} 
                              fullWidth 
                              currentPlayerAvatar={playerAvatar}
                              currentPlayerName={playerName}
                              onPlayerClick={handlePlayerClick}
                            />
                          </div>
                        </div>
                      )
                    }
                  })}
                </div>
              )}
            </>
          )}

          {/* Floating + button */}
          <button
            onClick={() => setShowNewPost(true)}
            className="fixed bottom-20 right-4 w-14 h-14 bg-red-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-red-700 transition-colors z-40"
          >
            <Plus className="w-7 h-7" />
          </button>

          {/* New Post Modal */}
          {showNewPost && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center animate-fade-in">
              <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Nova Publicação</h3>
                  <button onClick={() => { setShowNewPost(false); setNewPostText(''); setNewPostImage(null); setNewPostVideo(null) }}>
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                <textarea
                  value={newPostText}
                  onChange={e => setNewPostText(e.target.value)}
                  placeholder="O que queres partilhar?"
                  rows={4}
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
                <div className="flex items-center gap-3 mt-3">
                  <label className="flex items-center gap-1 text-sm text-gray-500 cursor-pointer hover:text-red-600">
                    <Image className="w-5 h-5" />
                    <span>Foto</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) { setNewPostImage(e.target.files[0]); setNewPostVideo(null) } }} />
                  </label>
                  <label className="flex items-center gap-1 text-sm text-gray-500 cursor-pointer hover:text-red-600">
                    <Video className="w-5 h-5" />
                    <span>Vídeo</span>
                    <input type="file" accept="video/*" className="hidden" onChange={e => { if (e.target.files?.[0]) { setNewPostVideo(e.target.files[0]); setNewPostImage(null) } }} />
                  </label>
                </div>
                {newPostImage && (
                  <div className="mt-2 relative">
                    <img src={URL.createObjectURL(newPostImage)} className="w-full h-40 object-cover rounded-lg" />
                    <button onClick={() => setNewPostImage(null)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"><X className="w-3 h-3" /></button>
                  </div>
                )}
                {newPostVideo && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                    <Video className="w-4 h-4" />
                    <span className="truncate">{newPostVideo.name}</span>
                    <button onClick={() => setNewPostVideo(null)} className="text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                )}
                <button
                  onClick={handleCreatePost}
                  disabled={postingLoading || (!newPostText.trim() && !newPostImage && !newPostVideo)}
                  className="mt-4 w-full py-2.5 bg-red-600 text-white rounded-xl font-semibold disabled:opacity-40 hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  {postingLoading ? 'A publicar...' : <><Send className="w-4 h-4" /> Publicar</>}
                </button>
              </div>
            </div>
          )}
        </div>
    </div>
  )
}

// ClubsListScreen e ClubDetailScreen extraídos para src/components/screens/ (React.lazy).


// Helpers de UI (formatDate, cards, etc.) → components/shared/matchUi.tsx
// CompeteScreen, FindGameScreen, GamesScreen → components/screens/ (React.lazy)

// ---------- Group Detail Screen ----------
const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '🏆', '👏']

function GroupDetailScreen({
  groupId, userId, playerAccountId, playerName, playerAvatar, playerLevel,
  onBack, onOpenPlayerProfile, onCreateGroupGame,
}: {
  groupId: string
  userId: string
  playerAccountId: string
  playerName?: string
  playerAvatar?: string | null
  playerLevel?: number | null
  onBack: () => void
  onOpenPlayerProfile: (uid: string) => void
  onCreateGroupGame: (groupId: string) => void
}) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'chat' | 'members' | 'games'>('chat')
  const [group, setGroup] = useState<CommunityGroup | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Invite members
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteSearchQuery, setInviteSearchQuery] = useState('')
  const [inviteSearchResults, setInviteSearchResults] = useState<CommunityPlayer[]>([])
  const [inviteSearching, setInviteSearching] = useState(false)
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null)

  // Group games
  const [groupGames, setGroupGames] = useState<import('./lib/openGames').OpenGame[]>([])
  const [gamesLoading, setGamesLoading] = useState(false)

  // Settings
  const [showSettings, setShowSettings] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const isAdmin = group?.my_role === 'admin'

  useEffect(() => {
    loadGroupData()
    const unsub = subscribeToGroupChat(groupId, {
      onNewMessage: async (raw) => {
        if (raw.user_id === userId) return
        const { data: pa } = await supabase.from('player_accounts').select('name, avatar_url').eq('user_id', raw.user_id).maybeSingle()
        setMessages(prev => [{ ...raw, author_name: pa?.name || 'Jogador', author_avatar: pa?.avatar_url, reactions: [], reply_preview: null }, ...prev])
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      },
      onDeleteMessage: (id) => {
        if (id) setMessages(prev => prev.filter(m => m.id !== id))
      },
      onNewReaction: (r) => {
        if (!r) return
        setMessages(prev => prev.map(m => {
          if (m.id !== r.message_id) return m
          const existing = (m.reactions || []).find(rg => rg.emoji === r.emoji)
          if (existing) {
            return { ...m, reactions: m.reactions!.map(rg => rg.emoji === r.emoji ? { ...rg, count: rg.count + 1, users: [...rg.users, r.user_id], reacted_by_me: rg.reacted_by_me || r.user_id === userId } : rg) }
          }
          return { ...m, reactions: [...(m.reactions || []), { emoji: r.emoji, count: 1, users: [r.user_id], reacted_by_me: r.user_id === userId }] }
        }))
      },
      onDeleteReaction: (r) => {
        if (!r) return
        setMessages(prev => prev.map(m => {
          if (m.id !== r.message_id) return m
          return { ...m, reactions: (m.reactions || []).map(rg => rg.emoji === r.emoji ? { ...rg, count: rg.count - 1, users: rg.users.filter(u => u !== r.user_id), reacted_by_me: rg.reacted_by_me && r.user_id !== userId } : rg).filter(rg => rg.count > 0) }
        }))
      },
    })
    return unsub
  }, [groupId])

  async function loadGroupData() {
    setChatLoading(true)
    const [groupData, msgs, mems] = await Promise.all([
      getGroupDetails(groupId),
      getMessages({ groupId, limit: 50 }),
      getGroupMembers(groupId),
    ])
    setGroup(groupData)
    setMessages(msgs)
    setMembers(mems)
    if (groupData) { setEditName(groupData.name); setEditDesc(groupData.description || '') }
    setChatLoading(false)
  }

  async function handleSendMessage() {
    const text = messageText.trim()
    if (!text && !imageFile) return
    setSendingMsg(true)
    let imgUrl: string | undefined
    if (imageFile) {
      imgUrl = (await uploadChatImage(imageFile)) || undefined
    }
    const result = await sendMessage({
      groupId,
      content: text || undefined,
      imageUrl: imgUrl,
      replyToId: replyTo?.id,
      messageType: imageFile ? 'image' : 'text',
    })
    if (result.success) {
      const { data: pa } = await supabase.from('player_accounts').select('name, avatar_url').eq('user_id', userId).maybeSingle()
      const newMsg: ChatMessage = {
        id: result.messageId!,
        group_id: groupId,
        user_id: userId,
        content: text || null,
        image_url: imgUrl || null,
        reply_to_message_id: replyTo?.id || null,
        message_type: imageFile ? 'image' : 'text',
        metadata: {},
        created_at: new Date().toISOString(),
        author_name: pa?.name || playerName || 'Eu',
        author_avatar: pa?.avatar_url || playerAvatar || null,
        reply_preview: replyTo ? { content: replyTo.content, author_name: replyTo.author_name || '' } : null,
        reactions: [],
      }
      setMessages(prev => [newMsg, ...prev])
      setMessageText('')
      setReplyTo(null)
      setImageFile(null)
      setImagePreview(null)
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } else {
      console.error('[GroupChat] Send failed:', result.error)
      alert(result.error || 'Erro ao enviar mensagem')
    }
    setSendingMsg(false)
  }

  async function handleReaction(messageId: string, emoji: string) {
    const msg = messages.find(m => m.id === messageId)
    const existingReaction = msg?.reactions?.find(r => r.emoji === emoji && r.reacted_by_me)
    if (existingReaction) {
      await removeReaction(messageId, emoji)
      setMessages(prev => prev.map(m => m.id !== messageId ? m : { ...m, reactions: (m.reactions || []).map(r => r.emoji === emoji ? { ...r, count: r.count - 1, users: r.users.filter(u => u !== userId), reacted_by_me: false } : r).filter(r => r.count > 0) }))
    } else {
      await addReaction(messageId, emoji)
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m
        const ex = (m.reactions || []).find(r => r.emoji === emoji)
        if (ex) return { ...m, reactions: m.reactions!.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, users: [...r.users, userId], reacted_by_me: true } : r) }
        return { ...m, reactions: [...(m.reactions || []), { emoji, count: 1, users: [userId], reacted_by_me: true }] }
      }))
    }
    setShowEmojiPicker(null)
  }

  async function handleDeleteMessage(msgId: string) {
    if (!confirm('Apagar esta mensagem?')) return
    const ok = await deleteMessage(msgId)
    if (ok.success) setMessages(prev => prev.filter(m => m.id !== msgId))
  }

  async function handleRemoveMember(memberId: string, memberUserId: string) {
    if (!confirm('Remover este membro do grupo?')) return
    const ok = await removeGroupMember(groupId, memberUserId)
    if (ok.success) setMembers(prev => prev.filter(m => m.user_id !== memberUserId))
  }

  async function handleLeaveGroup() {
    if (!confirm('Tens a certeza que queres sair deste grupo?')) return
    const ok = await leaveGroup(groupId)
    if (ok.success) onBack()
  }

  async function handleSaveSettings() {
    const result = await updateGroup({ groupId, name: editName.trim(), description: editDesc.trim() })
    if (result.success) {
      setGroup(prev => prev ? { ...prev, name: editName.trim(), description: editDesc.trim() } : prev)
      setShowSettings(false)
    } else {
      alert(result.error || 'Erro ao guardar')
    }
  }

  async function handleDeleteGroup() {
    if (!confirm('Tens a certeza que queres eliminar este grupo? Esta ação é irreversível.')) return
    const ok = await deleteGroup(groupId)
    if (ok.success) onBack()
  }

  // Invite search debounce
  useEffect(() => {
    if (inviteSearchQuery.trim().length < 2) { setInviteSearchResults([]); return }
    const timer = setTimeout(async () => {
      setInviteSearching(true)
      const results = await searchPlayers(inviteSearchQuery, userId)
      const memberUserIds = new Set(members.map(m => m.user_id))
      setInviteSearchResults(results.filter(p => !memberUserIds.has(p.user_id)))
      setInviteSearching(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [inviteSearchQuery])

  async function handleInvite(targetUserId: string) {
    setInvitingUserId(targetUserId)
    const result = await inviteToGroup(groupId, targetUserId)
    if (result.success) {
      setInviteSearchResults(prev => prev.filter(p => p.user_id !== targetUserId))
      // Send system message
      await sendMessage({ groupId, content: `convidou um novo jogador para o grupo`, messageType: 'system' })
    } else {
      alert(result.error || 'Erro ao convidar')
    }
    setInvitingUserId(null)
  }

  // Load group games
  useEffect(() => {
    if (activeTab === 'games') loadGroupGames()
  }, [activeTab])

  async function loadGroupGames() {
    setGamesLoading(true)
    try {
      const { fetchOpenGames } = await import('./lib/openGames')
      const allGames = await fetchOpenGames({})
      setGroupGames(allGames.filter(g => (g as any).group_id === groupId))
    } catch (err) {
      console.error('[GroupDetail] Load games error:', err)
    }
    setGamesLoading(false)
  }

  function handleCreateGroupGame() {
    onCreateGroupGame(groupId)
  }

  // Load members when switching to tab
  useEffect(() => {
    if (activeTab === 'members' && members.length === 0) {
      setMembersLoading(true)
      getGroupMembers(groupId).then(m => { setMembers(m); setMembersLoading(false) })
    }
  }, [activeTab])

  function formatMsgTime(dateStr: string) {
    const d = new Date(dateStr)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  function formatMsgDate(dateStr: string) {
    const d = new Date(dateStr)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) return 'Hoje'
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return 'Ontem'
    return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const groupedMessages = useMemo(() => {
    const reversed = [...messages].reverse()
    const groups: { date: string; messages: ChatMessage[] }[] = []
    let currentDate = ''
    reversed.forEach(msg => {
      const date = formatMsgDate(msg.created_at)
      if (date !== currentDate) {
        currentDate = date
        groups.push({ date, messages: [] })
      }
      groups[groups.length - 1].messages.push(msg)
    })
    return groups
  }, [messages])

  if (chatLoading) {
    return (
      <div className="animate-fade-in flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100dvh - 10rem)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
        <button onClick={onBack} className="p-1 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-orange-400 flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0">
          {group?.image_url ? <img src={group.image_url} className="w-full h-full object-cover" /> : (group?.name || 'G').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-gray-900 truncate">{group?.name}</p>
          <p className="text-xs text-gray-500">{group?.member_count} membros</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-gray-100 rounded-full">
            <Settings className="w-5 h-5 text-gray-500" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {(['chat', 'members', 'games'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${activeTab === tab ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`}>
            {tab === 'chat' ? '💬 Chat' : tab === 'members' ? `👥 Membros` : '🎾 Jogos'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'chat' && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
            {groupedMessages.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-gray-400">Ainda não há mensagens</p>
                <p className="text-xs text-gray-300 mt-1">Sê o primeiro a enviar uma mensagem!</p>
              </div>
            ) : (
              groupedMessages.map((dateGroup, gi) => (
                <div key={gi}>
                  <div className="flex items-center justify-center my-3">
                    <span className="text-[11px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{dateGroup.date}</span>
                  </div>
                  {dateGroup.messages.map(msg => {
                    const isMe = msg.user_id === userId
                    const isSystem = msg.message_type === 'system'

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex items-center justify-center my-2">
                          <span className="text-[11px] text-gray-400 italic">{msg.author_name} {msg.content}</span>
                        </div>
                      )
                    }

                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2 group`}>
                        <div className={`flex gap-2 max-w-[85%] ${isMe ? 'flex-row-reverse' : ''}`}>
                          {!isMe && (
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden mt-auto cursor-pointer" onClick={() => onOpenPlayerProfile(msg.user_id)}>
                              {msg.author_avatar ? <img src={msg.author_avatar} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-gray-600">{(msg.author_name || '?').charAt(0).toUpperCase()}</span>}
                            </div>
                          )}
                          <div>
                            {!isMe && <p className="text-[10px] text-gray-500 font-medium mb-0.5 ml-1">{msg.author_name}</p>}
                            {/* Reply preview */}
                            {msg.reply_preview && (
                              <div className={`text-[11px] px-2 py-1 mb-0.5 rounded-lg border-l-2 ${isMe ? 'bg-red-50 border-red-300 text-red-700' : 'bg-gray-100 border-gray-300 text-gray-600'}`}>
                                <span className="font-semibold">{msg.reply_preview.author_name}</span>
                                <p className="truncate">{msg.reply_preview.content}</p>
                              </div>
                            )}
                            <div
                              className={`px-3 py-2 rounded-2xl relative ${isMe ? 'bg-red-600 text-white rounded-br-md' : 'bg-gray-100 text-gray-900 rounded-bl-md'}`}
                              onContextMenu={e => { e.preventDefault(); setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id) }}
                            >
                              {msg.image_url && (
                                <img src={msg.image_url} alt="" className="max-w-full rounded-lg mb-1 max-h-60 object-cover cursor-pointer" onClick={() => window.open(msg.image_url!, '_blank')} />
                              )}
                              {msg.content && <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>}
                              <p className={`text-[10px] mt-0.5 text-right ${isMe ? 'text-red-200' : 'text-gray-400'}`}>{formatMsgTime(msg.created_at)}</p>
                            </div>
                            {/* Reactions */}
                            {msg.reactions && msg.reactions.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1 ml-1">
                                {msg.reactions.map(r => (
                                  <button key={r.emoji} onClick={() => handleReaction(msg.id, r.emoji)} className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border ${r.reacted_by_me ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'} hover:bg-gray-100 transition-colors`}>
                                    <span>{r.emoji}</span>
                                    <span className="text-[10px] text-gray-600">{r.count}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                            {/* Action buttons on hover/click */}
                            <div className={`flex items-center gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <button onClick={() => setReplyTo(msg)} className="text-[10px] text-gray-400 hover:text-gray-600 px-1">Responder</button>
                              <button onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)} className="text-[10px] text-gray-400 hover:text-gray-600 px-1">Reagir</button>
                              {(isMe || isAdmin) && <button onClick={() => handleDeleteMessage(msg.id)} className="text-[10px] text-red-400 hover:text-red-600 px-1">Apagar</button>}
                            </div>
                            {/* Emoji picker */}
                            {showEmojiPicker === msg.id && (
                              <div className={`flex gap-1 mt-1 bg-white shadow-lg rounded-xl p-1.5 border border-gray-100 ${isMe ? 'justify-end' : ''}`}>
                                {QUICK_EMOJIS.map(emoji => (
                                  <button key={emoji} onClick={() => handleReaction(msg.id, emoji)} className="text-lg hover:scale-125 transition-transform p-0.5">{emoji}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Reply preview bar */}
          {replyTo && (
            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-gray-500 font-semibold">A responder a {replyTo.author_name}</p>
                <p className="text-xs text-gray-400 truncate">{replyTo.content}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-gray-200 rounded-full"><X className="w-4 h-4 text-gray-400" /></button>
            </div>
          )}

          {/* Image preview */}
          {imagePreview && (
            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
              <img src={imagePreview} alt="" className="w-12 h-12 rounded-lg object-cover" />
              <p className="text-xs text-gray-500 flex-1">Imagem selecionada</p>
              <button onClick={() => { setImageFile(null); setImagePreview(null) }} className="p-1 hover:bg-gray-200 rounded-full"><X className="w-4 h-4 text-gray-400" /></button>
            </div>
          )}

          {/* Input area */}
          <div className="px-3 py-2 border-t border-gray-100 bg-white flex items-center gap-2">
            <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={e => {
              const f = e.target.files?.[0]
              if (f) {
                setImageFile(f)
                const reader = new FileReader()
                reader.onload = ev => setImagePreview(ev.target?.result as string)
                reader.readAsDataURL(f)
              }
              e.target.value = ''
            }} />
            <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
              <Camera className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() } }}
              placeholder="Escreve uma mensagem..."
              className="flex-1 px-3 py-2 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <button onClick={handleSendMessage} disabled={sendingMsg || (!messageText.trim() && !imageFile)} className="p-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white rounded-full transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {activeTab === 'members' && (
        <div className="flex-1 overflow-y-auto py-3">
          {isAdmin && (
            <button onClick={() => { setShowInviteModal(true); setInviteSearchQuery(''); setInviteSearchResults([]) }} className="w-full flex items-center gap-3 px-4 py-3 bg-red-50 rounded-xl mb-3 hover:bg-red-100 transition-colors">
              <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center"><Plus className="w-5 h-5 text-white" /></div>
              <span className="text-sm font-semibold text-red-700">Convidar jogadores</span>
            </button>
          )}

          {membersLoading ? (
            <div className="text-center py-6 text-gray-400 text-sm">{t.common.loading}</div>
          ) : (
            <div className="space-y-1">
              {members.map(m => {
                const colors = levelColors(m.level)
                return (
                  <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => onOpenPlayerProfile(m.user_id)}>
                      {m.avatar_url ? <img src={m.avatar_url} className="w-full h-full object-cover" /> : <span className="text-sm font-bold text-gray-600">{m.name.charAt(0).toUpperCase()}</span>}
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onOpenPlayerProfile(m.user_id)}>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{m.name}</p>
                        {m.role === 'admin' && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold">Admin</span>}
                      </div>
                      {m.level != null && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${colors?.bg || 'bg-gray-100'} ${colors?.text || 'text-gray-600'}`}>Nv {m.level.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                    {isAdmin && m.user_id !== userId && (
                      <button onClick={() => handleRemoveMember(m.id, m.user_id)} className="text-xs text-red-500 hover:text-red-700 px-2 py-1">Remover</button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Leave group button */}
          <div className="mt-6 px-4">
            <button onClick={handleLeaveGroup} className="w-full py-2.5 text-sm font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors">
              Sair do grupo
            </button>
          </div>
        </div>
      )}

      {activeTab === 'games' && (
        <div className="flex-1 overflow-y-auto py-3">
          <div className="flex items-center justify-between px-1 py-4 mb-3">
            <p className="text-sm text-gray-500">Jogos abertos deste grupo</p>
            <button onClick={handleCreateGroupGame} className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors">
              <Plus className="w-4 h-4" /> Criar Jogo
            </button>
          </div>

          {gamesLoading ? (
            <div className="text-center py-6 text-gray-400 text-sm">{t.common.loading}</div>
          ) : groupGames.length > 0 ? (
            <div className="space-y-3">
              {groupGames.map(game => {
                const confirmedPlayers = game.players.filter(p => p.status === 'confirmed')
                const spotsLeft = game.max_players - confirmedPlayers.length
                const gameDate = new Date(game.scheduled_at)
                return (
                  <div key={game.id} className="border border-gray-200 rounded-xl p-4 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-gray-900">{gameDate.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })} · {String(gameDate.getHours()).padStart(2, '0')}:{String(gameDate.getMinutes()).padStart(2, '0')}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${spotsLeft <= 1 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {spotsLeft} {spotsLeft === 1 ? 'lugar' : 'lugares'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{game.club_name}</p>
                    <div className="flex gap-2">
                      {confirmedPlayers.map(p => (
                        <div key={p.id} className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                          {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>}
                        </div>
                      ))}
                      {Array.from({ length: spotsLeft }).map((_, i) => (
                        <div key={`empty-${i}`} className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
                          <Plus className="w-4 h-4 text-gray-300" />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">Sem jogos do grupo</p>
            </div>
          )}
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && createPortal(
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={() => setShowInviteModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Convidar Jogadores</h3>
              <button onClick={() => setShowInviteModal(false)} className="p-1 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-4">
              <input type="text" value={inviteSearchQuery} onChange={e => setInviteSearchQuery(e.target.value)} placeholder="Pesquisar jogador..." className="w-full px-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {inviteSearching ? (
                <div className="text-center py-6 text-gray-400 text-sm">A pesquisar...</div>
              ) : inviteSearchResults.length > 0 ? (
                <div className="space-y-2">
                  {inviteSearchResults.map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" /> : <span className="text-sm font-bold text-gray-600">{getInitials(p.name)}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                      </div>
                      <button
                        onClick={() => handleInvite(p.user_id)}
                        disabled={invitingUserId === p.user_id}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        {invitingUserId === p.user_id ? '...' : 'Convidar'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : inviteSearchQuery.trim().length >= 2 ? (
                <div className="text-center py-6 text-sm text-gray-400">Nenhum jogador encontrado</div>
              ) : (
                <div className="text-center py-6 text-sm text-gray-400">Escreve pelo menos 2 letras</div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Settings Modal */}
      {showSettings && createPortal(
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Definições do Grupo</h3>
                <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-gray-500" /></button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500" maxLength={50} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" rows={3} maxLength={200} />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 space-y-3">
              <button onClick={handleSaveSettings} className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors">Guardar</button>
              <button onClick={handleDeleteGroup} className="w-full py-2.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-xl transition-colors">Eliminar grupo</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ---------- Listas de Seguindo/Seguidores ----------
function FollowsListScreen({
  targetUserId,
  myUserId,
  onBack,
  onOpenPlayerProfile,
}: {
  targetUserId: string
  myUserId: string
  onBack: () => void
  onOpenPlayerProfile: (userId: string, opts?: { accountId?: string | null; nameHint?: string | null }) => void
}) {
  const [activeTab, setActiveTab] = useState<'following' | 'followers'>('following')
  const [followingList, setFollowingList] = useState<CommunityPlayer[]>([])
  const [followersList, setFollowersList] = useState<CommunityPlayer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getFollowingList(targetUserId),
      getFollowersList(targetUserId),
    ]).then(([following, followers]) => {
      setFollowingList(following)
      setFollowersList(followers)
      setLoading(false)
    })
  }, [targetUserId])

  const handleToggleFollow = async (userId: string, currentlyFollowing: boolean) => {
    if (currentlyFollowing) {
      await unfollowUser(myUserId, userId)
      // Update both lists
      setFollowingList(prev => prev.filter(p => p.user_id !== userId))
      setFollowersList(prev => prev.map(p => p.user_id === userId ? { ...p, is_following: false } : p))
    } else {
      await followUser(myUserId, userId)
      setFollowersList(prev => prev.map(p => p.user_id === userId ? { ...p, is_following: true } : p))
    }
  }

  const currentList = activeTab === 'following' ? followingList : followersList

  return (
    <div className="animate-fade-in pb-20">
      {/* Header */}
      <div className="mb-4">
        <button onClick={onBack} className="flex items-center gap-1 text-gray-600 hover:text-red-600 transition-colors mb-3">
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Voltar</span>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Seguidores</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('following')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'following' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
        >
          A seguir
        </button>
        <button
          onClick={() => setActiveTab('followers')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'followers' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
        >
          Seguidores
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
        </div>
      ) : currentList.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-500">
            {activeTab === 'following' ? 'Ainda não segue ninguém' : 'Ainda não tem seguidores'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {currentList.map((p) => {
            const colors = levelColors(p.level)
            const lvl = p.level
            return (
              <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-sm overflow-hidden cursor-pointer"
                    onClick={() => onOpenPlayerProfile(p.user_id)}
                  >
                    {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" /> : getInitials(p.name)}
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onOpenPlayerProfile(p.user_id)}>
                    <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {lvl && <span className={`text-xs font-black px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>Nv {lvl}</span>}
                      {p.location && <span className="text-xs text-gray-400">{p.location}</span>}
                    </div>
                  </div>
                  {p.user_id !== myUserId && (
                    <button
                      onClick={() => handleToggleFollow(p.user_id, p.is_following ?? false)}
                      className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        p.is_following
                          ? 'border border-orange-300 text-orange-600 hover:bg-orange-50'
                          : 'bg-orange-500 text-white hover:bg-orange-600'
                      }`}
                    >
                      {p.is_following ? 'Seguindo' : 'Seguir'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------- Perfil de Outro Jogador (a partir da Comunidade) ----------
function OtherPlayerProfileScreen({
  targetUserId,
  preferredAccountId,
  preferredName,
  myUserId,
  onBack,
  onOpenFollowsList,
  onOpenPlayerProfile,
}: {
  targetUserId: string
  preferredAccountId?: string | null
  preferredName?: string | null
  myUserId: string
  onBack: () => void
  onOpenFollowsList: (userId: string) => void
  onOpenPlayerProfile: (userId: string, opts?: { accountId?: string | null; nameHint?: string | null }) => void
}) {
  const { t } = useI18n()
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)
  const [myAvatar, setMyAvatar] = useState<string | null>(null)
  const [myName, setMyName] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getPlayerProfile(targetUserId, myUserId, {
      accountId: preferredAccountId,
      preferredName,
    }).then((p) => {
      setProfile(p)
      setIsFollowing(p?.isFollowedByMe ?? false)
      setLoading(false)
    })
  }, [targetUserId, myUserId, preferredAccountId, preferredName])
  
  // Buscar avatar e nome do utilizador atual
  useEffect(() => {
    if (!myUserId) return
    let active = true
    ;(async () => {
      const { supabase } = await import('./lib/supabase')
      const { data: account } = await supabase
        .from('player_accounts')
        .select('avatar_url, name')
        .eq('user_id', myUserId)
        .maybeSingle()
      if (active && account) {
        setMyAvatar(account.avatar_url || null)
        setMyName(account.name || null)
      }
    })()
    return () => { active = false }
  }, [myUserId])

  const handleToggleFollow = async () => {
    if (!profile) return
    if (isFollowing) {
      await unfollowUser(myUserId, targetUserId)
      setIsFollowing(false)
      setProfile(prev => prev ? { ...prev, followersCount: prev.followersCount - 1 } : prev)
    } else {
      await followUser(myUserId, targetUserId)
      setIsFollowing(true)
      setProfile(prev => prev ? { ...prev, followersCount: prev.followersCount + 1 } : prev)
    }
  }

  const handlePlayerClick = async (playerName: string) => {
    if (!playerName || isLikelyTeamLabel(playerName)) return
    const { findPlayerAccountByName } = await import('./lib/classes')
    const acc = await findPlayerAccountByName(playerName)
    if (acc?.user_id) {
      onOpenPlayerProfile(acc.user_id, { accountId: acc.id, nameHint: playerName })
    }
  }
  
  // Buscar avatares dos top players
  const [topPlayersAvatars, setTopPlayersAvatars] = useState<Record<string, string | null>>({})
  useEffect(() => {
    if (!profile?.topPlayers?.length) return
    let active = true
    ;(async () => {
      const { supabase } = await import('./lib/supabase')
      const avatars: Record<string, string | null> = {}
      for (const { name } of profile.topPlayers) {
        if (isLikelyTeamLabel(name)) continue
        const { data: account } = await supabase
          .from('player_accounts')
          .select('avatar_url')
          .ilike('name', name)
          .maybeSingle()
        if (active && account) {
          avatars[name] = account.avatar_url || null
        }
      }
      if (active) setTopPlayersAvatars(avatars)
    })()
    return () => { active = false }
  }, [profile?.topPlayers?.map(p => p.name).join(',')])

  const getHandLabel = (h?: string) => ({ right: 'Direita', left: 'Esquerda', ambidextrous: 'Ambidestro' }[h || ''] || '—')
  const getPositionLabel = (p?: string) => ({ right: 'Direita', left: 'Esquerda', both: 'Ambas' }[p || ''] || '—')
  const getGameTypeLabel = (g?: string) => ({ competitive: 'Competitivo', friendly: 'Amigável', both: 'Ambos' }[g || ''] || '—')
  const getTimeLabel = (timeStr?: string) => ({ morning: t.common.morning, afternoon: t.common.afternoon, evening: t.common.evening, all_day: t.common.allDay }[timeStr || ''] || '—')

  const splitName = (fullName: string): { firstName: string; lastName: string } => {
    const parts = fullName.trim().split(/\s+/)
    if (parts.length === 1) return { firstName: parts[0], lastName: '' }
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
  }

  const getAgeCategory = (): string | null => {
    const bd = profile?.birth_date
    if (!bd) return null
    const birth = new Date(bd)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    if (age < 18) return null
    const cat = Math.floor(age / 5) * 5
    return `+${cat}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="text-center py-20">
        <button onClick={onBack} className="text-red-600 font-medium mb-4 flex items-center gap-1 mx-auto">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>
        <p className="text-gray-500">Perfil não encontrado</p>
      </div>
    )
  }

  const colors = levelColors(profile.level)
  const lvl = profile.level
  const ageCategory = getAgeCategory()
  const profileWins = profile.wins ?? 0
  const profileDraws = profile.draws ?? 0
  const profileLosses = profile.losses ?? 0
  const totalMatches = profileWins + profileDraws + profileLosses
  const decided = profileWins + profileLosses
  const winRate = decided > 0 ? Math.round((profileWins / decided) * 100) : 0

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      {/* Header com botão voltar */}
      <div className="flex items-center gap-3 mb-1">
        <button onClick={onBack} className="flex items-center gap-1 text-gray-600 hover:text-red-600 transition-colors">
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Comunidade</span>
        </button>
      </div>

      {/* Profile Card */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-4 border-gray-200" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-900 flex items-center justify-center">
                <span className="text-white font-bold text-2xl">{getInitials(profile.name)}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-xl text-gray-900">{profile.name}</h2>
            {profile.location && <p className="text-xs text-gray-500 mt-0.5">{profile.location}</p>}
            {profile.bio && <p className="text-sm text-gray-600 mt-1 leading-relaxed">{profile.bio.length > 160 ? profile.bio.substring(0, 160) + '...' : profile.bio}</p>}
            {/* Follow button */}
            <button
              onClick={handleToggleFollow}
              className={`mt-3 px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${
                isFollowing
                  ? 'border border-orange-300 text-orange-600 hover:bg-orange-50'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              {isFollowing ? 'A seguir' : 'Seguir'}
            </button>
          </div>
        </div>
      </div>

      {/* Nível + Fiabilidade + Categoria + Idade */}
      {(() => {
        const hasGradient = colors && colors.hex !== '#e5e7eb'
        const bgStyle = hasGradient 
          ? { background: `linear-gradient(135deg, ${colors.hex} 0%, ${colors.hexTo} 100%)` }
          : {}
        return (
          <div 
            className={`rounded-xl shadow-sm overflow-hidden p-6 ${!hasGradient ? 'bg-gradient-to-br from-red-50 to-red-100' : ''}`}
            style={bgStyle}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className={`text-5xl font-bold ${hasGradient ? 'text-white' : 'text-red-600'}`}>
                  Nível {profile.level?.toFixed(2) || '3.00'}
                </p>
                <p className={`text-sm mt-2 flex items-center gap-1.5 ${hasGradient ? 'text-white/90' : 'text-gray-600'}`}>
                  <span>📊</span> Fiabilidade {profile.level_reliability_percent?.toFixed(0) ?? '85'}%
                </p>
              </div>
              <div className="flex flex-col gap-2 self-start">
                {ageCategory && (
                  <div className="px-4 py-2 bg-amber-500 rounded-lg shadow-sm">
                    <span className="text-sm font-bold text-white">{ageCategory}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Estatísticas */}
      <div className="grid grid-cols-5 gap-2">
        <div className="card p-3 text-center">
          <p className="text-lg mb-0.5">🎾</p>
          <p className="text-xl font-bold text-gray-900">{totalMatches}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Jogos</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg mb-0.5">🏆</p>
          <p className="text-xl font-bold text-green-600">{profileWins}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Vitórias</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg mb-0.5">📊</p>
          <p className="text-xl font-bold text-blue-600">{winRate}%</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Vitórias %</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg mb-0.5">📉</p>
          <p className="text-xl font-bold text-red-600">{profileLosses}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Derrotas</p>
        </div>
        <div className="card p-3 text-center cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => onOpenFollowsList(targetUserId)}>
          <p className="text-lg mb-0.5">❤️</p>
          <p className="text-xl font-bold text-red-600">{profile.followersCount}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Seguidores</p>
        </div>
      </div>

      {/* Preferências do jogador */}
      <div className="card p-5">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-red-600" />
          Preferências de jogador
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-0.5">Mão dominante</p>
            <p className="font-medium text-gray-900">{getHandLabel(profile.preferred_hand)}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-0.5">Posição no campo</p>
            <p className="font-medium text-gray-900">{getPositionLabel(profile.court_position)}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-0.5">Tipo de jogo</p>
            <p className="font-medium text-gray-900">{getGameTypeLabel(profile.game_type)}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-0.5">Horário preferido</p>
            <p className="font-medium text-gray-900">{getTimeLabel(profile.preferred_time)}</p>
          </div>
        </div>
      </div>

      {/* 5 Últimos Jogos - Cards estilo Playtomic */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <span>📊</span> Resultados Recentes
        </h2>
        {profile.recentMatches.length > 0 ? (
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth">
            <div className="flex gap-4" style={{ width: 'max-content' }}>
              {profile.recentMatches.map((match) => (
                <div key={match.id} className="snap-center">
                  <GameCardPlaytomic
                    match={{
                      id: match.id,
                      tournament_id: match.tournament_id || '',
                      tournament_name: match.tournament_name || '',
                      court: '',
                      start_time: match.played_at || '',
                      team1_name: match.team1_name,
                      team2_name: match.team2_name,
                      player1_name: match.player1_name,
                      player2_name: match.player2_name,
                      player3_name: match.player3_name,
                      player4_name: match.player4_name,
                      score1: match.score1,
                      score2: match.score2,
                      status: 'completed',
                      round: '',
                      is_winner: match.is_winner,
                      set1: match.set1,
                      set2: match.set2,
                      set3: match.set3,
                    }}
                    currentPlayerName={myName || profile.name}
                    currentPlayerAvatar={myAvatar || profile.avatar_url}
                    onPlayerClick={handlePlayerClick}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card p-6 text-center">
            <span className="text-4xl mb-2 block">🎾</span>
            <p className="text-gray-700 font-medium">Sem jogos recentes</p>
          </div>
        )}
      </div>

      {/* Jogadores com quem mais joga */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Users className="w-5 h-5 text-red-600" />
          {t.learn.playersYouPlayWith}
        </h2>
        {profile.topPlayers.filter(({ name }) => !isLikelyTeamLabel(name)).length > 0 ? (
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth">
            <div className="flex gap-3" style={{ width: 'max-content' }}>
              {profile.topPlayers.filter(({ name }) => !isLikelyTeamLabel(name)).map(({ name, count }) => {
                const display = shortPlayerLabel(name)
                return (
                <div 
                  key={name} 
                  className="snap-center flex-shrink-0 w-[100px] card p-3 text-center cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handlePlayerClick(name)}
                >
                  <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center mx-auto mb-2 overflow-hidden">
                    {topPlayersAvatars[name] ? (
                      <img src={topPlayersAvatars[name]!} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-bold text-sm">{getInitials(name)}</span>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900 text-xs leading-tight">{display}</p>
                  <p className="text-[10px] text-gray-500 mt-1">{count} jogos</p>
                </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="card p-4 text-center">
            <p className="text-sm text-gray-500">{t.common.noGameData}</p>
          </div>
        )}
      </div>

      {/* Clube favorito */}
      {profile.favoriteClub && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-red-600" />
            {t.learn.favoriteClub}
          </h2>
          <div className="card overflow-hidden p-0">
            <div className="p-4 flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {profile.favoriteClub.logo_url ? (
                  <img src={profile.favoriteClub.logo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{profile.favoriteClub.name}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Perfil Público (Visualização) - Igual à Home, com 5 últimos jogos, sem Informações do Jogador ----------
function ProfileViewScreen({
  player,
  dashboardData,
  userId,
  onOpenGames,
  onOpenFollowsList,
  onOpenPlayerProfile,
}: {
  player: PlayerAccount | null
  dashboardData: PlayerDashboardData | null
  userId: string | null
  onOpenGames: (tab?: 'upcoming' | 'history') => void
  onOpenFollowsList: (userId: string) => void
  onOpenPlayerProfile: (userId: string, opts?: { accountId?: string | null; nameHint?: string | null }) => void
}) {
  const { t } = useI18n()
  const d = dashboardData
  const totalMatches = d?.stats?.totalMatches ?? 0
  const wins = d?.stats?.wins ?? 0
  const draws = d?.stats?.draws ?? 0
  const losses = d?.stats?.losses ?? 0
  const winRate = d?.stats?.winRate ?? 0
  const bio = player?.bio || ''
  const [followingCount, setFollowingCount] = useState(0)
  const [followersCount, setFollowersCount] = useState(0)
  useEffect(() => {
    if (!userId) return
    getFollowingCount(userId).then(setFollowingCount)
    getFollowersCount(userId).then(setFollowersCount)
  }, [userId])
  const truncatedBio = bio.length > 160 ? bio.substring(0, 160) + '...' : bio
  const recentMatches = (d?.recentMatches ?? []).slice(0, 5)
  const upcomingMatches = (d?.upcomingMatches ?? []).slice(0, 5)

  const handlePlayerClick = async (playerName: string) => {
    if (!playerName || isLikelyTeamLabel(playerName)) return
    const { findPlayerAccountByName } = await import('./lib/classes')
    const acc = await findPlayerAccountByName(playerName)
    if (acc?.user_id) {
      onOpenPlayerProfile(acc.user_id, { accountId: acc.id, nameHint: playerName })
    }
  }

  // Jogadores com quem mais joga (extrair de todos os jogos recentes)
  const allRecentMatches = d?.recentMatches ?? []
  const playerCountMap = new Map<string, number>()
  allRecentMatches.forEach((match) => {
    getOtherPlayersFromMatch(match, player?.name).forEach((name) => {
      if (isLikelyTeamLabel(name)) return
      playerCountMap.set(name, (playerCountMap.get(name) || 0) + 1)
    })
  })
  const topPlayers = Array.from(playerCountMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }))
  
  // Avatares dos top players (do cache global — sem queries adicionais)
  const topPlayersAvatars: Record<string, string | null> = {}
  topPlayers.forEach(({ name }) => {
    const cached = getCachedPlayerData(name)
    if (cached?.avatar_url) topPlayersAvatars[name] = cached.avatar_url
  })

  // Clubes onde joga (favorito + dos torneios)
  const [clubsWherePlays, setClubsWherePlays] = useState<ClubDetail[]>([])
  useEffect(() => {
    let active = true
    ;(async () => {
      const list: ClubDetail[] = []
      const seenIds = new Set<string>()

      // Clube favorito
      const favId = player?.favorite_club_id ?? localStorage.getItem('padel_one_player_favorite_club_id')
      if (favId && typeof favId === 'string') {
        const club = await fetchClubById(favId)
        if (club && active && !seenIds.has(club.id)) {
          list.push(club)
          seenIds.add(club.id)
        }
      }

      // Clubes dos torneios onde jogou
      const tournamentIds = new Set<string>()
      ;(d?.recentMatches ?? []).forEach((m) => m.tournament_id && tournamentIds.add(m.tournament_id))
      ;(d?.pastTournaments ?? []).forEach((t) => t.id && tournamentIds.add(t.id))
      ;(d?.upcomingTournaments ?? []).forEach((t) => t.id && tournamentIds.add(t.id))

      if (tournamentIds.size > 0) {
        const { data: tournaments } = await supabase
          .from('tournaments')
          .select('club_id')
          .in('id', Array.from(tournamentIds))
        const clubIds = [...new Set((tournaments || []).map((t: any) => t.club_id).filter(Boolean))]
        for (const cid of clubIds) {
          if (seenIds.has(cid)) continue
          const club = await fetchClubById(cid)
          if (club && active) {
            list.push(club)
            seenIds.add(club.id)
          }
        }
      }

      if (active) setClubsWherePlays(list)
    })()
    return () => { active = false }
  }, [player?.favorite_club_id, d?.recentMatches, d?.pastTournaments, d?.upcomingTournaments])

  // Categoria de idade (de 5 em 5 anos: +55, +60, etc.)
  const getAgeCategory = (): string | null => {
    const bd = player?.birth_date
    if (!bd) return null
    const birth = new Date(bd)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    if (age < 18) return null
    const cat = Math.floor(age / 5) * 5
    return `+${cat}`
  }
  const ageCategory = getAgeCategory()

  // --- Level Evolution Chart ---
  const [levelHistory, setLevelHistory] = useState<LevelHistoryEntry[]>([])

  useEffect(() => {
    if (!player?.id) return
    fetchLevelHistory(player.id, 50).then(setLevelHistory)
  }, [player?.id, player?.level, player?.rated_matches, recentMatches.length])

  const levelChartData = useMemo(() => {
    const currentLevel = player?.level ?? 3.0
    const TARGET = 5

    // Prefer last 5 completed matches so draws (is_winner === null) always appear.
    const completedMatches = [...recentMatches]
      .filter(m => m.status === 'completed' && (m.is_winner === true || m.is_winner === false || m.is_winner === null))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    const lastMatches = completedMatches.slice(-TARGET)

    const historyBySource = new Map<string, LevelHistoryEntry>()
    if (levelHistory.length > 0) {
      for (const h of [...levelHistory].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())) {
        if (h.source_id) historyBySource.set(String(h.source_id), h)
      }
    }

    if (lastMatches.length > 0) {
      const totalRated = (player?.wins ?? 0) + (player?.losses ?? 0)
      const K = totalRated < 5 ? 0.50 : totalRated < 10 ? 0.35 : totalRated < 20 ? 0.25 : totalRated < 40 ? 0.15 : totalRated < 60 ? 0.10 : 0.06
      const baseDelta = K * 0.4

      const points = lastMatches.map((m) => {
        const hist = m.id ? historyBySource.get(String(m.id).replace(/^open_result_/, '')) || historyBySource.get(String(m.id)) : undefined
        const openId = (m as any).open_game_id ? historyBySource.get(String((m as any).open_game_id)) : undefined
        const h = hist || openId
        const won = m.is_winner === true ? true : m.is_winner === false ? false : null
        const delta = h
          ? Number(h.delta)
          : won === true
            ? baseDelta
            : won === false
              ? -baseDelta
              : 0
        return {
          match: m,
          won,
          delta,
          levelAfter: h ? Number(h.level_after) : null as number | null,
          levelBefore: h ? Number(h.level_before) : null as number | null,
          date: new Date(m.start_time || h?.created_at || Date.now()),
          matchType: (m.is_open_game ? 'open_game' : 'tournament') as 'open_game' | 'tournament',
        }
      })

      // Walk levels backwards from current when history missing for some points
      let runLvl = currentLevel
      for (let i = points.length - 1; i >= 0; i--) {
        if (points[i].levelAfter == null) {
          points[i].levelAfter = runLvl
          points[i].levelBefore = Math.max(0.5, parseFloat((runLvl - points[i].delta).toFixed(2)))
          runLvl = points[i].levelBefore
        } else {
          runLvl = points[i].levelBefore ?? Math.max(0.5, parseFloat((Number(points[i].levelAfter) - points[i].delta).toFixed(2)))
        }
      }

      return points.map((p, i) => ({
        index: i,
        level: i === points.length - 1 ? currentLevel : Number(p.levelAfter),
        levelBefore: Number(p.levelBefore ?? p.levelAfter),
        delta: parseFloat(Number(p.delta).toFixed(4)),
        won: p.won,
        date: p.date,
        matchType: p.matchType,
      }))
    }

    // Fallback: levelHistory only (no recent match list)
    if (levelHistory.length > 0) {
      const bySource = new Map<string, LevelHistoryEntry>()
      const noSource: LevelHistoryEntry[] = []
      for (const h of [...levelHistory].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())) {
        if (h.source_id) bySource.set(`${h.source_id}:${h.player_account_id}`, h)
        else noSource.push(h)
      }
      const sorted = [...noSource, ...bySource.values()]
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .slice(-TARGET)

      return sorted.map((h, i) => ({
        index: i,
        level: i === sorted.length - 1 ? currentLevel : h.level_after,
        levelBefore: h.level_before,
        delta: h.delta,
        won: h.match_won,
        date: new Date(h.created_at),
        matchType: h.match_type,
      }))
    }

    return [{ index: 0, level: currentLevel, levelBefore: currentLevel, delta: 0, won: null as boolean | null, date: new Date(), matchType: 'tournament' as const }]
  }, [levelHistory, recentMatches, player?.level, player?.wins, player?.losses])

  const getHandLabel = (h?: string) => ({ right: 'Direita', left: 'Esquerda', ambidextrous: 'Ambidestro' }[h || ''] || '—')
  const getPositionLabel = (p?: string) => ({ right: 'Direita', left: 'Esquerda', both: 'Ambas' }[p || ''] || '—')
  const getGameTypeLabel = (g?: string) => ({ competitive: 'Competitivo', friendly: 'Amigável', both: 'Ambos' }[g || ''] || '—')
  const getTimeLabel = (timeStr?: string) => ({ morning: t.common.morning, afternoon: t.common.afternoon, evening: t.common.evening, all_day: t.common.allDay }[timeStr || ''] || '—')

  const splitName = (fullName: string): { firstName: string; lastName: string } => {
    const parts = fullName.trim().split(/\s+/)
    if (parts.length === 1) return { firstName: parts[0], lastName: '' }
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Profile Card - Foto + Nome + Bio (igual à Home) */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            {player?.avatar_url ? (
              <img src={player.avatar_url} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-4 border-red-100" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-padel flex items-center justify-center">
                <span className="text-white font-bold text-2xl">{player?.name?.charAt(0)?.toUpperCase() || 'P'}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-xl text-gray-900">{player?.name || 'Jogador'}</h2>
            {truncatedBio && <p className="text-sm text-gray-600 mt-1 leading-relaxed">{truncatedBio}</p>}
          </div>
        </div>
      </div>

      {/* Nível + Fiabilidade + Categoria + Idade */}
      {(() => {
        const colors = levelColors(player?.level)
        const hasGradient = colors && colors.hex !== '#e5e7eb'
        const bgStyle = hasGradient 
          ? { background: `linear-gradient(135deg, ${colors.hex} 0%, ${colors.hexTo} 100%)` }
          : {}

        return (
          <div 
            className={`rounded-xl shadow-sm overflow-hidden p-6 ${!hasGradient ? 'bg-gradient-to-br from-red-50 to-red-100' : ''}`}
            style={bgStyle}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className={`text-5xl font-bold ${hasGradient ? 'text-white' : 'text-red-600'}`}>
                  Nível {player?.level?.toFixed(2) || '3.00'}
                </p>
                <p className={`text-sm mt-2 flex items-center gap-1.5 ${hasGradient ? 'text-white/90' : 'text-gray-600'}`}>
                  <span>📊</span> Fiabilidade {player?.level_reliability_percent?.toFixed(0) ?? '85'}%
                </p>
              </div>
              <div className="flex flex-col gap-2 self-start">
                {ageCategory && (
                  <div className="px-4 py-2 bg-amber-500 rounded-lg shadow-sm">
                    <span className="text-sm font-bold text-white">{ageCategory}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Evolução do nível — gráfico inspirado no Playtomic */}
      {(() => {
        const data = levelChartData
        if (data.length === 0) return null

        const W = 320
        const H = 160
        const PAD_L = 42
        const PAD_R = 14
        const PAD_T = 16
        const PAD_B = 28
        const chartW = W - PAD_L - PAD_R
        const chartH = H - PAD_T - PAD_B

        const levels = data.map(d => d.level)
        const minLvl = Math.floor((Math.min(...levels) - 0.1) * 10) / 10
        const maxLvl = Math.ceil((Math.max(...levels) + 0.1) * 10) / 10
        const range = maxLvl - minLvl || 0.2

        const toX = (i: number) => PAD_L + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2)
        const toY = (lvl: number) => PAD_T + chartH - ((lvl - minLvl) / range) * chartH

        const gridLines: number[] = []
        const step = range <= 0.3 ? 0.05 : range <= 0.6 ? 0.1 : 0.2
        for (let v = Math.ceil(minLvl / step) * step; v <= maxLvl; v = parseFloat((v + step).toFixed(2))) gridLines.push(v)

        const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.level).toFixed(1)}`).join(' ')
        const areaD = pathD + ` L${toX(data.length - 1).toFixed(1)},${(PAD_T + chartH).toFixed(1)} L${toX(0).toFixed(1)},${(PAD_T + chartH).toFixed(1)} Z`

        const last = data[data.length - 1]
        const first = data[0]
        const totalDelta = last.level - first.levelBefore
        const isPositive = totalDelta >= 0

        return (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Evolução do nível
              </h3>
              {data.length > 1 && (
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {isPositive ? '+' : ''}{totalDelta.toFixed(2)}
                </span>
              )}
            </div>

            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 200 }}>
              <defs>
                <linearGradient id="levelAreaGradProfile" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {gridLines.map(v => (
                <g key={v}>
                  <line x1={PAD_L} y1={toY(v)} x2={W - PAD_R} y2={toY(v)} stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="3,3" />
                  <text x={PAD_L - 4} y={toY(v) + 3} textAnchor="end" fill="#9ca3af" fontSize="8" fontFamily="system-ui">{v.toFixed(2)}</text>
                </g>
              ))}

              {data.length > 1 && <path d={areaD} fill="url(#levelAreaGradProfile)" />}
              {data.length > 1 && <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}

              {data.map((d, i) => (
                <g key={i}>
                  <circle cx={toX(i)} cy={toY(d.level)} r={i === data.length - 1 ? 5 : 3} fill={d.won === true ? '#22c55e' : d.won === false ? '#ef4444' : '#f59e0b'} stroke="white" strokeWidth="1.5" />
                  {i === data.length - 1 && (
                    <>
                      <rect x={toX(i) - 16} y={toY(d.level) - 20} width="32" height="14" rx="4" fill="#3b82f6" />
                      <text x={toX(i)} y={toY(d.level) - 10.5} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="system-ui">{d.level.toFixed(2)}</text>
                    </>
                  )}
                </g>
              ))}

              {data.length > 1 && data.map((d, i) => {
                const dateStr = `${d.date.getDate()}/${d.date.getMonth() + 1}`
                return i % Math.max(1, Math.floor(data.length / 5)) === 0 || i === data.length - 1 ? (
                  <text key={`d${i}`} x={toX(i)} y={H - 4} textAnchor="middle" fill="#9ca3af" fontSize="7" fontFamily="system-ui">{dateStr}</text>
                ) : null
              })}
            </svg>

            {data.length > 1 && (
              <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Vitória</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Empate</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Derrota</span>
              </div>
            )}

            {levelHistory.length === 0 && recentMatches.length > 0 && (
              <p className="text-[10px] text-gray-400 text-center mt-1 italic">Valores estimados com base nos resultados recentes</p>
            )}
          </div>
        )
      })()}

      {/* Estatísticas - Jogos, Vitórias, %, Derrotas, Seguidores */}
      <div className="grid grid-cols-5 gap-2">
        <div className="card p-3 text-center">
          <p className="text-lg mb-0.5">🎾</p>
          <p className="text-xl font-bold text-gray-900">{totalMatches}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Jogos</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg mb-0.5">🏆</p>
          <p className="text-xl font-bold text-green-600">{wins}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Vitórias</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg mb-0.5">📊</p>
          <p className="text-xl font-bold text-blue-600">{winRate}%</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Vitórias %</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg mb-0.5">📉</p>
          <p className="text-xl font-bold text-red-600">{losses}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Derrotas</p>
        </div>
        <div className="card p-3 text-center cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => userId && onOpenFollowsList(userId)}>
          <p className="text-lg mb-0.5">❤️</p>
          <p className="text-xl font-bold text-red-600">{followersCount}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Seguidores</p>
        </div>
      </div>

      {/* Preferências do jogador */}
      <div className="card p-5">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-red-600" />
          Preferências de jogador
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-0.5">Mão dominante</p>
            <p className="font-medium text-gray-900">{getHandLabel(player?.preferred_hand)}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-0.5">Posição no campo</p>
            <p className="font-medium text-gray-900">{getPositionLabel(player?.court_position)}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-0.5">Tipo de jogo</p>
            <p className="font-medium text-gray-900">{getGameTypeLabel(player?.game_type)}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-0.5">Horário preferido</p>
            <p className="font-medium text-gray-900">{getTimeLabel(player?.preferred_time)}</p>
          </div>
        </div>
      </div>

      {/* Próximos Jogos */}
      {upcomingMatches.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>📅</span> Próximos Jogos
            </h2>
            {upcomingMatches.length > 3 && (
              <button onClick={() => onOpenGames('upcoming')} className="text-red-600 text-sm font-medium flex items-center gap-1">
                Ver todos <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth games-horizontal-scroll">
            <div className="flex gap-4" style={{ width: 'max-content' }}>
              {upcomingMatches.map((match) => (
                <div key={match.id} className="snap-center">
                  <GameCardPlaytomic match={match} currentPlayerAvatar={player?.avatar_url} currentPlayerName={player?.name} onPlayerClick={handlePlayerClick} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5 Últimos Jogos - Resultados Recentes (igual à Home) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>📊</span> Resultados Recentes
          </h2>
          {recentMatches.length > 0 && (
            <button onClick={() => onOpenGames('history')} className="text-red-600 text-sm font-medium flex items-center gap-1">
              Ver todos <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
        {recentMatches.length > 0 ? (
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth games-horizontal-scroll">
            <div className="flex gap-4" style={{ width: 'max-content' }}>
              {recentMatches.map((match) => (
                <div key={match.id} className="snap-center">
                  <GameCardPlaytomic match={match} currentPlayerAvatar={player?.avatar_url} currentPlayerName={player?.name} onPlayerClick={handlePlayerClick} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card p-6 text-center">
            <span className="text-4xl mb-2 block">🎾</span>
            <p className="text-gray-700 font-medium">Sem jogos recentes</p>
            <p className="text-sm text-gray-500 mt-1">Os resultados aparecerão aqui</p>
          </div>
        )}
      </div>

      {/* Jogadores com quem mais joga */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Users className="w-5 h-5 text-red-600" />
          {t.learn.playersYouPlayWith}
        </h2>
        {topPlayers.length > 0 ? (
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth">
            <div className="flex gap-3" style={{ width: 'max-content' }}>
              {topPlayers.map(({ name, count }) => {
                const display = shortPlayerLabel(name)
                return (
                <div 
                  key={name} 
                  className="snap-center flex-shrink-0 w-[100px] card p-3 text-center cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handlePlayerClick(name)}
                >
                  <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center mx-auto mb-2 overflow-hidden">
                    {topPlayersAvatars[name] ? (
                      <img src={topPlayersAvatars[name]!} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-bold text-sm">{getInitials(name)}</span>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900 text-xs leading-tight">{display}</p>
                  <p className="text-[10px] text-gray-500 mt-1">{count} jogos</p>
                </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="card p-4 text-center">
            <p className="text-sm text-gray-500">Os jogadores com quem jogas aparecerão aqui</p>
          </div>
        )}
      </div>

      {/* Clubes onde joga [nome] */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-red-600" />
          {t.learn.clubsYouPlayAt} {player?.name?.split(' ')[0] || t.common.player.toLowerCase()}
        </h2>
        {clubsWherePlays.length > 0 ? (
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth">
            <div className="flex gap-3" style={{ width: 'max-content' }}>
              {clubsWherePlays.map((club) => (
                <div key={club.id} className={`snap-center flex-shrink-0 w-[160px] card overflow-hidden p-0 ${club.plan_type === 'preview' ? 'border-amber-200' : ''}`}>
                  <div className="h-20 bg-gray-100 flex items-center justify-center">
                    {club.logo_url ? (
                      <img src={club.logo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-10 h-10 text-gray-400" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-gray-900 text-sm truncate" title={club.name}>{club.name}</p>
                    {club.plan_type === 'preview' && (
                      <p className="text-[10px] text-amber-700 mt-1 leading-tight">Clube ainda não ativo na Padel One</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card p-4 text-center">
            <p className="text-sm text-gray-500">Os clubes onde jogas aparecerão aqui</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Perfil de Edição - Para Definições ----------
function ProfileEditScreen({
  player,
  onLogout,
  onSaveProfile,
  onOpenInfo,
}: {
  player: PlayerAccount | null
  onLogout: () => void
  onSaveProfile: (updates: Partial<PlayerAccount>) => Promise<void>
  onOpenInfo: (type: 'help' | 'howItWorks' | 'privacy') => void
}) {
  const { t } = useI18n()
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Editable fields
  const [editName, setEditName] = useState(player?.name || '')
  const [editEmail, setEditEmail] = useState(player?.email || '')
  const [editGender, setEditGender] = useState<string>(player?.gender || '')
  const [editBirthDate, setEditBirthDate] = useState(player?.birth_date || '')
  const [editLocation, setEditLocation] = useState(player?.location || '')
  const [editHand, setEditHand] = useState<string>(player?.preferred_hand || '')
  const [editPosition, setEditPosition] = useState<string>(player?.court_position || '')
  const [editBio, setEditBio] = useState(player?.bio || '')
  const [editGameType, setEditGameType] = useState<string>(player?.game_type || '')
  const [editPreferredTime, setEditPreferredTime] = useState<string>(player?.preferred_time || '')

  // Sync fields when player changes
  useEffect(() => {
    if (player) {
      setEditName(player.name || '')
      setEditEmail(player.email || '')
      setEditGender(player.gender || '')
      setEditBirthDate(player.birth_date || '')
      setEditLocation(player.location || '')
      setEditHand(player.preferred_hand || '')
      setEditPosition(player.court_position || '')
      setEditBio(player.bio || '')
      setEditGameType(player.game_type || '')
      setEditPreferredTime(player.preferred_time || '')
    }
  }, [player])


  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !player?.id) return

    // Validar tamanho (max 1MB)
    if (file.size > 1 * 1024 * 1024) {
      setSaveMsg(t.settings.imageMaxSize)
      setTimeout(() => setSaveMsg(''), 3000)
      return
    }

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      setSaveMsg(t.settings.fileMustBeImage)
      setTimeout(() => setSaveMsg(''), 3000)
      return
    }

    setUploadingAvatar(true)
    setSaveMsg('')
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const filePath = `${player.id}.${ext}`

      // Apagar avatar anterior se existir
      await supabase.storage.from('player-avatars').remove([filePath])

      // Upload novo avatar
      const { error: uploadError } = await supabase.storage
        .from('player-avatars')
        .upload(filePath, file, { cacheControl: '3600', upsert: true })

      if (uploadError) throw uploadError

      // Gerar URL pública
      const { data: urlData } = supabase.storage
        .from('player-avatars')
        .getPublicUrl(filePath)

      const avatar_url = urlData.publicUrl + '?t=' + Date.now()

      // Guardar URL no perfil
      await onSaveProfile({ avatar_url })
      setSaveMsg(t.settings.photoUpdated)
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (err) {
      console.error('[AVATAR] Upload error:', err)
      setSaveMsg(t.settings.photoUploadError)
      setTimeout(() => setSaveMsg(''), 3000)
    } finally {
      setUploadingAvatar(false)
      // Reset input para permitir re-upload do mesmo ficheiro
      e.target.value = ''
    }
  }

  const handleSave = async () => {
    // Validar campos obrigatórios (exceto Sobre mim)
    const missing: string[] = []
    if (!editName.trim()) missing.push(t.settings.name)
    if (!editEmail.trim()) missing.push(t.settings.email)
    if (!editGender) missing.push(t.settings.gender)
    if (!editBirthDate) missing.push(t.settings.birthDate)
    if (!editLocation.trim()) missing.push(t.settings.location)
    if (!editHand) missing.push(t.settings.preferredHand)
    if (!editPosition) missing.push(t.settings.courtPosition)
    if (!editPreferredTime) missing.push(t.settings.preferredTime)

    if (missing.length > 0) {
      setSaveMsg(`${t.settings.fillRequiredFields} ${missing.join(', ')}`)
      setTimeout(() => setSaveMsg(''), 5000)
      return
    }

    setSaving(true)
    setSaveMsg('')
    try {
      const updates: Partial<PlayerAccount> = {
        name: editName.trim(),
        email: editEmail.trim(),
        gender: editGender as any,
        birth_date: editBirthDate,
        location: editLocation.trim(),
        preferred_hand: editHand as any,
        court_position: editPosition as any,
        bio: editBio.trim() || undefined,
        game_type: 'competitive',
        preferred_time: editPreferredTime as any,
      }

      if (editLocation.trim() && editLocation.trim() !== (player?.location || '')) {
        const geo = await geocodeAddress(editLocation.trim())
        if (geo) {
          ;(updates as any).lat = geo.lat
          ;(updates as any).lng = geo.lng
        }
      }

      await onSaveProfile(updates)
      setSaveMsg(t.settings.profileSaved)
      setTimeout(() => setSaveMsg(''), 3000)
    } catch {
      setSaveMsg(t.settings.saveError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* Profile Header - Simples */}
      <div className="card p-6 text-center">
        <div className="relative inline-block">
          {player?.avatar_url ? (
            <img 
              src={player.avatar_url} 
              alt="Avatar" 
              className="w-24 h-24 rounded-full object-cover border-4 border-red-100 mx-auto"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-padel flex items-center justify-center mx-auto">
              <span className="text-3xl font-bold text-white">
                {player?.name?.charAt(0)?.toUpperCase() || 'P'}
              </span>
            </div>
          )}
          <label className="absolute bottom-0 right-0 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:bg-red-700 transition-colors">
            {uploadingAvatar ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Camera className="w-4 h-4 text-white" />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              disabled={uploadingAvatar}
              className="hidden"
            />
          </label>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mt-3">{player?.name || t.settings.player}</h2>
        <p className="text-gray-500 text-sm">{player?.phone_number || player?.phone}</p>
        
      </div>

      {/* Success/Error Message */}
      {saveMsg && (
        <div className={`text-center text-sm font-medium py-2 px-4 rounded-lg ${saveMsg.includes(t.settings.saveError) || saveMsg.includes(t.settings.fillRequiredFields) ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
          {saveMsg}
        </div>
      )}

      {/* Profile Edit Section - Sempre aberto */}
      <div className="card p-4 space-y-4">
            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.name} <span className="text-red-600">*</span></label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                placeholder={t.settings.namePlaceholder}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.email}</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                placeholder={t.settings.emailPlaceholder}
              />
            </div>

            {/* Género */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.gender} <span className="text-red-600">*</span></label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'male', label: t.games.male },
                  { value: 'female', label: t.games.female },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEditGender(opt.value)}
                    className={`py-2 px-2 rounded-lg text-sm font-medium border transition-colors ${
                      editGender === opt.value
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-red-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Data de Nascimento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.birthDate} <span className="text-red-600">*</span></label>
              <input
                type="date"
                value={editBirthDate}
                onChange={(e) => setEditBirthDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
              />
            </div>

            {/* Localização */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.location} <span className="text-red-600">*</span></label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                  placeholder={t.settings.locationPlaceholder}
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!navigator.geolocation) return
                    navigator.geolocation.getCurrentPosition(async (pos) => {
                      const { reverseGeocode } = await import('./lib/geocoding')
                      const addr = await reverseGeocode(pos.coords.latitude, pos.coords.longitude)
                      if (addr) setEditLocation(addr.split(',').slice(0, 3).join(',').trim())
                    }, () => {})
                  }}
                  className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
                  title="Usar GPS"
                >
                  📍
                </button>
              </div>
            </div>

            {/* Mão Preferida */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.preferredHand} <span className="text-red-600">*</span></label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'right', label: t.settings.right },
                  { value: 'left', label: t.settings.left },
                  { value: 'ambidextrous', label: t.settings.ambidextrous },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEditHand(editHand === opt.value ? '' : opt.value)}
                    className={`py-2 px-2 rounded-lg text-sm font-medium border transition-colors ${
                      editHand === opt.value
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-red-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Posição em Campo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.courtPosition} <span className="text-red-600">*</span></label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'right', label: t.settings.right },
                  { value: 'left', label: t.settings.left },
                  { value: 'both', label: t.settings.both },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEditPosition(editPosition === opt.value ? '' : opt.value)}
                    className={`py-2 px-2 rounded-lg text-sm font-medium border transition-colors ${
                      editPosition === opt.value
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-red-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tipo de Jogo Preferido — apenas competitivo (todos contam para ranking) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.preferredGameType}</label>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">🏆 {t.games.competitive}</p>
            </div>

            {/* Horário Preferido */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.preferredTime} <span className="text-red-600">*</span></label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 'morning', label: t.common.morning },
                  { value: 'afternoon', label: t.common.afternoon },
                  { value: 'evening', label: t.common.evening },
                  { value: 'all_day', label: t.common.allDay },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEditPreferredTime(editPreferredTime === opt.value ? '' : opt.value)}
                    className={`py-2 px-1 rounded-lg text-xs font-medium border transition-colors ${
                      editPreferredTime === opt.value
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-red-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.aboutMe}</label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
                placeholder={t.settings.aboutMePlaceholder}
              />
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {t.settings.saveProfile}
                </>
              )}
            </button>
      </div>

      {/* Centro de Ajuda, Ajuda rápida, Como funciona, Privacidade */}
      <div className="card overflow-hidden">
        <a href="https://padel1.app/help" target="_blank" rel="noopener noreferrer" className="w-full p-4 flex items-center justify-between hover:bg-red-50 transition-colors bg-red-50/30">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-5 h-5 text-red-600" />
            <div>
              <span className="font-semibold text-gray-900 block">{t.help.helpCenter}</span>
              <span className="text-xs text-gray-500">{t.help.helpCenterDesc}</span>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-red-600" />
        </a>
        <div className="border-t border-gray-100" />
        <button onClick={() => onOpenInfo('help')} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-5 h-5 text-gray-400" />
            <span className="font-medium text-gray-900">{t.common.help}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
        <div className="border-t border-gray-100" />
        <button onClick={() => onOpenInfo('howItWorks')} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-5 h-5 text-gray-400" />
            <span className="font-medium text-gray-900">{t.howItWorks.title}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
        <div className="border-t border-gray-100" />
        <button onClick={() => onOpenInfo('privacy')} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-gray-400" />
            <span className="font-medium text-gray-900">{t.privacy.title}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </div>

    </div>
  )
}

// ---------- Registo (Criar Conta com Questionário de Nível — 12 perguntas) ----------

// Definição das 12 perguntas do questionário (função que recebe traduções)
const getQuizQuestions = (t: typeof translations.pt): { id: string; title: string; options: { value: number; label: string }[] }[] => [
  {
    id: 'q1', title: t.register.q1Title,
    options: [
      { value: 0, label: t.register.q1o0 },
      { value: 1, label: t.register.q1o1 },
      { value: 2, label: t.register.q1o2 },
      { value: 3, label: t.register.q1o3 },
    ],
  },
  {
    id: 'q2', title: t.register.q2Title,
    options: [
      { value: 0, label: t.register.q2o0 },
      { value: 1, label: t.register.q2o1 },
      { value: 2, label: t.register.q2o2 },
      { value: 3, label: t.register.q2o3 },
    ],
  },
  {
    id: 'q3', title: t.register.q3Title,
    options: [
      { value: 0, label: t.register.q3o0 },
      { value: 1, label: t.register.q3o1 },
      { value: 2, label: t.register.q3o2 },
      { value: 3, label: t.register.q3o3 },
    ],
  },
  {
    id: 'q4', title: t.register.q4Title,
    options: [
      { value: 0, label: t.register.q4o0 },
      { value: 1, label: t.register.q4o1 },
      { value: 2, label: t.register.q4o2 },
      { value: 3, label: t.register.q4o3 },
    ],
  },
  {
    id: 'q5', title: t.register.q5Title,
    options: [
      { value: 0, label: t.register.q5o0 },
      { value: 1, label: t.register.q5o1 },
      { value: 2, label: t.register.q5o2 },
      { value: 3, label: t.register.q5o3 },
    ],
  },
  {
    id: 'q6', title: t.register.q6Title,
    options: [
      { value: 0, label: t.register.q6o0 },
      { value: 1, label: t.register.q6o1 },
      { value: 2, label: t.register.q6o2 },
      { value: 3, label: t.register.q6o3 },
    ],
  },
  {
    id: 'q7', title: t.register.q7Title,
    options: [
      { value: 0, label: t.register.q7o0 },
      { value: 1, label: t.register.q7o1 },
      { value: 2, label: t.register.q7o2 },
      { value: 3, label: t.register.q7o3 },
    ],
  },
  {
    id: 'q8', title: t.register.q8Title,
    options: [
      { value: 0, label: t.register.q8o0 },
      { value: 1, label: t.register.q8o1 },
      { value: 2, label: t.register.q8o2 },
      { value: 3, label: t.register.q8o3 },
    ],
  },
  {
    id: 'q9', title: t.register.q9Title,
    options: [
      { value: 0, label: t.register.q9o0 },
      { value: 1, label: t.register.q9o1 },
      { value: 2, label: t.register.q9o2 },
      { value: 3, label: t.register.q9o3 },
    ],
  },
  {
    id: 'q10', title: t.register.q10Title,
    options: [
      { value: 0, label: t.register.q10o0 },
      { value: 1, label: t.register.q10o1 },
      { value: 2, label: t.register.q10o2 },
      { value: 3, label: t.register.q10o3 },
    ],
  },
  {
    id: 'q11', title: t.register.q11Title,
    options: [
      { value: 0, label: t.register.q11o0 },
      { value: 1, label: t.register.q11o1 },
      { value: 2, label: t.register.q11o2 },
      { value: 3, label: t.register.q11o3 },
    ],
  },
  {
    id: 'q12', title: t.register.q12Title,
    options: [
      { value: 0, label: t.register.q12o0 },
      { value: 1, label: t.register.q12o1 },
      { value: 2, label: t.register.q12o2 },
      { value: 3, label: t.register.q12o3 },
    ],
  },
]

// Agrupar perguntas em páginas de 3 (função que recebe traduções)
const getQuizPages = (t: typeof translations.pt) => {
  const questions = getQuizQuestions(t)
  return [
    { label: t.register.quizExperience, questions: questions.slice(0, 3) },
    { label: t.register.quizTechnique, questions: questions.slice(3, 6) },
    { label: t.register.quizShots, questions: questions.slice(6, 9) },
    { label: t.register.quizStrategy, questions: questions.slice(9, 12) },
  ]
}

function RegisterScreen({ onBack, onSuccess, returnTo }: {
  onBack: () => void
  onSuccess: (playerAccount: any) => void
  returnTo?: string | null
}) {
  const { t, language } = useI18n()

  // Deep-link: /register?mode=full (universo Padel One) | ?mode=bookOnly (só reservar)
  const initialModeFromUrl = (() => {
    const raw = new URLSearchParams(window.location.search).get('mode')?.toLowerCase().trim()
    if (!raw) return null
    if (raw === 'full' || raw === 'padel' || raw === 'player' || raw === 'tournaments') return 'full' as const
    if (raw === 'bookonly' || raw === 'book' || raw === 'reservar' || raw === 'booking') return 'bookOnly' as const
    return null
  })()
  const modeLockedFromUrl = initialModeFromUrl !== null

  const [step, setStep] = useState<0 | 1 | 2 | 3>(initialModeFromUrl ? 1 : 0)
  const [mode, setMode] = useState<'full' | 'bookOnly' | null>(initialModeFromUrl)
  const [quizPage, setQuizPage] = useState(0) // 0-3 for the 4 quiz sub-pages
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Step 1: Dados pessoais
  const [name, setName] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regCountryIso, setRegCountryIso] = useState(() => defaultCountryIso(language))
  const [gender, setGender] = useState<'M' | 'F'>('M')
  const [email, setEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')

  // Step 2: Questionário de nível — 12 respostas (0-3) indexadas por question id
  const [answers, setAnswers] = useState<Record<string, number>>({})

  const setAnswer = (questionId: string, value: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  // Calcular nível baseado nas 12 respostas
  // Fórmula: Nível = 0.5 + (score * 4.0 / 36)
  // 0 pts → 0.50 | 18 pts → 2.50 | 30 pts → 3.83 | 36 pts → 4.50
  // Ninguém pode ser > 4.50 via questionário; fiabilidade inicial = 10%
  const QUIZ_MAX_LEVEL = 4.5
  const QUIZ_INITIAL_RELIABILITY = 10

  const calculateLevel = (): number => {
    if (mode === 'bookOnly') return 1.0

    const totalScore = Object.values(answers).reduce((sum, v) => sum + v, 0)
    const answeredCount = Object.keys(answers).length

    if (answeredCount === 0) return 0.5

    const normalizedScore = answeredCount < 12
      ? (totalScore / answeredCount) * 12
      : totalScore

    const level = 0.5 + (normalizedScore * 4.0 / 36)
    return Math.round(Math.min(QUIZ_MAX_LEVEL, Math.max(0.5, level)) * 100) / 100
  }

  const handleRegister = async () => {
    setError('')
    setSaving(true)

    try {
      const fullPhone = composeInternationalPhone(dialCodeForIso(regCountryIso), regPhone)
      const normalizedPhone = normalizePhone(fullPhone)

      // Validações
      if (!name.trim()) { setError(t.register.nameRequired); setSaving(false); return }
      if (!isValidPhone(fullPhone)) { 
        setError(t.register.addCountryCode);
        setSaving(false); 
        return 
      }
      if (!email.trim() || !email.includes('@')) { setError(t.auth.invalidEmail); setSaving(false); return }
      if (regPassword.length < 6) { setError(t.register.passwordMin); setSaving(false); return }
      if (regPassword !== confirmPwd) { setError(t.register.passwordsMismatch); setSaving(false); return }

      // Verificar se telefone ou email já existem
      const { data: existingPhone } = await supabase
        .from('player_accounts')
        .select('id')
        .eq('phone_number', normalizedPhone)
        .maybeSingle()
      
      if (existingPhone) { setError(t.register.phoneAlreadyRegistered); setSaving(false); return }

      // 1. Criar conta no Supabase Auth (ou recuperar se já existir como órfão)
      let userId: string | undefined

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: regPassword,
      })

      if (authError) {
        if (authError.message.includes('already registered')) {
          // Auth user exists but player_account may not (orphan from failed registration)
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: regPassword,
          })
          if (signInError) {
            setError(t.register.emailAlreadyRegistered)
            setSaving(false)
            return
          }
          userId = signInData?.user?.id
          // Check if player_account already exists for this user
          const { data: existingPA } = await supabase
            .from('player_accounts')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle()
          if (existingPA) {
            onSuccess(existingPA)
            return
          }
        } else {
          setError(t.register.errorCreatingAccount + ': ' + authError.message)
          setSaving(false)
          return
        }
      } else {
        userId = authData?.user?.id
      }

      if (!userId) { setError(t.register.errorCreatingAccount); setSaving(false); return }

      // 2. Calcular nível
      const level = calculateLevel()

      // 3. Criar player_account
      const { data: pa, error: paError } = await supabase
        .from('player_accounts')
        .insert({
          user_id: userId,
          name: name.trim(),
          phone_number: normalizedPhone,
          email: email.trim(),
          level,
          level_reliability_percent: 10,
          wins: 0,
          losses: 0,
          rated_matches: 0,
        })
        .select('*')
        .single()

      if (paError) {
        console.error('[Register] Error creating player_account:', paError)
        setError(t.register.errorCreatingProfile + ': ' + paError.message)
        setSaving(false)
        return
      }

      // 4. Fazer login automático
      await supabase.auth.signInWithPassword({ email: email.trim(), password: regPassword })

      // Sucesso!
      onSuccess(pa)
    } catch (err: any) {
      console.error('[Register] Error:', err)
      setError(t.register.unexpectedError + ': ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Progresso: bookOnly → 3 segmentos (escolha, dados, confirmação), full → 7 segmentos
  const totalSegments = mode === 'bookOnly' ? 3 : 7
  const currentSegment = step === 0 ? 0 : step === 1 ? 1 : step === 2 ? 2 + quizPage : (mode === 'bookOnly' ? 3 : 7)

  // Obter páginas do questionário com traduções
  const QUIZ_PAGES = getQuizPages(t)

  // Quantas perguntas da página actual estão respondidas
  const currentPageQuestions = step === 2 ? QUIZ_PAGES[quizPage]?.questions ?? [] : []
  const currentPageAnswered = currentPageQuestions.filter(q => answers[q.id] !== undefined).length
  const currentPageComplete = currentPageAnswered === currentPageQuestions.length

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => {
            if (step === 2 && quizPage > 0) { setQuizPage(quizPage - 1); setError('') }
            else if (step === 2 && quizPage === 0) { setStep(1); setError('') }
            else if (step === 3 && mode === 'bookOnly') { setStep(1); setError('') }
            else if (step === 3) { setStep(2); setQuizPage(3); setError('') }
            else if (step === 1 && modeLockedFromUrl) { onBack() }
            else if (step === 1) { setStep(0); setMode(null); setError('') }
            else onBack()
          }} className="p-1 -ml-1"><ArrowLeft className="w-6 h-6 text-gray-700" /></button>
          <h1 className="text-2xl font-bold text-gray-900">{t.register.createAccount}</h1>
        </div>

        {/* Progress bar — 6 segmentos */}
        <div className="flex gap-1.5 mb-6">
          {Array.from({ length: totalSegments }).map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${i < currentSegment ? 'bg-red-600' : 'bg-gray-200'}`} />
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
            <p className="text-red-600 text-sm text-center">{error}</p>
          </div>
        )}

        {/* ========== STEP 0: ESCOLHA DO MODO ========== */}
        {step === 0 && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center pt-4">
              <div className="w-16 h-16 bg-gradient-padel rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🎾</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900">{t.register?.welcomeTitle || 'Bem-vindo ao Padel One!'}</h2>
              <p className="text-gray-500 mt-1">{t.register?.welcomeSubtitle || 'O que pretendes fazer?'}</p>
            </div>

            <button
              onClick={() => { setMode('full'); setStep(1); setError('') }}
              className="w-full text-left p-5 rounded-2xl border-2 border-gray-200 hover:border-red-500 hover:bg-red-50/30 transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 group-hover:bg-red-200 transition-colors">
                  <Trophy className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-base">{t.register?.optionFullTitle || 'Quero fazer parte do universo Padel One'}</p>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">{t.register?.optionFullDesc || 'Jogos, torneios, comunidade, nível Elo e muito mais. Avaliação de nível incluída.'}</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => { setMode('bookOnly'); setStep(1); setError('') }}
              className="w-full text-left p-5 rounded-2xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50/30 transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-base">{t.register?.optionBookTitle || 'Só quero reservar um campo'}</p>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">{t.register?.optionBookDesc || 'Acesso rápido à reserva de campos nos clubes parceiros. Sem questionário de nível.'}</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* ========== STEP 1: DADOS PESSOAIS ========== */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-lg font-bold text-gray-900 mb-2">{t.register.personalData}</h2>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">{t.register.fullName}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input value={name} onChange={e => setName(e.target.value)} placeholder={t.register.yourName} className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">{t.register.phone}</label>
              <div className="flex gap-2">
                <select
                  value={regCountryIso}
                  onChange={e => setRegCountryIso(e.target.value)}
                  aria-label={t.register.addCountryCode}
                  className="w-[9.5rem] shrink-0 py-3 pl-2 pr-1 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                >
                  {COUNTRY_DIAL_CODES.map(c => (
                    <option key={c.iso} value={c.iso}>
                      {c.flag} +{c.dial} {c.name}
                    </option>
                  ))}
                </select>
                <div className="relative flex-1 min-w-0">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input value={regPhone} onChange={e => setRegPhone(e.target.value)} placeholder={t.register.phonePlaceholder} type="tel" inputMode="tel" className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {t.register.phoneHint}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">{t.register?.gender || 'Género'}</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setGender('M')}
                  className={`flex-1 py-3 rounded-xl font-semibold text-sm border transition-all ${
                    gender === 'M'
                      ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-200'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-blue-300'
                  }`}
                >
                  {t.register?.male || 'Masculino'}
                </button>
                <button
                  type="button"
                  onClick={() => setGender('F')}
                  className={`flex-1 py-3 rounded-xl font-semibold text-sm border transition-all ${
                    gender === 'F'
                      ? 'bg-pink-600 text-white border-pink-600 ring-2 ring-pink-200'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-pink-300'
                  }`}
                >
                  {t.register?.female || 'Feminino'}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">{t.register.email}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder={t.register.emailPlaceholder} type="email" className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">{t.register.password}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder={t.register.passwordPlaceholder} type="password" className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">{t.register.confirmPassword}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder={t.register.confirmPassword} type="password" className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
              </div>
            </div>

            <button 
              onClick={async () => {
                setError('')
                if (!name.trim()) { setError(t.register.nameRequired); return }
                if (!regPhone.trim()) { setError(t.register.phoneRequired); return }
                const fullPhone = composeInternationalPhone(dialCodeForIso(regCountryIso), regPhone)
                if (!isValidPhone(fullPhone)) { setError(t.register.addCountryCode); return }
                if (!email.trim()) { setError(t.register.emailRequired); return }
                if (regPassword.length < 6) { setError(t.register.passwordMin); return }
                if (regPassword !== confirmPwd) { setError(t.register.passwordsMismatch); return }

                const checkPhone = normalizePhone(fullPhone)
                const { data: dupPhone } = await supabase
                  .from('player_accounts')
                  .select('id')
                  .eq('phone_number', checkPhone)
                  .maybeSingle()
                if (dupPhone) { setError(t.register.phoneAlreadyRegistered); return }

                if (mode === 'bookOnly') {
                  setStep(3)
                } else {
                  setStep(2)
                  setQuizPage(0)
                }
              }}
              className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
            >
              {t.register.next}
            </button>
          </div>
        )}

        {/* ========== STEP 2: QUESTIONÁRIO DE NÍVEL (12 perguntas em 4 páginas) ========== */}
        {step === 2 && (
          <div className="space-y-5 animate-fade-in">
            {quizPage === 0 && (
              <>
                <h2 className="text-lg font-bold text-gray-900">{t.register.levelAssessment}</h2>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 -mt-2">
                  <p className="text-sm text-amber-800 leading-relaxed">
                    Responda a estas questões o mais sinceramente possível para que possamos determinar o seu nível de partida no mundo <strong>Padel One</strong>!
                  </p>
                  <p className="text-sm text-amber-800 leading-relaxed mt-2">
                    Lembramos que o Nível é a base de tudo para conseguir jogos interessantes com jogadores de um nível similar! Obrigado 🎾
                  </p>
                </div>
              </>
            )}

            {quizPage > 0 && (
              <h2 className="text-lg font-bold text-gray-900">{QUIZ_PAGES[quizPage].label}</h2>
            )}
            {quizPage === 0 && (
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-800 text-sm mb-1">{QUIZ_PAGES[0].label}</h3>
              </div>
            )}

            <div className="space-y-5">
              {currentPageQuestions.map((q) => (
                <div key={q.id}>
                  <p className="text-sm font-semibold text-gray-800 mb-2">{q.title}</p>
                  <div className="space-y-1.5">
                    {q.options.map((opt, oi) => {
                      const letter = String.fromCharCode(65 + oi)
                      const isSelected = answers[q.id] === opt.value
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setAnswer(q.id, opt.value)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left text-sm transition-all ${
                            isSelected
                              ? 'border-red-500 bg-red-50 ring-1 ring-red-200'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            isSelected ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {letter}
                          </span>
                          <span className={`${isSelected ? 'text-red-800 font-medium' : 'text-gray-700'}`}>
                            {opt.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Contador de respostas na página */}
            <p className="text-xs text-gray-400 text-center">
              {currentPageAnswered}/{currentPageQuestions.length} {t.register.answeredInSection}
            </p>

            {/* Botões navegação */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setError('')
                  if (quizPage > 0) setQuizPage(quizPage - 1)
                  else { setStep(1); setQuizPage(0) }
                }}
                className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50"
              >
                {t.register.back}
              </button>
              <button 
                onClick={() => {
                  setError('')
                  if (!currentPageComplete) {
                    setError(t.register.answerAllQuestions)
                    return
                  }
                  if (quizPage < QUIZ_PAGES.length - 1) {
                    setQuizPage(quizPage + 1)
                  } else {
                    setStep(3)
                  }
                }}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
              >
                {quizPage === QUIZ_PAGES.length - 1 ? t.common.viewResult : t.register.next}
              </button>
            </div>
          </div>
        )}

        {/* ========== STEP 3: CONFIRMAÇÃO ========== */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-lg font-bold text-gray-900">{t.register.confirmRegistration}</h2>
            
            <div className="card p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-gradient-padel flex items-center justify-center">
                  <span className="text-white font-bold text-xl">{name.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <p className="font-bold text-gray-900">{name}</p>
                  <p className="text-sm text-gray-500">{email}</p>
                </div>
              </div>
              
              <div className="border-t pt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">{t.register.phoneLabel}</p>
                  <p className="font-medium">{formatPhoneDisplay(composeInternationalPhone(dialCodeForIso(regCountryIso), regPhone)) || regPhone}</p>
                </div>
                <div>
                  <p className="text-gray-500">{t.register.estimatedLevel}</p>
                  <p className="font-bold text-red-600 text-lg">{calculateLevel().toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-500">{t.register.reliability}</p>
                  <p className="font-medium text-amber-600">{QUIZ_INITIAL_RELIABILITY}%</p>
                </div>
              </div>
            </div>

            {/* Resumo visual do questionário (só no modo full) */}
            {mode !== 'bookOnly' && Object.keys(answers).length > 0 && (
              <div className="card p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t.register.quizSummary}</p>
                <div className="grid grid-cols-4 gap-2">
                  {QUIZ_PAGES.map((page, pi) => {
                    const pageScore = page.questions.reduce((s, q) => s + (answers[q.id] ?? 0), 0)
                    const pageMax = page.questions.length * 3
                    const pct = Math.round((pageScore / pageMax) * 100)
                    return (
                      <div key={pi} className="text-center">
                        <div className="relative w-12 h-12 mx-auto mb-1">
                          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                            <circle cx="24" cy="24" r="20" fill="none" stroke="#e5e7eb" strokeWidth="4" />
                            <circle cx="24" cy="24" r="20" fill="none" stroke="#dc2626" strokeWidth="4"
                              strokeDasharray={`${(pct / 100) * 125.6} 125.6`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">{pct}%</span>
                        </div>
                        <p className="text-[10px] text-gray-500 leading-tight">{page.label}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {mode === 'bookOnly' && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <p className="text-sm font-semibold text-blue-800">{t.register?.optionBookTitle || 'Só quero reservar um campo'}</p>
                </div>
                <p className="text-xs text-blue-700 leading-relaxed">
                  {t.register?.bookOnlyNote || 'A tua conta será criada com acesso às funcionalidades de reserva. Podes completar a avaliação de nível mais tarde nas definições.'}
                </p>
              </div>
            )}

            <p className="text-xs text-gray-500 text-center">
              {mode === 'bookOnly'
                ? (t.register?.bookOnlyLevelNote || 'Nível inicial atribuído: 1.0. Podes atualizar mais tarde.')
                : t.register.levelAutoAdjust
              }
            </p>

            <div className="flex gap-3">
              <button onClick={() => { if (mode === 'bookOnly') { setStep(1); } else { setStep(2); setQuizPage(3); } setError('') }} className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50">
                {t.register.back}
              </button>
              <button 
                onClick={handleRegister}
                disabled={saving}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:bg-gray-300"
              >
                {saving ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t.register.creating}
                  </div>
                ) : t.common.createAccount}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Modal: Mudar Password ----------
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      setMessage('A password deve ter pelo menos 6 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage('As passwords não coincidem.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setMessage('Password alterada com sucesso!')
      setTimeout(onClose, 1500)
    } catch (err: any) {
      setMessage(`Erro: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Mudar Password</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Nova password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Confirmar password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder={t.common.repeatPassword}
            />
          </div>
          {message && (
            <p className={`text-sm ${message.startsWith('Erro') ? 'text-red-600' : message.includes('sucesso') ? 'text-green-600' : 'text-amber-600'}`}>{message}</p>
          )}
          <button
            onClick={handleChangePassword}
            disabled={saving}
            className="w-full py-2.5 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700 disabled:bg-gray-300 transition-colors"
          >
            {saving ? 'A alterar...' : 'Alterar Password'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- Modal: Informações (Ajuda, Como funciona, Privacidade) ----------
function InfoModal({ type, onClose }: { type: 'help' | 'howItWorks' | 'privacy'; onClose: () => void }) {
  const { t } = useI18n()
  const content = {
    help: {
      title: t.help.title,
      icon: HelpCircle,
      sections: [
        { title: t.help.quickResult, text: t.help.quickResultText },
        { title: t.help.swapTeams, text: t.help.swapTeamsText },
        { title: t.help.installApp, text: t.help.installAppText },
        { title: t.help.contact, text: t.help.contactText },
        { title: t.help.accountProblems, text: t.help.accountProblemsText },
        { title: t.common.incorrectResults, text: t.common.incorrectResultsText },
        { title: t.help.levelReliability, text: t.help.levelReliabilityText },
      ]
    },
    howItWorks: {
      title: t.howItWorks.title,
      icon: GraduationCap,
      sections: [
        { title: t.howItWorks.tournaments, text: t.howItWorks.tournamentsText },
        { title: t.howItWorks.eloLevel, text: t.howItWorks.eloLevelText },
        { title: t.howItWorks.leagues, text: t.howItWorks.leaguesText },
        { title: t.howItWorks.community, text: t.howItWorks.communityText },
        { title: t.howItWorks.openGames, text: t.howItWorks.openGamesText },
        { title: t.howItWorks.quickResult, text: t.howItWorks.quickResultText },
        { title: t.howItWorks.swapTeams, text: t.howItWorks.swapTeamsText },
      ]
    },
    privacy: {
      title: t.privacy.title,
      icon: Shield,
      sections: [
        { title: t.common.personalData, text: t.common.personalDataText },
        { title: t.privacy.visibility, text: t.privacy.visibilityText },
        { title: t.privacy.dataSharing, text: t.privacy.dataSharingText },
        { title: t.privacy.accountDeletion, text: t.privacy.accountDeletionText },
      ]
    }
  }

  const { title, icon: Icon, sections } = content[type]

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div 
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-hidden shadow-xl" 
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[70vh] space-y-4">
          {sections.map((s, i) => (
            <div key={i}>
              <h4 className="font-semibold text-gray-900 mb-1">{s.title}</h4>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MenuItem({ icon: Icon, label }: { icon: any, label: string }) {
  return (
    <button className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-gray-400" />
        <span className="font-medium text-gray-900">{label}</span>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400" />
    </button>
  )
}

export default App



