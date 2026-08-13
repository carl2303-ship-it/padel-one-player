import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { supabase, PlayerAccount } from './lib/supabase'
import { useI18n } from './lib/i18nContext'
import PlayerLandingPage from './components/PlayerLandingPage'
import ClubLandingPage from './components/ClubLandingPage'
import PlayerLadderTournamentPanel from './components/PlayerLadderTournamentPanel'
import {
  fetchPlayerDashboardData,
  enrichDashboardWithEdgeFunction,
  type PlayerDashboardData,
} from './lib/playerDashboardData'
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
import { fetchAllClubs, fetchClubById, fetchUpcomingTournaments, fetchTournamentsByIds, fetchTournamentEnrolledCounts, fetchEnrolledByCategory, fetchTournamentFullDetail, getTournamentRegistrationUrl, fetchMyTournamentInvites, updateTournamentInviteStatus, fetchPlayerClubs, togglePlayerClub, fetchNearbyFullClubs, updatePlayerLocation, requestBrowserGeolocation, type ClubDetail, type UpcomingTournamentFromTour, type EnrolledByCategory, type TournamentFullDetail, type NearbyFullClub } from './lib/clubAndTournaments'
import { fetchAvailableClasses, fetchMyClasses, enrollInClass, type Class as ClassData } from './lib/classes'
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
import { normalizePhone, isValidPhone } from './lib/phoneUtils'
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
    fetchClientModules('club', player.favorite_club_id).then(setClientModules)
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
          console.log('[App] Foreground refresh triggered')
          const data = await fetchPlayerDashboardData(player.user_id)
          setDashboardData(data)
          enrichDashboardWithEdgeFunction(data).then(enriched => {
            if (enriched) {
              setEdgeEnrichedData(enriched)
              setDashboardData(prev => prev ? { ...prev, ...enriched } : prev)
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
        console.log('[Auth] Session expired, clearing local state for re-login')
      }
      setIsLoading(false)
      return
    }

    // Priority 1: Find player by saved phone (most reliable - user's actual phone)
    const savedPhone = localStorage.getItem('padel_one_player_phone')
    if (savedPhone) {
      const { data } = await supabase
        .from('player_accounts')
        .select('*')
        .eq('phone_number', savedPhone)
        .maybeSingle()

      if (data) {
        setPlayer(data as any)
        setIsAuthenticated(true)
        setAuthUserId(authUid || data.user_id || null)
        fetchPlayerClubs(data.id).then(ids => setPlayer(prev => prev ? { ...prev, club_ids: ids } as any : prev))
        if (data.user_id) {
          const [dash] = await Promise.all([
            fetchPlayerDashboardData(data.user_id, {
              id: data.id,
              name: data.name,
              phone_number: data.phone_number,
            }),
            preloadAllPlayerData(),
          ])
          setDashboardData(dash)
          enrichDashboardWithEdgeFunction(dash).then(enriched => {
            if (enriched) {
              setEdgeEnrichedData(enriched)
              setDashboardData(prev => prev ? { ...prev, ...enriched } : prev)
            }
          })
        }
        setIsLoading(false)
        return
      }
    }

    // Priority 2: Find player by auth session user_id (only if phone lookup failed)
    if (session?.user) {
      const { data: playerAccount } = await supabase
        .from('player_accounts')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (playerAccount) {
        setPlayer(playerAccount as any)
        setAuthUserId(session.user.id)
        setIsAuthenticated(true)
        fetchPlayerClubs(playerAccount.id).then(ids => setPlayer(prev => prev ? { ...prev, club_ids: ids } as any : prev))
        const [data] = await Promise.all([
          fetchPlayerDashboardData(session.user.id, {
            id: playerAccount.id,
            name: playerAccount.name,
            phone_number: playerAccount.phone_number,
          }),
          preloadAllPlayerData(),
        ])
        setDashboardData(data)
        enrichDashboardWithEdgeFunction(data).then(enriched => {
          if (enriched) {
            setEdgeEnrichedData(enriched)
            setDashboardData(prev => prev ? { ...prev, ...enriched } : prev)
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
    if (session?.user) {
      const data = await fetchPlayerDashboardData(session.user.id)
      setDashboardData(data)
      // Enrich with Edge Function in background
      enrichDashboardWithEdgeFunction(data).then(enriched => {
        if (enriched) {
          setEdgeEnrichedData(enriched)
          setDashboardData(prev => prev ? { ...prev, ...enriched } : prev)
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
      const { data: phoneAccount } = await supabase
        .from('player_accounts')
        .select('*')
        .eq('phone_number', normalizedPhone)
        .maybeSingle()
      
      playerAccount = phoneAccount

      // Fallback: buscar pelo auth user_id se telefone não encontrou
      if (!playerAccount && authData?.user) {
        const { data: authAccount } = await supabase
          .from('player_accounts')
          .select('*')
          .eq('user_id', authData.user.id)
          .maybeSingle()
        playerAccount = authAccount
      }

      localStorage.setItem('padel_one_player_phone', normalizedPhone)

      if (playerAccount) {
        setPlayer(playerAccount as any)
        setAuthUserId(authData?.user?.id || playerAccount.user_id || null)
        fetchPlayerClubs(playerAccount.id).then(ids => setPlayer(prev => prev ? { ...prev, club_ids: ids } as any : prev))
        if (playerAccount.user_id) {
          const [data] = await Promise.all([
            fetchPlayerDashboardData(playerAccount.user_id, {
              id: playerAccount.id,
              name: playerAccount.name,
              phone_number: playerAccount.phone_number,
            }),
            preloadAllPlayerData(),
          ])
          setDashboardData(data)
          enrichDashboardWithEdgeFunction(data).then(enriched => {
            if (enriched) {
              setEdgeEnrichedData(enriched)
              setDashboardData(prev => prev ? { ...prev, ...enriched } : prev)
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
  // Edge enriquece stats/visibilidade; nomes das bolinhas preferem resolução client (RPC + player_accounts)
  // NOTA: Este useMemo TEM de estar ANTES de qualquer return condicional (Rules of Hooks)
  const effectiveDashboard = useMemo(() => {
    if (!dashboardData) return null
    if (!edgeEnrichedData) return dashboardData
    return { ...dashboardData, ...edgeEnrichedData }
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
        if (pa.user_id) {
          const [data] = await Promise.all([
            fetchPlayerDashboardData(pa.user_id, { id: pa.id, name: pa.name, phone_number: pa.phone_number }),
            preloadAllPlayerData(),
          ])
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
            userId={player?.user_id ?? null}
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
          <RankingsScreen
            userId={player?.user_id ?? null}
            playerAccountId={player?.id ?? null}
            onBack={() => setCurrentScreen('home')}
            onOpenPlayerProfile={(uid: string, opts) => openPlayerProfile(uid, opts)}
          />
        )}
        {currentScreen === 'booking' && canBook && (
          <BookingScreen
            player={player}
            userId={player?.user_id ?? null}
            onBack={() => setCurrentScreen('home')}
            onOpenPlayerProfile={(uid: string, opts) => openPlayerProfile(uid, opts)}
            onRefresh={refreshDashboard}
          />
        )}
        {currentScreen === 'games' && (
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
        )}
        {currentScreen === 'club' && (
          <ClubScreen
            favoriteClubId={player?.favorite_club_id ?? null}
            onBack={() => setCurrentScreen('home')}
          />
        )}
        {currentScreen === 'compete' && (
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
          />
        )}
        {currentScreen === 'learn' && canLearn && (
          <LearnScreen
            userId={player?.user_id ?? null}
            playerAccountId={player?.id ?? null}
            onBack={() => setCurrentScreen('home')}
            onOpenPlayerProfile={(uid: string, opts) => openPlayerProfile(uid, opts)}
            onOpenClub={(clubId: string) => { setSelectedClubId(clubId); setCurrentScreen('club-detail') }}
          />
        )}
        {currentScreen === 'find-game' && canFindGame && (
          <FindGameScreen
            player={player}
            userId={authUserId || player?.user_id || null}
            onBack={() => { const wasGroup = !!createGameForGroupId; setCreateGameForGroupId(null); setCurrentScreen(wasGroup ? 'group-detail' : 'home') }}
            onOpenPlayerProfile={(uid: string, opts) => openPlayerProfile(uid, opts)}
            onRefresh={refreshDashboard}
            groupId={createGameForGroupId}
          />
        )}
        {currentScreen === 'game-results' && (
          <FindGameScreen
            player={player}
            userId={authUserId || player?.user_id || null}
            onBack={() => setCurrentScreen('home')}
            onOpenPlayerProfile={(uid: string, opts) => openPlayerProfile(uid, opts)}
            onRefresh={refreshDashboard}
            resultsOnly
          />
        )}
        {currentScreen === 'clubs-list' && !isLiteMode && (
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
        )}
        {currentScreen === 'club-detail' && selectedClubId && (
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
        )}
        {currentScreen === 'profile-view' && (
          <ProfileViewScreen
            player={player}
            dashboardData={effectiveDashboard}
            userId={player?.user_id ?? null}
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
          <RewardsScreen
            player={player}
            onBack={() => setCurrentScreen('home')}
          />
        )}

        {currentScreen === 'payments' && player && (
          <PaymentsScreen
            player={player}
            userId={authUserId}
            onBack={() => setCurrentScreen('home')}
          />
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

function formatDate(s: string) {
  const d = new Date(s)
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
}
function formatDateTime(s: string) {
  const d = new Date(s)
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function formatDateWithTime(s: string) {
  const d = new Date(s)
  const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${date} | ${time}`
}
function initialFor(name: string): string {
  const t = name.trim()
  if (!t) return '?'
  // Display names like "Carlos/Padel1/BoostPadel" — use first segment only for initials
  const primary = t.split(/\s*\/\s*/)[0]?.trim() || t
  const words = primary.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase().slice(0, 2)
  return primary.slice(0, 2).toUpperCase()
}

/** Short label under bubble — avoid showing "Carlos/Padel1/BoostPadel" as if it were 3 players */
function shortPlayerLabel(name: string): string {
  const t = (name || '').trim()
  if (!t || t === '?') return t || '?'
  const primary = t.split(/\s*\/\s*/)[0]?.trim() || t
  const words = primary.split(/\s+/).filter(Boolean)
  if (words.length <= 2) return primary
  return `${words[0]} ${words[words.length - 1][0]}.`
}

// Tipos para os dados integrados do Tour (PlayerMatch = formato do dashboardData)
type PlayerMatchForCard = import('./lib/playerDashboardData').PlayerMatch
type TournamentForCard = import('./lib/playerDashboardData').TournamentSummary

function OpenGameResultScores({ result }: { result: import('./lib/openGames').OpenGameResult }) {
  const s1 = [result.team1_score_set1 || 0, result.team2_score_set1 || 0]
  const s2 = [result.team1_score_set2 || 0, result.team2_score_set2 || 0]
  const s3 = [result.team1_score_set3 || 0, result.team2_score_set3 || 0]
  const sets1 = (s1[0] > s1[1] ? 1 : 0) + (s2[0] > s2[1] ? 1 : 0) + (s3[0] > s3[1] ? 1 : 0)
  const sets2 = (s1[1] > s1[0] ? 1 : 0) + (s2[1] > s2[0] ? 1 : 0) + (s3[1] > s3[0] ? 1 : 0)
  const team1Won = sets1 > sets2
  const sets = [s1, s2, ...(s3[0] > 0 || s3[1] > 0 ? [s3] : [])]

  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className={`flex-1 text-center ${team1Won ? 'font-bold text-green-700' : 'text-gray-500'}`}>
          <span className="text-xs">Eq. 1 {team1Won ? '🏆' : ''}</span>
        </div>
        <div className="w-8" />
        <div className={`flex-1 text-center ${!team1Won ? 'font-bold text-green-700' : 'text-gray-500'}`}>
          <span className="text-xs">Eq. 2 {!team1Won ? '🏆' : ''}</span>
        </div>
      </div>
      <div className="flex items-center justify-center gap-3">
        {sets.map((s, i) => (
          <div key={i} className="text-center">
            <p className="text-[9px] text-gray-400">Set {i + 1}</p>
            <p className="text-sm font-bold text-gray-800">{s[0]} - {s[1]}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 text-center mt-1">Submetido pela Equipa {result.submitted_by_team}</p>
    </div>
  )
}

function ActionButton({ icon: Icon, label, color, onClick, emoji }: {
  icon: any
  label: string
  color: 'lime' | 'blue' | 'amber' | 'purple' | 'emerald' | 'rose'
  onClick?: () => void
  emoji?: string
}) {
  const colorClasses = {
    lime: 'bg-lime-400',
    blue: 'bg-blue-400',
    amber: 'bg-amber-400',
    purple: 'bg-purple-400',
    emerald: 'bg-emerald-400',
    rose: 'bg-rose-400',
  }
  return (
    <button type="button" onClick={onClick} className="action-btn">
      <div className={`action-btn-icon ${colorClasses[color]} flex items-center justify-center`}>
        {emoji ? <span className="text-2xl">{emoji}</span> : <Icon className="w-6 h-6 text-white" />}
      </div>
      <span className="text-xs font-medium text-gray-700">{label}</span>
    </button>
  )
}

function MatchCard({ match }: { match: PlayerMatchForCard }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900">{match.tournament_name}</p>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {match.start_time ? formatDate(match.start_time) : '-'}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {t.common.court} {match.court || '-'}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{match.team1_name} vs {match.team2_name}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>
    </div>
  )
}

/** Parseia "6-2" em [6, 2] para exibir sets ao estilo Playtomic */
function parseSetScores(setStr: string): [string, string] | null {
  if (!setStr?.includes('-')) return null
  const [a, b] = setStr.split('-').map((s) => s.trim())
  return a != null && b != null ? [a, b] : null
}

function isCurrentPlayer(playerName: string, currentName?: string): boolean {
  if (!currentName) return false
  const p = (playerName || '').trim().toLowerCase()
  const c = (currentName || '').trim().toLowerCase()
  if (!p || !c) return false
  if (p === c) return true
  const pPrimary = p.split(/\s*\/\s*/)[0]
  const cPrimary = c.split(/\s*\/\s*/)[0]
  if (pPrimary === cPrimary) return true
  // Match parcial: "Guilherme" vs "Guilherme Silva" ou vice-versa
  return p.startsWith(c) || c.startsWith(p) || pPrimary.startsWith(cPrimary) || cPrimary.startsWith(pPrimary)
}

function PlayerCircle({ name, bgClass, textClass, avatarUrl, currentPlayerName, onClick }: {
  name: string
  bgClass: string
  textClass: string
  avatarUrl?: string | null
  currentPlayerName?: string
  onClick?: () => void
}) {
  // Sempre mostrar avatar se existir, independentemente de ser o jogador atual
  const showAvatar = !!avatarUrl
  return (
    <div 
      className={`w-16 h-16 rounded-full flex items-center justify-center shadow-sm flex-shrink-0 overflow-hidden ${!showAvatar ? bgClass : ''} ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
      title={name}
      onClick={onClick}
    >
      {showAvatar ? (
        <img src={avatarUrl!} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className={textClass}>{initialFor(name)}</span>
      )}
    </div>
  )
}

/** Card ao estilo Playtomic: layout vertical – equipa 1 em cima, resultado no meio, equipa 2 em baixo; nomes abaixo de cada bolinha; troféu ao lado do resultado da equipa vencedora */
function GameCardPlaytomic({ 
  match, 
  fullWidth, 
  currentPlayerAvatar, 
  currentPlayerName,
  onPlayerClick 
}: { 
  match: PlayerMatchForCard
  fullWidth?: boolean
  currentPlayerAvatar?: string | null
  currentPlayerName?: string
  onPlayerClick?: (playerName: string) => void
}) {
  const { t } = useI18n()
  const [n1, n2, n3, n4] = resolveFourPlayerNames(match)
  const matchAvatars = [
    (match as any).player1_avatar as string | null | undefined,
    (match as any).player2_avatar as string | null | undefined,
    (match as any).player3_avatar as string | null | undefined,
    (match as any).player4_avatar as string | null | undefined,
  ]
  
  const setStrings = [match.set1, match.set2, match.set3].filter(Boolean) as string[]
  const parsedSets = setStrings.map(parseSetScores)
  const hasSets = parsedSets.some(Boolean)
  const isTournament = Boolean(match.tournament_id && match.tournament_name)
  const team1Scores = parsedSets.map((p) => (p ? p[0] : '-'))
  const team2Scores = parsedSets.map((p) => (p ? p[1] : '-'))
  const team1Won = match.status === 'completed' && match.score1 != null && match.score2 != null && match.score1 > match.score2
  const team2Won = match.status === 'completed' && match.score1 != null && match.score2 != null && match.score2 > match.score1
  const numSets = setStrings.length
  const scoreContainerW = numSets >= 3 ? 'min-w-[100px]' : 'w-[80px]'
  const scoreFontSize = numSets >= 3 ? 'text-base' : 'text-2xl'
  
  // Função para renderizar jogador com nível (dados do cache global — sem queries)
  const renderPlayer = (name: string, bgClass: string, textClass: string, matchAvatar?: string | null) => {
    const isPlaceholder = !name || name === '?' || isLikelyTeamLabel(name)
    const cached = !isPlaceholder ? getCachedPlayerData(name) : null
    const level = cached?.level ?? undefined
    const colors = levelColors(level)
    const avatarUrl =
      matchAvatar ||
      cached?.avatar_url ||
      (!isPlaceholder && isCurrentPlayer(name, currentPlayerName) ? currentPlayerAvatar : null) ||
      null
    const canOpenProfile = Boolean(onPlayerClick && !isPlaceholder)

    return (
      <div className="flex flex-col items-center min-h-[96px]">
        <PlayerCircle 
          name={isPlaceholder ? '?' : name} 
          bgClass={bgClass} 
          textClass={textClass} 
          avatarUrl={avatarUrl} 
          currentPlayerName={currentPlayerName}
          onClick={canOpenProfile ? () => onPlayerClick!(name) : undefined}
        />
        <span className="text-[11px] text-gray-700 font-medium truncate max-w-[90px] mt-1.5 text-center leading-tight" title={isPlaceholder ? undefined : name}>
          {isPlaceholder ? '—' : shortPlayerLabel(name)}
        </span>
        {level !== undefined && (
          <div 
            className="mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: colors?.hex || '#9ca3af' }}
            title={`Nível ${level.toFixed(2)}`}
          >
            {level.toFixed(2)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`rounded-2xl bg-white border border-gray-100 shadow-md overflow-hidden ${fullWidth ? 'w-full' : 'flex-shrink-0 w-[360px] sm:w-[400px]'}`}>
      <div className="p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-medium text-gray-500">
            {match.start_time ? formatDateWithTime(match.start_time) : '-'}
          </span>
          {match.is_open_game && match.club_name ? (
            <span className="flex items-center gap-1 text-blue-600" title={match.club_name}>
              <Building2 className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-medium truncate max-w-[120px]">{match.club_name}</span>
            </span>
          ) : isTournament && (
            <span className="flex items-center gap-1 text-amber-600" title={match.tournament_name}>
              <Trophy className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-medium truncate max-w-[120px]">{match.tournament_name}</span>
            </span>
          )}
        </div>

        {/* Layout: grid 2x2 bolinhas alinhadas no topo; resultados à direita; linha fina divide equipas */}
        <div className="flex flex-col">
          {/* Equipa 1 – laranja */}
          <div className="flex items-start justify-between gap-4">
            <div className="grid grid-cols-2 gap-x-5 gap-y-0 flex-1 items-start">
              {renderPlayer(n1, 'bg-orange-400', 'text-2xl font-bold text-white', matchAvatars[0])}
              {renderPlayer(n2, 'bg-orange-400', 'text-2xl font-bold text-white', matchAvatars[1])}
            </div>
            {match.status === 'completed' && (hasSets || match.score1 != null) && (
              <div className={`flex items-center gap-1 flex-shrink-0 ${scoreContainerW} justify-end whitespace-nowrap`}>
                <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
                  {team1Won && <span className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center text-xs" title={t.games.winnerTeam}>🏆</span>}
                </span>
                <span className={team1Won ? `${scoreFontSize} font-bold text-gray-900` : `${scoreFontSize} font-medium text-gray-400`}>
                  {hasSets ? team1Scores.join(' ') : match.score1}
                </span>
              </div>
            )}
          </div>

          {/* Linha fina a dividir equipa 1 da equipa 2 */}
          <div className="border-t border-gray-200/60 my-2" />

          {/* Equipa 2 – azul claro (grid igual para alinhar com equipa 1) */}
          <div className="flex items-start justify-between gap-4">
            <div className="grid grid-cols-2 gap-x-5 gap-y-0 flex-1 items-start">
              {renderPlayer(n3, 'bg-sky-200', 'text-2xl font-bold text-sky-800', matchAvatars[2])}
              {renderPlayer(n4, 'bg-sky-200', 'text-2xl font-bold text-sky-800', matchAvatars[3])}
            </div>
            {match.status === 'completed' && (hasSets || match.score1 != null) && (
              <div className={`flex items-center gap-1 flex-shrink-0 ${scoreContainerW} justify-end whitespace-nowrap`}>
                <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
                  {team2Won && <span className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center text-xs" title={t.games.winnerTeam}>🏆</span>}
                </span>
                <span className={team2Won ? `${scoreFontSize} font-bold text-gray-900` : `${scoreFontSize} font-medium text-gray-400`}>
                  {hasSets ? team2Scores.join(' ') : match.score2}
                </span>
              </div>
            )}
          </div>

          {/* Para jogos por jogar: hora/court centrado se não há resultados */}
          {match.status !== 'completed' && (
            <div className="text-xs text-gray-500 text-center mt-1">
              {match.start_time ? formatDateWithTime(match.start_time).split(' | ')[1] : ''}
              {match.court ? ` · ${t.games.courtShort}${match.court}` : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TournamentCard({
  tournament,
  onClick,
}: {
  tournament: TournamentForCard
  onClick?: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="card overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" onClick={onClick}>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 line-clamp-1">{tournament.name}</h3>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(tournament.start_date)}
              </span>
              {tournament.enrolled_count !== undefined && (
                <span className="text-xs text-red-600">{tournament.enrolled_count} inscritos</span>
              )}
            </div>
          </div>
          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
            tournament.status === 'active' || tournament.status === 'in_progress'
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {tournament.status === 'active' || tournament.status === 'in_progress' ? t.games.inProgress : tournament.status}
          </span>
        </div>
      </div>
    </div>
  )
}

// ==================== OPEN GAME CARD (for upcoming matches) ====================

function OpenGameCard({ 
  gameId, 
  match, 
  userId, 
  playerAccountId, 
  onRefresh,
  fullWidth 
}: { 
  gameId: string
  match: PlayerMatchForCard
  userId?: string | null
  playerAccountId?: string | null
  onRefresh: () => Promise<void>
  fullWidth?: boolean
}) {
  const { t } = useI18n()
  const [game, setGame] = useState<import('./lib/openGames').OpenGame | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [addPlayerTargetPosition, setAddPlayerTargetPosition] = useState<number | null>(null)
  const [addPlayerSearch, setAddPlayerSearch] = useState('')
  const [addPlayerResults, setAddPlayerResults] = useState<{ id: string; name: string; avatar_url: string | null; level: number | null; player_category: string | null }[]>([])
  const [addingPlayer, setAddingPlayer] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    const fetchGame = async () => {
      const { supabase } = await import('./lib/supabase')
      const { data } = await supabase
        .from('open_games')
        .select('*')
        .eq('id', gameId)
        .maybeSingle()

      if (data) {
        // Fetch players
        const { data: playersData } = await supabase
          .from('open_game_players')
          .select('*')
          .eq('game_id', gameId)
          .eq('status', 'confirmed')
          .order('position')

        // Fetch player account details — buscar por user_id E por player_account_id
        const userIds = [...new Set((playersData || []).map((p: any) => p.user_id).filter(Boolean))]
        const playerAccountIds = [...new Set((playersData || []).map((p: any) => p.player_account_id).filter(Boolean))]
        let playerAccountsMap: { [key: string]: any } = {}

        if (userIds.length > 0 || playerAccountIds.length > 0) {
          const allIds = [...new Set([...playerAccountIds])]
          const queries: Promise<any>[] = []

          if (allIds.length > 0) {
            queries.push(
              supabase.from('player_accounts').select('id, user_id, name, avatar_url, level, player_category').in('id', allIds)
            )
          }
          if (userIds.length > 0) {
            queries.push(
              supabase.from('player_accounts').select('id, user_id, name, avatar_url, level, player_category').in('user_id', userIds)
            )
          }

          const results = await Promise.all(queries)
          results.forEach(({ data: accounts }) => {
            if (accounts) {
              accounts.forEach((a: any) => {
                if (a.user_id) playerAccountsMap[a.user_id] = a
                playerAccountsMap[a.id] = a
              })
            }
          })
        }

        // Enrich players data
        const enrichedPlayers = (playersData || []).map((p: any) => {
          const account = playerAccountsMap[p.player_account_id] || playerAccountsMap[p.user_id]
          return {
            ...p,
            name: account?.name || p.name || t.common.player,
            avatar_url: account?.avatar_url || null,
            level: account?.level || null,
            player_category: account?.player_category || null,
          }
        })

        // Fetch club data
        const { data: clubData } = await supabase
          .from('clubs')
          .select('name, logo_url, city, payment_method')
          .eq('id', data.club_id)
          .single()

        // Fetch court data
        let courtData = null
        if (data.court_id) {
          const { data: courtResult } = await supabase
            .from('club_courts')
            .select('name, type')
            .eq('id', data.court_id)
            .single()
          courtData = courtResult
        }

        setGame({
          ...data,
          club_name: clubData?.name || '',
          club_logo_url: clubData?.logo_url || null,
          club_city: clubData?.city || null,
          court_name: courtData?.name || null,
          court_type: courtData?.type || null,
          players: enrichedPlayers,
          club_payment_method: clubData?.payment_method || 'at_club',
        })
      }
      setLoading(false)
    }

    fetchGame()
    const onVis = () => {
      if (document.visibilityState === 'visible') fetchGame()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [gameId])

  if (loading || !game) {
    return (
      <div className={`border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm ${fullWidth ? 'w-full' : 'flex-shrink-0 w-[360px] sm:w-[400px]'}`}>
        <div className="p-5 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
          <div className="flex gap-3 justify-center mb-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="w-16 h-16 bg-gray-200 rounded-full"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const confirmedPlayers = game.players.filter(p => p.status === 'confirmed')
  const isInGame = game.players.some(p => p.user_id === userId || p.player_account_id === playerAccountId)
  const isCreator = game.creator_user_id === userId || game.players.some(p => p.position === 1 && (p.user_id === userId || p.player_account_id === playerAccountId))

  const refetchGame = async () => {
    const { supabase } = await import('./lib/supabase')
    const { data } = await supabase.from('open_games').select('*').eq('id', gameId).maybeSingle()
    if (data) {
      const { data: playersData } = await supabase
        .from('open_game_players')
        .select('*')
        .eq('game_id', gameId)
        .eq('status', 'confirmed')
        .order('position')
      const uIds = [...new Set((playersData || []).map((p2: any) => p2.user_id).filter(Boolean))]
      const paIds = [...new Set((playersData || []).map((p2: any) => p2.player_account_id).filter(Boolean))]
      let acctMap: { [key: string]: any } = {}
      if (uIds.length > 0 || paIds.length > 0) {
        const rQueries: Promise<any>[] = []
        if (paIds.length > 0) rQueries.push(supabase.from('player_accounts').select('id, user_id, name, avatar_url, level, player_category').in('id', paIds))
        if (uIds.length > 0) rQueries.push(supabase.from('player_accounts').select('id, user_id, name, avatar_url, level, player_category').in('user_id', uIds))
        const rResults = await Promise.all(rQueries)
        rResults.forEach(({ data: accts }) => { if (accts) accts.forEach((a: any) => { if (a.user_id) acctMap[a.user_id] = a; acctMap[a.id] = a }) })
      }
      const enriched = (playersData || []).map((p2: any) => {
        const acct = acctMap[p2.player_account_id] || acctMap[p2.user_id]
        return { ...p2, name: acct?.name || t.common.player, avatar_url: acct?.avatar_url || null, level: acct?.level || null, player_category: acct?.player_category || null }
      })
      const { data: clubData } = await supabase.from('clubs').select('name, logo_url, city, payment_method').eq('id', data.club_id).single()
      let courtData2 = null
      if (data.court_id) {
        const { data: cr } = await supabase.from('club_courts').select('name, type').eq('id', data.court_id).single()
        courtData2 = cr
      }
      setGame({
        ...data,
        club_name: clubData?.name || '',
        club_logo_url: clubData?.logo_url || null,
        club_city: clubData?.city || null,
        court_name: courtData2?.name || null,
        court_type: courtData2?.type || null,
        players: enriched,
        club_payment_method: clubData?.payment_method || 'at_club',
      })
    }
  }

  const handleRemovePlayerFromGame = async (p: any) => {
    const playerName = (p.name || '').split(' ')[0] || t.common.player
    if (!confirm((t.games.removePlayerConfirm || 'Remover {name} do jogo?').replace('{name}', playerName))) return
    setActionLoading(true)
    const { removePlayerFromOpenGame } = await import('./lib/openGames')
    const success = await removePlayerFromOpenGame({
      gameId: game.id,
      playerId: p.id,
      playerAccountId: p.player_account_id,
      playerName: p.name,
    })
    setActionLoading(false)
    if (success) {
      await refetchGame()
      await onRefresh()
    } else {
      alert(t.games.removePlayerError || 'Erro ao remover jogador')
    }
  }

  const handleLeaveGame = async () => {
    if (!confirm(t.games.leaveConfirm)) return
    setActionLoading(true)
    const { leaveOpenGame } = await import('./lib/openGames')
    const success = await leaveOpenGame(game.id, userId || '')
    setActionLoading(false)
    if (success) {
      await onRefresh()
    } else {
      alert(t.common.leaveGameError)
    }
  }

  const handleCancelGame = async () => {
    if (!confirm(t.games.cancelConfirm)) return
    setActionLoading(true)
    const { cancelOpenGame } = await import('./lib/openGames')
    const success = await cancelOpenGame(game.id)
    setActionLoading(false)
    if (success) {
      await onRefresh()
    } else {
      alert(t.common.cancelGameError)
    }
  }

  const handleLeaveGameCreator = async () => {
    if (!confirm(t.games.leaveConfirmCreator)) return
    setActionLoading(true)
    const { leaveOpenGame } = await import('./lib/openGames')
    const success = await leaveOpenGame(game.id, userId || '')
    setActionLoading(false)
    if (success) {
      await onRefresh()
    } else {
      alert(t.common.leaveGameError)
    }
  }

  const handleSearchPlayer = async (query: string) => {
    setAddPlayerSearch(query)
    if (query.length < 2) {
      setAddPlayerResults([])
      return
    }
    setSearchLoading(true)
    const { searchPlayerAccounts } = await import('./lib/openGames')
    const results = await searchPlayerAccounts(query)
    // Filter out players already in the game
    const existingIds = new Set(game.players.map(p => p.player_account_id).filter(Boolean))
    setAddPlayerResults(results.filter(r => !existingIds.has(r.id)))
    setSearchLoading(false)
  }

  const handleAddPlayer = async (paId: string) => {
    const selectedPlayer = addPlayerResults.find(r => r.id === paId)
    console.log('[AddPlayer] clicked:', { paId, selectedName: selectedPlayer?.name, targetPosition: addPlayerTargetPosition, allResults: addPlayerResults.map(r => ({ id: r.id, name: r.name })) })
    setAddingPlayer(true)
    const { addPlayerToOpenGame } = await import('./lib/openGames')
    const result = await addPlayerToOpenGame({ gameId: game.id, playerAccountId: paId, position: addPlayerTargetPosition ?? undefined })
    setAddingPlayer(false)
    if (result.success) {
      setShowAddPlayer(false)
      setAddPlayerTargetPosition(null)
      setAddPlayerSearch('')
      setAddPlayerResults([])
      await refetchGame()
      await onRefresh()
    } else {
      alert(result.error || t.common.addPlayerError)
    }
  }

  const formatGameDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const isTomorrow = d.toDateString() === new Date(now.getTime() + 86400000).toDateString()

    const dayStr = isToday ? 'Hoje' : isTomorrow ? 'Amanhã' : d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
    const timeStr = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
    return `${dayStr}, ${timeStr}`
  }

  return (
    <div className={`border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm ${fullWidth ? 'w-full' : 'flex-shrink-0 w-[360px] sm:w-[400px]'}`}>
      <div className="p-5">
        {/* Date & Time */}
        <p className="font-bold text-gray-900 text-sm mb-1">
          {formatGameDate(game.scheduled_at)}
        </p>
        
        {/* Game Type & Level Range */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3 flex-wrap">
          <span className="flex items-center gap-1">
            {game.game_type === 'competitive' ? '🏆' : '🤝'}
          </span>
          <span className="flex items-center gap-1">
            📊 {game.level_min.toFixed(2)}-{game.level_max.toFixed(2)}
          </span>
        </div>

        {/* Player circles */}
        <div className="flex items-start gap-3 mb-3">
          {/* Left team - Positions 1 and 2 */}
          <div className="flex gap-3 flex-1 justify-center">
            {[1, 2].map(pos => {
              const p = confirmedPlayers.find(pl => pl.position === pos)
              if (p) {
                const pColors = levelColors(p.level)
                const isMe = p.user_id === userId || p.player_account_id === playerAccountId
                const canRemove = isCreator && !isMe && !actionLoading
                return (
                  <div key={p.id} className="flex flex-col items-center relative group">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    {canRemove && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemovePlayerFromGame(p) }}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                        title={t.games.removePlayer}
                      >
                        ✕
                      </button>
                    )}
                    <span className="text-[11px] text-gray-700 font-medium mt-1.5 truncate max-w-[70px] text-center leading-tight" title={p.name}>{p.name || ''}</span>
                    {p.level != null && (
                      <div className="mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: pColors?.hex || '#9ca3af' }}>
                        {p.level.toFixed(2)}
                      </div>
                    )}
                  </div>
                )
              } else {
                return (
                  <div 
                    key={`empty-${pos}`} 
                    className={`flex flex-col items-center ${isInGame ? 'cursor-pointer' : ''}`}
                    onClick={isInGame ? () => { setAddPlayerTargetPosition(pos); setShowAddPlayer(true) } : undefined}
                  >
                    <div className={`w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center transition-colors ${isInGame ? 'border-blue-400 hover:border-blue-500 hover:bg-blue-50' : 'border-gray-300'}`}>
                      <UserPlus className={`w-6 h-6 ${isInGame ? 'text-blue-500' : 'text-gray-400'}`} />
                    </div>
                    <span className={`text-[10px] font-medium mt-1.5 ${isInGame ? 'text-blue-600' : 'text-gray-400'}`}>{isInGame ? t.common.add : t.common.free}</span>
                  </div>
                )
              }
            })}
          </div>
          
          {/* Divider */}
          <div className="w-px h-20 bg-gray-200 self-center" />
          
          {/* Right team - Positions 3 and 4 */}
          <div className="flex gap-3 flex-1 justify-center">
            {[3, 4].map(pos => {
              const p = confirmedPlayers.find(pl => pl.position === pos)
              if (p) {
                const pColors = levelColors(p.level)
                const isMe = p.user_id === userId || p.player_account_id === playerAccountId
                const canRemove = isCreator && !isMe && !actionLoading
                return (
                  <div key={p.id} className="flex flex-col items-center relative group">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    {canRemove && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemovePlayerFromGame(p) }}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                        title={t.games.removePlayer}
                      >
                        ✕
                      </button>
                    )}
                    <span className="text-[11px] text-gray-700 font-medium mt-1.5 truncate max-w-[70px] text-center leading-tight" title={p.name}>{p.name || ''}</span>
                    {p.level != null && (
                      <div className="mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: pColors?.hex || '#9ca3af' }}>
                        {p.level.toFixed(2)}
                      </div>
                    )}
                  </div>
                )
              } else {
                return (
                  <div 
                    key={`empty-${pos}`} 
                    className={`flex flex-col items-center ${isInGame ? 'cursor-pointer' : ''}`}
                    onClick={isInGame ? () => { setAddPlayerTargetPosition(pos); setShowAddPlayer(true) } : undefined}
                  >
                    <div className={`w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center transition-colors ${isInGame ? 'border-blue-400 hover:border-blue-500 hover:bg-blue-50' : 'border-gray-300'}`}>
                      <UserPlus className={`w-6 h-6 ${isInGame ? 'text-blue-500' : 'text-gray-400'}`} />
                    </div>
                    <span className={`text-[10px] font-medium mt-1.5 ${isInGame ? 'text-blue-600' : 'text-gray-400'}`}>{isInGame ? t.common.add : t.common.free}</span>
                  </div>
                )
              }
            })}
          </div>
        </div>
      </div>

      {/* Add Player Search Panel */}
      {showAddPlayer && (
        <div className="border-t border-gray-100 px-4 py-3 bg-blue-50/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-700">
              {t.games.addPlayer ?? 'Adicionar jogador'}
              {addPlayerTargetPosition != null && (
                <span className="ml-1 text-blue-600">
                  ({addPlayerTargetPosition <= 2 ? t.games.team1 ?? 'Equipa 1' : t.games.team2 ?? 'Equipa 2'})
                </span>
              )}
            </p>
            <button 
              onClick={() => { setShowAddPlayer(false); setAddPlayerTargetPosition(null); setAddPlayerSearch(''); setAddPlayerResults([]) }}
              className="text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar por nome..."
              value={addPlayerSearch}
              onChange={(e) => handleSearchPlayer(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              autoFocus
            />
          </div>
          {searchLoading && (
            <p className="text-xs text-gray-500 mt-2 text-center">{t.games.searching}</p>
          )}
          {addPlayerResults.length > 0 && (
            <div className="mt-2 max-h-[150px] overflow-y-auto space-y-1">
              {addPlayerResults.map(r => {
                const rColors = levelColors(r.level)
                return (
                  <button
                    key={r.id}
                    onClick={() => handleAddPlayer(r.id)}
                    disabled={addingPlayer}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-blue-100 transition-colors text-left disabled:opacity-50"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {r.avatar_url ? (
                        <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-gray-600">{r.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                    </div>
                    {r.level != null && (
                      <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: rColors?.hex || '#9ca3af' }}>
                        {r.level.toFixed(2)}
                      </span>
                    )}
                    <UserPlus className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  </button>
                )
              })}
            </div>
          )}
          {addPlayerSearch.length >= 2 && !searchLoading && addPlayerResults.length === 0 && (
            <p className="text-xs text-gray-500 mt-2 text-center">{t.games.noPlayersFound}</p>
          )}
        </div>
      )}

      {/* Club & Price footer */}
      <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-2">
          {game.club_logo_url ? (
            <img src={game.club_logo_url} alt="" className="w-6 h-6 rounded-lg object-cover" />
          ) : (
            <div className="w-6 h-6 rounded-lg bg-gray-200 flex items-center justify-center">
              <Building2 className="w-3 h-3 text-gray-400" />
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-gray-900 truncate max-w-[120px]">{game.club_name}</p>
          </div>
        </div>
        <div className="text-right">
          {game.price_per_player > 0 && (
            <p className="text-sm font-bold text-blue-600">{game.price_per_player.toFixed(2)}€</p>
          )}
          {(() => {
            const myP = game.players.find(p => p.user_id === userId || p.player_account_id === playerAccountId)
            if (myP?.payment_status === 'paid') {
              return <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">✅ Pago</span>
            }
            if (game.club_payment_method && game.club_payment_method !== 'at_club' && game.price_per_player > 0) {
              return <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">💳 Online</span>
            }
            return null
          })()}
        </div>
      </div>

      {/* Pay online button */}
      {isInGame && (() => {
        const myP = game.players.find(p => p.user_id === userId || p.player_account_id === playerAccountId)
        return myP?.payment_status !== 'paid' && game.club_payment_method && game.club_payment_method !== 'at_club' && game.price_per_player > 0
      })() && (
        <div className="px-4 pb-2 pt-0">
          <button
            onClick={async () => {
              if (!playerAccountId) return
              try {
                const { supabase } = await import('./lib/supabase')
                const { data: checkoutData, error: checkoutErr } = await supabase.functions.invoke('create-game-checkout', {
                  body: {
                    gameId: game.id,
                    paymentType: 'per_player',
                    playerAccountId,
                    successUrl: window.location.origin,
                    cancelUrl: window.location.origin,
                  },
                })
                if (!checkoutErr && checkoutData?.url) {
                  window.location.href = checkoutData.url
                } else {
                  alert(t.common.paymentError)
                }
              } catch (e) {
                alert('Erro ao iniciar pagamento.')
              }
            }}
            className="w-full py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            💳 Pagar {game.price_per_player.toFixed(2)}€
          </button>
        </div>
      )}

      {/* Actions */}
      {isInGame && (
        <div className="px-4 pb-3 pt-0 bg-gray-50/50 space-y-2">
          {/* Everyone can leave */}
          <button
            onClick={isCreator ? handleLeaveGameCreator : handleLeaveGame}
            disabled={actionLoading}
            className="w-full py-2 rounded-xl text-sm font-semibold text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors disabled:opacity-50"
          >
            {actionLoading ? '...' : '🚪 Sair do jogo'}
          </button>
          {/* Creator can also cancel */}
          {isCreator && (
            <button
              onClick={handleCancelGame}
              disabled={actionLoading}
              className="w-full py-1.5 rounded-xl text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              ❌ Cancelar jogo
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ==================== REWARDS SCREEN ====================
// ==================== PAYMENTS SCREEN ====================
function PaymentsScreen({ player, userId, onBack }: { player: PlayerAccount; userId: string | null; onBack: () => void }) {
  const { t, language } = useI18n()
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPayments()
  }, [])

  const loadPayments = async () => {
    setLoading(true)
    try {
      // Fetch payments for this player
      const { data, error } = await supabase
        .from('open_game_payments')
        .select(`
          id,
          game_id,
          amount,
          currency,
          payment_type,
          status,
          created_at,
          open_games (
            scheduled_at,
            club_id,
            duration_minutes
          )
        `)
        .or(`player_account_id.eq.${player.id}${userId ? `,user_id.eq.${userId}` : ''}`)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!error && data) {
        // Fetch club names for the games
        const clubIds = [...new Set(data.map((p: any) => (p.open_games as any)?.club_id).filter(Boolean))]
        let clubsMap: { [id: string]: string } = {}
        if (clubIds.length > 0) {
          const { data: clubs } = await supabase
            .from('clubs')
            .select('id, name')
            .in('id', clubIds)
          if (clubs) clubs.forEach((c: any) => { clubsMap[c.id] = c.name })
        }

        setPayments(data.map((p: any) => ({
          ...p,
          club_name: clubsMap[(p.open_games as any)?.club_id] || 'Clube',
          game_date: (p.open_games as any)?.scheduled_at || null,
        })))
      }
    } catch (e) {
      console.error('Error loading payments:', e)
    }
    setLoading(false)
  }

  const statusLabel = (s: string) => {
    switch (s) {
      case 'succeeded': return { text: t.payments.paid, color: 'bg-green-100 text-green-700' }
      case 'pending': return { text: t.payments.pending, color: 'bg-amber-100 text-amber-700' }
      case 'failed': return { text: t.payments.failed, color: 'bg-red-100 text-red-700' }
      case 'refunded': return { text: t.payments.refunded, color: 'bg-blue-100 text-blue-700' }
      default: return { text: s, color: 'bg-gray-100 text-gray-600' }
    }
  }

  const typeLabel = (type: string) => type === 'full_court' ? t.payments.fullCourt : t.payments.perPlayer

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">{t.payments.title}</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-16">
            <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t.payments.noPayments}</h3>
            <p className="text-sm text-gray-500">{t.payments.noPaymentsMessage}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Summary card */}
            {(() => {
              const totalPaid = payments.filter(p => p.status === 'succeeded').reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0)
              const totalPending = payments.filter(p => p.status === 'pending').reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0)
              return (
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 text-white mb-2">
                  <p className="text-xs font-medium text-blue-200 mb-1">{t.payments.totalPaid}</p>
                  <p className="text-2xl font-bold">{totalPaid.toFixed(2)}€</p>
                  {totalPending > 0 && (
                    <p className="text-xs text-blue-200 mt-1">{totalPending.toFixed(2)}€ {t.payments.pending}</p>
                  )}
                  <p className="text-xs text-blue-200 mt-2">{payments.length} {payments.length > 1 ? t.payments.transactionsPlural : t.payments.transactions}</p>
                </div>
              )
            })()}

            {/* Payments list */}
            {payments.map((p: any) => {
              const st = statusLabel(p.status)
              const gameDate = p.game_date ? new Date(p.game_date) : null
              const payDate = new Date(p.created_at)
              return (
                <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{p.club_name}</p>
                      {gameDate && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {t.payments.game}: {gameDate.toLocaleDateString(language === 'pt' ? 'pt-PT' : language === 'es' ? 'es-ES' : language === 'fr' ? 'fr-FR' : 'en-GB')} {language === 'pt' ? 'às' : language === 'es' ? 'a las' : language === 'fr' ? 'à' : 'at'} {gameDate.getHours().toString().padStart(2, '0')}:{gameDate.getMinutes().toString().padStart(2, '0')}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.color}`}>
                          {st.text}
                        </span>
                        <span className="text-[10px] text-gray-400">{typeLabel(p.payment_type)}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {payDate.toLocaleDateString('pt-PT')} {payDate.getHours().toString().padStart(2, '0')}:{payDate.getMinutes().toString().padStart(2, '0')}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-lg font-bold ${p.status === 'succeeded' ? 'text-green-600' : p.status === 'pending' ? 'text-amber-600' : 'text-gray-600'}`}>
                        {parseFloat(p.amount).toFixed(2)}€
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== REWARDS SCREEN ====================
function RewardsScreen({ player, onBack }: { player: PlayerAccount; onBack: () => void }) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'catalog' | 'history'>('catalog')
  const [catalogItems, setCatalogItems] = useState<import('./lib/openGames').CatalogItem[]>([])
  const [pointsByClub, setPointsByClub] = useState<Map<string, number>>(new Map())
  const [redemptions, setRedemptions] = useState<import('./lib/openGames').RedemptionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [redeeming, setRedeeming] = useState<string | null>(null) // catalog item id being redeemed
  const [confirmItem, setConfirmItem] = useState<import('./lib/openGames').CatalogItem | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [showHowToEarn, setShowHowToEarn] = useState(false)

  // Total points across all clubs
  const totalPoints = Array.from(pointsByClub.values()).reduce((s, p) => s + p, 0)
  const getRewardTier = (pts: number) => {
    if (pts >= 1000) return { name: 'Diamond', emoji: '💎', bgColor: 'bg-gradient-to-br from-cyan-50 to-cyan-100', textColor: 'text-cyan-700' }
    if (pts >= 500) return { name: 'Platinum', emoji: '🏅', bgColor: 'bg-gradient-to-br from-purple-50 to-purple-100', textColor: 'text-purple-700' }
    if (pts >= 200) return { name: 'Gold', emoji: '🥇', bgColor: 'bg-gradient-to-br from-yellow-50 to-amber-100', textColor: 'text-amber-700' }
    return { name: 'Silver', emoji: '🥈', bgColor: 'bg-gradient-to-br from-gray-100 to-gray-200', textColor: 'text-gray-700' }
  }
  const tier = getRewardTier(totalPoints)

  const CATEGORY_LABELS: Record<string, { emoji: string; label: string }> = {
    drink: { emoji: '🍺', label: 'Bebidas' },
    food: { emoji: '🍕', label: 'Comida' },
    court: { emoji: '🏟️', label: t.games.court },
    merchandise: { emoji: '👕', label: 'Merchandise' },
    lesson: { emoji: '🎓', label: 'Aulas' },
    discount: { emoji: '💰', label: 'Descontos' },
    experience: { emoji: '✨', label: 'Experiências' },
    other: { emoji: '🎁', label: 'Outros' },
  }

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const { fetchRewardCatalog, fetchMyRedemptions } = await import('./lib/openGames')
      const [catalogResult, redemptionResult] = await Promise.all([
        fetchRewardCatalog(player.id),
        fetchMyRedemptions(player.id),
      ])
      setCatalogItems(catalogResult.items)
      setPointsByClub(catalogResult.pointsByClub)
      setRedemptions(redemptionResult)
    } catch (err) {
      console.error('[Rewards] Error loading data:', err)
    }
    setLoading(false)
  }

  const handleRedeem = async (item: import('./lib/openGames').CatalogItem) => {
    setRedeeming(item.id)
    setConfirmItem(null)
    try {
      const { redeemReward } = await import('./lib/openGames')
      const result = await redeemReward(item.id, player.id)
      if (result.success) {
        setSuccessMessage(`✅ Resgataste "${result.itemTitle}"! Gastaste ${result.pointsSpent} pontos. Restam ${result.remainingPoints} pontos.`)
        // Refresh data
        await loadData()
        // Auto-dismiss after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000)
      } else {
        alert(result.error || t.common.redeemError)
      }
    } catch (err) {
      alert(t.common.connectionError)
    }
    setRedeeming(null)
  }

  const filteredItems = filterCategory === 'all' 
    ? catalogItems 
    : catalogItems.filter(i => i.category === filterCategory)

  // Group items by club
  const itemsByClub = new Map<string, import('./lib/openGames').CatalogItem[]>()
  filteredItems.forEach(item => {
    const list = itemsByClub.get(item.club_id) || []
    list.push(item)
    itemsByClub.set(item.club_id, list)
  })

  const STATUS_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
    pending: { label: 'Pendente', color: 'text-yellow-600 bg-yellow-50', emoji: '⏳' },
    approved: { label: 'Aprovado', color: 'text-green-600 bg-green-50', emoji: '✅' },
    used: { label: 'Utilizado', color: 'text-blue-600 bg-blue-50', emoji: '🎉' },
    cancelled: { label: 'Cancelado', color: 'text-red-600 bg-red-50', emoji: '❌' },
  }

  return (
    <div className="space-y-5 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          🎁 Gastar os meus pontos
        </h1>
      </div>

      {/* Points Summary Card */}
      <div className={`rounded-xl shadow-sm p-5 ${tier.bgColor}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm font-medium mb-1 flex items-center gap-1.5 ${tier.textColor}`}>
              <span className="text-lg">{tier.emoji}</span> {tier.name}
            </p>
            <p className={`text-4xl font-bold ${tier.textColor}`}>{totalPoints}</p>
            <p className={`text-xs mt-1 ${tier.textColor} opacity-70`}>pontos disponíveis</p>
          </div>
          {pointsByClub.size > 1 && (
            <div className="text-right space-y-1">
              {Array.from(pointsByClub.entries()).map(([clubId, pts]) => {
                const clubItem = catalogItems.find(i => i.club_id === clubId)
                return (
                  <p key={clubId} className={`text-xs ${tier.textColor} opacity-80`}>
                    {clubItem?.club_name || 'Clube'}: {pts} pts
                  </p>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Botão Como Ganhar Pontos */}
      <button
        onClick={() => setShowHowToEarn(true)}
        className="w-full py-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors flex items-center justify-center gap-2"
      >
        <span className="text-lg">💡</span>
        <span className="text-sm font-semibold text-amber-700">Como ganhar pontos?</span>
      </button>

      {/* Modal Como Ganhar Pontos */}
      {showHowToEarn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={() => setShowHowToEarn(false)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                💡 Como ganhar pontos
              </h2>
              <button onClick={() => setShowHowToEarn(false)} className="p-1.5 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { emoji: '🎾', action: 'Criar um jogo aberto', points: 15, desc: 'Organiza um jogo e convida outros jogadores' },
                { emoji: '🤝', action: 'Entrar num jogo', points: 10, desc: 'Junta-te a um jogo criado por outro jogador' },
                { emoji: '📝', action: 'Submeter resultado', points: 5, desc: 'Regista o resultado do jogo após terminar' },
                { emoji: '✅', action: 'Disputar resultado', points: 0, desc: 'Contestação de um resultado incorreto pela equipa adversária' },
                { emoji: '🏆', action: 'Participar num torneio', points: 20, desc: 'Inscreve-te e participa num torneio' },
                { emoji: '🍺', action: 'Consumo no bar', points: 5, desc: 'Por cada 10€ gastos no bar do clube' },
                { emoji: '⭐', action: 'Primeiro jogo', points: 25, desc: 'Bónus pelo teu primeiro jogo na plataforma' },
                { emoji: '🔥', action: '3 jogos seguidos', points: 15, desc: 'Joga 3 jogos consecutivos numa semana' },
                { emoji: '💪', action: '7 jogos seguidos', points: 30, desc: 'Joga 7 jogos consecutivos' },
              ].map((rule, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                  <span className="text-2xl mt-0.5">{rule.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900">{rule.action}</p>
                      <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                        +{rule.points} pts
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">{rule.desc}</p>
                  </div>
                </div>
              ))}

              {/* Tiers info */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm font-bold text-gray-800 mb-3">🏅 Níveis de Recompensa</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: 'Silver', emoji: '🥈', min: 0, color: 'bg-gray-100 text-gray-700' },
                    { name: 'Gold', emoji: '🥇', min: 200, color: 'bg-amber-50 text-amber-700' },
                    { name: 'Platinum', emoji: '🏅', min: 500, color: 'bg-purple-50 text-purple-700' },
                    { name: 'Diamond', emoji: '💎', min: 1000, color: 'bg-cyan-50 text-cyan-700' },
                  ].map(t => (
                    <div key={t.name} className={`p-3 rounded-xl ${t.color} text-center`}>
                      <span className="text-xl">{t.emoji}</span>
                      <p className="text-xs font-bold mt-1">{t.name}</p>
                      <p className="text-[10px] opacity-70">{t.min}+ pontos</p>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-gray-400 text-center mt-3">
                Os pontos por ação podem variar conforme o clube. Valores acima são os valores padrão.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-800">{successMessage}</p>
            <button onClick={() => setSuccessMessage(null)} className="text-xs text-green-600 mt-1 underline">Fechar</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-gray-100 rounded-xl p-1.5 flex gap-1">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'catalog' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          🎁 Recompensas ({catalogItems.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          📋 Histórico ({redemptions.length})
        </button>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">{t.common.loadingRewards}</p>
        </div>
      )}

      {/* ===== Catalog Tab ===== */}
      {activeTab === 'catalog' && !loading && (
        <div className="space-y-4">
          {/* Category Filter */}
          <div className="overflow-x-auto pb-2 -mx-4 px-4">
            <div className="flex gap-2" style={{ width: 'max-content' }}>
              <button
                onClick={() => setFilterCategory('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filterCategory === 'all' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Todos
              </button>
              {Object.entries(CATEGORY_LABELS).map(([key, { emoji, label }]) => {
                const count = catalogItems.filter(i => i.category === key).length
                if (count === 0) return null
                return (
                  <button
                    key={key}
                    onClick={() => setFilterCategory(key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                      filterCategory === key ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {emoji} {label} ({count})
                  </button>
                )
              })}
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Nenhuma recompensa disponível</p>
              <p className="text-xs text-gray-400 mt-1">Joga mais para acumular pontos e desbloquear recompensas!</p>
            </div>
          ) : (
            // Render items grouped by club
            Array.from(itemsByClub.entries()).map(([clubId, items]) => {
              const clubPoints = pointsByClub.get(clubId) || 0
              const clubName = items[0]?.club_name || 'Clube'

              return (
                <div key={clubId} className="space-y-3">
                  {/* Club header */}
                  {itemsByClub.size > 1 && (
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        {items[0]?.club_logo_url ? (
                          <img src={items[0].club_logo_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <Building2 className="w-5 h-5 text-gray-400" />
                        )}
                        <p className="text-sm font-bold text-gray-800">{clubName}</p>
                      </div>
                      <p className="text-xs font-medium text-gray-500">{clubPoints} pts disponíveis</p>
                    </div>
                  )}

                  {/* Items grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {items.map(item => {
                      const catInfo = CATEGORY_LABELS[item.category] || CATEGORY_LABELS.other
                      const canAfford = clubPoints >= item.cost_points
                      const isRedeeming = redeeming === item.id

                      return (
                        <div
                          key={item.id}
                          className={`rounded-xl border overflow-hidden transition-all ${
                            canAfford ? 'border-gray-200 bg-white hover:shadow-md' : 'border-gray-100 bg-gray-50 opacity-70'
                          }`}
                        >
                          {/* Image or emoji fallback */}
                          {item.image_url ? (
                            <div className="h-28 overflow-hidden">
                              <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="h-28 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                              <span className="text-5xl">{catInfo.emoji}</span>
                            </div>
                          )}

                          <div className="p-3 space-y-2">
                            <div>
                              <p className="text-sm font-bold text-gray-900 leading-tight">{item.title}</p>
                              {item.description && (
                                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">{item.description}</p>
                              )}
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                                <Star className="w-3.5 h-3.5" /> {item.cost_points} pts
                              </span>
                              {item.stock !== null && (
                                <span className="text-[10px] text-gray-400">Stock: {item.stock}</span>
                              )}
                            </div>

                            <button
                              onClick={() => canAfford ? setConfirmItem(item) : null}
                              disabled={!canAfford || isRedeeming}
                              className={`w-full py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                                isRedeeming
                                  ? 'bg-gray-200 text-gray-400 cursor-wait'
                                  : canAfford
                                    ? 'bg-red-600 text-white hover:bg-red-700 active:scale-95'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              {isRedeeming ? (
                                <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div> A resgatar...</>
                              ) : canAfford ? (
                                <><ShoppingBag className="w-3.5 h-3.5" /> Resgatar</>
                              ) : (
                                <><AlertCircle className="w-3.5 h-3.5" /> Pontos insuficientes</>
                              )}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ===== History Tab ===== */}
      {activeTab === 'history' && !loading && (
        <div className="space-y-3">
          {redemptions.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Nenhum resgate ainda</p>
              <p className="text-xs text-gray-400 mt-1">Quando resgatares uma recompensa, aparecerá aqui.</p>
            </div>
          ) : (
            redemptions.map(r => {
              const status = STATUS_LABELS[r.status] || STATUS_LABELS.pending
              return (
                <div key={r.id} className="card p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">
                    {status.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{r.item_title}</p>
                    <p className="text-[11px] text-gray-500">{r.club_name} · {new Date(r.redeemed_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-red-600">-{r.points_spent} pts</p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ===== Confirm Modal ===== */}
      {confirmItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4" onClick={() => setConfirmItem(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
            {/* Item preview */}
            {confirmItem.image_url ? (
              <div className="h-40 overflow-hidden">
                <img src={confirmItem.image_url} alt={confirmItem.title} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100">
                <span className="text-6xl">{(CATEGORY_LABELS[confirmItem.category] || CATEGORY_LABELS.other).emoji}</span>
              </div>
            )}

            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{confirmItem.title}</h3>
                {confirmItem.description && (
                  <p className="text-sm text-gray-600 mt-1">{confirmItem.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">{confirmItem.club_name}</p>
              </div>

              <div className="bg-red-50 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-red-700 font-medium">Custo:</span>
                <span className="text-lg font-bold text-red-600">{confirmItem.cost_points} pontos</span>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-gray-600">Pontos após resgate:</span>
                <span className="text-lg font-bold text-gray-800">
                  {(pointsByClub.get(confirmItem.club_id) || 0) - confirmItem.cost_points}
                </span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmItem(null)}
                  className="flex-1 py-3 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  onClick={() => handleRedeem(confirmItem)}
                  disabled={redeeming !== null}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  {redeeming ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> A processar...</>
                  ) : (
                    <><Gift className="w-4 h-4" /> Confirmar resgate</>
                  )}
                </button>
              </div>

              <p className="text-[10px] text-gray-400 text-center">
                Após o resgate, apresenta a confirmação no clube para receber a tua recompensa.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== RANKINGS SCREEN ====================

function RankingsScreen({
  userId,
  playerAccountId,
  onBack,
  onOpenPlayerProfile,
}: {
  userId: string | null
  playerAccountId: string | null
  onBack: () => void
  onOpenPlayerProfile: (userId: string, opts?: { accountId?: string | null; nameHint?: string | null }) => void
}) {
  const { t } = useI18n()
  const [scope, setScope] = useState<'general' | 'club'>('general')
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [loading, setLoading] = useState(true)
  const [rankings, setRankings] = useState<import('./lib/playerRankings').RankingsByGender>({ male: [], female: [] })
  const [club, setClub] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    import('./lib/playerRankings').then(({ findDefaultRankingClub }) => {
      findDefaultRankingClub().then(setClub)
    })
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    const load = async () => {
      try {
        const { fetchGlobalRankings, fetchClubRankings } = await import('./lib/playerRankings')
        const data = scope === 'general'
          ? await fetchGlobalRankings()
          : club
            ? await fetchClubRankings(club.id)
            : { male: [], female: [] }
        if (active) setRankings(data)
      } catch (err) {
        console.error('[RankingsScreen] load error:', err)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [scope, club?.id])

  const list = gender === 'male' ? rankings.male : rankings.female

  const positionBadge = (pos: number) => {
    if (pos === 1) return '🥇'
    if (pos === 2) return '🥈'
    if (pos === 3) return '🥉'
    return String(pos)
  }

  return (
    <div className="space-y-4 animate-fade-in pb-8">
      <button type="button" onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-5 h-5" /> {t.common.back}
      </button>

      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-rose-500" />
          {t.rankings.title}
        </h1>
        <p className="text-xs text-gray-500 mt-1">{t.rankings.basedOnLevel}</p>
      </div>

      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
        <button
          type="button"
          onClick={() => setScope('general')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${scope === 'general' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
        >
          {t.rankings.general}
        </button>
        <button
          type="button"
          onClick={() => setScope('club')}
          disabled={!club}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${scope === 'club' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'} disabled:opacity-40`}
        >
          {club ? club.name : t.rankings.byClub}
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setGender('male')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${gender === 'male' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
        >
          👨 {t.rankings.male}
        </button>
        <button
          type="button"
          onClick={() => setGender('female')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${gender === 'female' ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-gray-600 border-gray-200'}`}
        >
          👩 {t.rankings.female}
        </button>
      </div>

      {loading ? (
        <div className="card p-10 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-gray-500">{t.rankings.loading}</p>
        </div>
      ) : list.length === 0 ? (
        <div className="card p-8 text-center">
          <span className="text-4xl block mb-2">📊</span>
          <p className="text-gray-600 font-medium">{t.rankings.noPlayers}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-[3rem_1fr_4rem] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase">
            <span>{t.rankings.position}</span>
            <span>{t.rankings.player}</span>
            <span className="text-right">{t.rankings.level}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {list.map((entry) => {
              const isMe = entry.id === playerAccountId || (entry.user_id && entry.user_id === userId)
              return (
                <RankingRow
                  key={entry.id}
                  entry={entry}
                  isMe={!!isMe}
                  positionBadge={positionBadge(entry.position)}
                  onOpenPlayerProfile={onOpenPlayerProfile}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function RankingRow({
  entry,
  isMe,
  positionBadge,
  onOpenPlayerProfile,
}: {
  entry: import('./lib/playerRankings').RankingEntry
  isMe: boolean
  positionBadge: string
  onOpenPlayerProfile: (userId: string, opts?: { accountId?: string | null; nameHint?: string | null }) => void
}) {
  const colors = levelColors(entry.level)

  return (
    <button
      type="button"
      onClick={() => entry.user_id && onOpenPlayerProfile(entry.user_id)}
      disabled={!entry.user_id}
      className={`w-full grid grid-cols-[3rem_1fr_4rem] gap-2 px-4 py-3 items-center text-left transition-colors ${isMe ? 'bg-rose-50' : 'hover:bg-gray-50'} ${!entry.user_id ? 'cursor-default' : ''}`}
    >
      <span className={`text-sm font-bold ${entry.position <= 3 ? 'text-lg' : 'text-gray-500'}`}>
        {positionBadge}
      </span>
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
          {entry.avatar_url ? (
            <img src={entry.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-200 text-xs font-bold text-gray-600">
              {(entry.name || '?').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <span className={`text-sm font-medium truncate ${isMe ? 'text-rose-700' : 'text-gray-900'}`}>
          {entry.name}{isMe ? ' (tu)' : ''}
        </span>
      </div>
      <span
        className="text-sm font-bold text-right rounded-lg px-2 py-0.5 justify-self-end"
        style={{ color: colors.hex, backgroundColor: `${colors.hex}18` }}
      >
        {entry.level.toFixed(2)}
      </span>
    </button>
  )
}

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

      {/* Estatísticas - Jogos, Vitórias, Taxa, Seguir, Seguidores */}
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
          <p className="text-lg mb-0.5">📈</p>
          <p className="text-xl font-bold text-gray-900">{winRate}%</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Taxa</p>
        </div>
        <div className="card p-3 text-center cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => userId && onOpenFollowsList(userId)}>
          <p className="text-lg mb-0.5">👥</p>
          <p className="text-xl font-bold text-red-600">{followingCount}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">A seguir</p>
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

// ---------- Lista de Clubes (ecrã inteiro com cards) ----------
function ClubsListScreen({
  playerClubIds, favoriteClubId, onBack, onOpenClubDetail, onSaveFavoriteClub, onToggleClub,
}: {
  playerClubIds: string[]
  favoriteClubId: string | null
  onBack: () => void
  onOpenClubDetail: (clubId: string) => void
  onSaveFavoriteClub: (clubId: string | null) => Promise<void>
  onToggleClub: (clubId: string, add: boolean) => Promise<void>
}) {
  const { t } = useI18n()
  const [clubs, setClubs] = useState<ClubDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchAllClubs().then(list => { setClubs(list); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const sortedClubs = useMemo(() => {
    const fav: ClubDetail[] = []
    const selected: ClubDetail[] = []
    const rest: ClubDetail[] = []
    clubs.forEach(c => {
      if (c.id === favoriteClubId) fav.push(c)
      else if (playerClubIds.includes(c.id)) selected.push(c)
      else rest.push(c)
    })
    return [...fav, ...selected, ...rest]
  }, [clubs, favoriteClubId, playerClubIds])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return sortedClubs
    const q = searchQuery.toLowerCase()
    return sortedClubs.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.city && c.city.toLowerCase().includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q))
    )
  }, [sortedClubs, searchQuery])

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Clubes</h1>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Pesquisar clubes..."
          className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{searchQuery ? 'Nenhum clube encontrado' : t.settings.noClubsAvailable}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(club => {
            const isSelected = playerClubIds.includes(club.id)
            const isFavorite = favoriteClubId === club.id
            const coverImg = club.photo_url_1 || club.cover_image_url || club.logo_url
            return (
              <div
                key={club.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onOpenClubDetail(club.id)}
              >
                <div className="relative h-44 bg-gradient-to-br from-gray-100 to-gray-200">
                  {coverImg ? (
                    <img src={coverImg} alt={club.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Building2 className="w-16 h-16 text-gray-300" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  {isFavorite && (
                    <div className="absolute top-3 left-3 flex items-center gap-1 bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                      <Star className="w-3 h-3 fill-white" /> Favorito
                    </div>
                  )}
                  {isSelected && !isFavorite && (
                    <div className="absolute top-3 left-3 flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                      <Check className="w-3 h-3" /> Selecionado
                    </div>
                  )}
                  {club.logo_url && coverImg !== club.logo_url && (
                    <div className="absolute bottom-3 left-4 w-12 h-12 rounded-xl bg-white shadow-lg overflow-hidden border-2 border-white">
                      <img src={club.logo_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="absolute bottom-3 left-4" style={club.logo_url && coverImg !== club.logo_url ? { left: '4.5rem' } : {}}>
                    <h3 className="text-white font-bold text-lg drop-shadow-md leading-tight">{club.name}</h3>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {club.address && (
                        <div className="flex items-start gap-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                          <span className="truncate">{club.address}{club.city ? `, ${club.city}` : ''}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {club.num_courts && (
                          <span className="flex items-center gap-1">
                            <span className="font-semibold text-gray-700">{club.num_courts}</span> campos
                          </span>
                        )}
                        {club.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {club.phone}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        if (isSelected && !isFavorite) {
                          onSaveFavoriteClub(club.id)
                        } else if (!isSelected) {
                          onToggleClub(club.id, true)
                        }
                      }}
                      className={`shrink-0 p-2 rounded-full transition-colors ${isFavorite ? 'text-amber-500' : isSelected ? 'text-red-500 hover:text-amber-500' : 'text-gray-300 hover:text-red-500'}`}
                    >
                      <Star className={`w-5 h-5 ${isFavorite ? 'fill-amber-500' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------- Detalhe do Clube (página inteira) ----------
function ClubDetailScreen({ clubId, onBack, isSelected, isFavorite, onToggleClub, onSaveFavoriteClub }: {
  clubId: string
  onBack: () => void
  isSelected?: boolean
  isFavorite?: boolean
  onToggleClub?: (clubId: string, add: boolean) => Promise<void>
  onSaveFavoriteClub?: (clubId: string | null) => Promise<void>
}) {
  const { t } = useI18n()
  const [club, setClub] = useState<ClubDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activePhotoIdx, setActivePhotoIdx] = useState(0)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetchClubById(clubId).then(data => {
      setClub(data ?? null)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [clubId])

  const allPhotos = useMemo(() => {
    if (!club) return []
    const photos: string[] = []
    if (club.photo_url_1) photos.push(club.photo_url_1)
    if (club.photo_url_2 && !photos.includes(club.photo_url_2)) photos.push(club.photo_url_2)
    if (club.cover_image_url && !photos.includes(club.cover_image_url)) photos.push(club.cover_image_url)
    if (club.photos?.length) {
      club.photos.forEach(p => { if (!photos.includes(p)) photos.push(p) })
    }
    if (club.logo_url && !photos.includes(club.logo_url)) photos.push(club.logo_url)
    return photos
  }, [club])

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-5 h-5" /> {t.common.back}
        </button>
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!club) {
    return (
      <div className="space-y-4 animate-fade-in">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-5 h-5" /> {t.common.back}
        </button>
        <div className="text-center py-16">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Clube não encontrado</p>
        </div>
      </div>
    )
  }

  const hasCoordinates = club.latitude && club.longitude
  const mapsUrl = hasCoordinates
    ? `https://www.google.com/maps?q=${club.latitude},${club.longitude}`
    : club.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(club.address + (club.city ? `, ${club.city}` : '') + (club.country ? `, ${club.country}` : ''))}`
      : null
  const mapsEmbedUrl = hasCoordinates
    ? `https://maps.google.com/maps?q=${club.latitude},${club.longitude}&z=15&output=embed`
    : club.address
      ? `https://maps.google.com/maps?q=${encodeURIComponent(club.address + (club.city ? `, ${club.city}` : ''))}&z=15&output=embed`
      : null

  const amenityIcons: Record<string, string> = {
    parking: '🅿️', bar: '🍺', restaurant: '🍽️', showers: '🚿',
    locker_room: '🔒', shop: '🛒', wifi: '📶', gym: '💪',
    pool: '🏊', kids: '👶', physiotherapy: '💆',
  }

  return (
    <div className="animate-fade-in -mx-4 -mt-4">
      {/* Hero photo gallery */}
      <div className="relative h-72 sm:h-80 bg-gradient-to-br from-gray-200 to-gray-300">
        {allPhotos.length > 0 ? (
          <img src={allPhotos[activePhotoIdx]} alt={club.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="w-20 h-20 text-gray-300" />
          </div>
        )}
        {/* Gradient overlay - pointer-events-none so buttons work */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />
        {/* Navigation arrows */}
        {allPhotos.length > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); setActivePhotoIdx(i => (i - 1 + allPhotos.length) % allPhotos.length) }} className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setActivePhotoIdx(i => (i + 1) % allPhotos.length) }} className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-10 flex gap-2">
              {allPhotos.map((_, i) => (
                <button key={i} onClick={(e) => { e.stopPropagation(); setActivePhotoIdx(i) }} className={`rounded-full transition-all ${i === activePhotoIdx ? 'bg-white w-5 h-2.5' : 'bg-white/50 w-2.5 h-2.5'}`} />
              ))}
            </div>
          </>
        )}
        {/* Photo counter */}
        {allPhotos.length > 1 && (
          <div className="absolute top-4 right-4 z-10 bg-black/50 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full">
            {activePhotoIdx + 1} / {allPhotos.length}
          </div>
        )}
        {/* Back button */}
        <button onClick={onBack} className="absolute top-4 left-4 z-10 w-10 h-10 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        {/* Club name over photo */}
        <div className="absolute bottom-3 left-4 right-4 z-10">
          <div className="flex items-end gap-3">
            {club.logo_url && (
              <div className="w-14 h-14 rounded-xl bg-white shadow-lg overflow-hidden border-2 border-white shrink-0">
                <img src={club.logo_url} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-white text-2xl font-bold drop-shadow-lg leading-tight">{club.name}</h1>
              {club.city && <p className="text-white/80 text-sm drop-shadow-sm">{club.city}{club.country ? `, ${club.country}` : ''}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* Action buttons: Jogo aqui / Favorito */}
        {onToggleClub && (
          <div className="flex gap-3">
            <button
              disabled={toggling}
              onClick={async () => {
                setToggling(true)
                try { await onToggleClub(clubId, !isSelected) } catch {}
                setToggling(false)
              }}
              className={`flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                isSelected
                  ? 'bg-red-50 text-red-600 border-2 border-red-200'
                  : 'bg-red-600 text-white hover:bg-red-700'
              } ${toggling ? 'opacity-50' : ''}`}
            >
              {isSelected ? (
                <><Check className="w-4 h-4" /> Jogo aqui</>
              ) : (
                <><Plus className="w-4 h-4" /> Adicionar aos meus clubes</>
              )}
            </button>
            {isSelected && onSaveFavoriteClub && (
              <button
                onClick={async () => {
                  setToggling(true)
                  try { await onSaveFavoriteClub(isFavorite ? null : clubId) } catch {}
                  setToggling(false)
                }}
                className={`px-4 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all border-2 ${
                  isFavorite
                    ? 'bg-amber-50 text-amber-600 border-amber-200'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300 hover:text-amber-500'
                }`}
              >
                <Star className={`w-5 h-5 ${isFavorite ? 'fill-amber-500 text-amber-500' : ''}`} />
              </button>
            )}
          </div>
        )}

        {club.plan_type === 'preview' && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-sm text-amber-800 font-medium">
              Este clube ainda não está ativo na Padel One. Entre em contacto com o seu clube!
            </p>
          </div>
        )}

        {club.description && (
          <p className="text-gray-600 text-sm leading-relaxed">{club.description}</p>
        )}

        {/* Quick info badges */}
        <div className="flex flex-wrap gap-2">
          {club.num_courts && (
            <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              🏟️ {club.num_courts} {club.num_courts === 1 ? 'campo' : 'campos'}
            </div>
          )}
          {club.amenities && club.amenities.length > 0 && club.amenities.map(a => (
            <div key={a} className="flex items-center gap-1 bg-gray-100 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-full">
              {amenityIcons[a] || '✨'} {a.charAt(0).toUpperCase() + a.slice(1).replace('_', ' ')}
            </div>
          ))}
        </div>

        {/* Contact info */}
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
          {club.address && (
            <a href={mapsUrl || '#'} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors">
              <MapPin className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{club.address}</p>
                <p className="text-xs text-gray-500">{club.city}{club.country ? `, ${club.country}` : ''}</p>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-400 shrink-0 mt-1" />
            </a>
          )}
          {club.phone && (
            <a href={`tel:${club.phone}`} className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
              <Phone className="w-5 h-5 text-green-600 shrink-0" />
              <span className="text-sm font-medium text-gray-900">{club.phone}</span>
            </a>
          )}
          {club.email && (
            <a href={`mailto:${club.email}`} className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
              <Mail className="w-5 h-5 text-blue-600 shrink-0" />
              <span className="text-sm font-medium text-gray-900">{club.email}</span>
            </a>
          )}
          {club.website && (
            <a href={club.website.startsWith('http') ? club.website : `https://${club.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
              <Globe className="w-5 h-5 text-purple-600 shrink-0" />
              <span className="text-sm font-medium text-gray-900 truncate">{club.website}</span>
              <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
            </a>
          )}
        </div>

        {/* Google Maps embed */}
        {mapsEmbedUrl && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-500" /> Localização
            </h3>
            <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
              <iframe
                src={mapsEmbedUrl}
                width="100%"
                height="220"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`Localização de ${club.name}`}
              />
            </div>
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-sm text-red-600 font-medium hover:underline py-1">
                <Navigation className="w-4 h-4" /> Abrir no Google Maps
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Clube Favorito (detalhes do clube escolhido no perfil) ----------
function ClubScreen({ favoriteClubId, onBack }: { favoriteClubId: string | null; onBack: () => void }) {
  const { t } = useI18n()
  const [club, setClub] = useState<ClubDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const id = favoriteClubId || localStorage.getItem('padel_one_player_favorite_club_id')
    if (!id) {
      setClub(null)
      setLoading(false)
      return
    }
    fetchClubById(id).then((data) => {
      if (!cancelled) {
        setClub(data ?? null)
        setLoading(false)
      }
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [favoriteClubId])

  if (loading) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-5 h-5" /> {t.common.back}
        </button>
        <div className="flex items-center justify-center py-12">
          <div className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!club) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-5 h-5" /> {t.common.back}
        </button>
        <div className="card p-8 text-center">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">{t.common.noClubSelected}</p>
          <p className="text-sm text-gray-400 mt-1">{t.common.goToProfile}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-5 h-5" /> Voltar
      </button>
      <div className="card overflow-hidden">
        {club.logo_url && (
          <img src={club.logo_url} alt={club.name} className="w-full h-40 object-cover object-center" />
        )}
        <div className="p-5">
          <h1 className="text-xl font-bold text-gray-900">{club.name}</h1>
          {club.plan_type === 'preview' && (
            <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-800 font-medium">
                Este clube ainda não está ativo na Padel One. Entre em contacto com o seu clube! Obrigado.
              </p>
            </div>
          )}
          {club.description && (
            <p className="text-gray-600 mt-2 text-sm leading-relaxed">{club.description}</p>
          )}
          <div className="mt-4 space-y-2">
            {club.address && (
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{club.address}{club.city ? `, ${club.city}` : ''}{club.country ? `, ${club.country}` : ''}</span>
              </div>
            )}
            {club.phone && (
              <a href={`tel:${club.phone}`} className="flex items-center gap-2 text-sm text-red-600 hover:underline">
                <Phone className="w-4 h-4" /> {club.phone}
              </a>
            )}
            {club.email && (
              <a href={`mailto:${club.email}`} className="flex items-center gap-2 text-sm text-red-600 hover:underline">
                <Mail className="w-4 h-4" /> {club.email}
              </a>
            )}
            {club.website && (
              <a href={club.website.startsWith('http') ? club.website : `https://${club.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-red-600 hover:underline">
                <Globe className="w-4 h-4" /> {club.website}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Competir: Próximos torneios + Os seus Torneios/Ligas ----------
function CompeteScreen({
  dashboardData,
  favoriteClubId,
  clubIds,
  userId,
  playerAccountId,
  player,
  onBack,
  initialTournamentId,
  onInitialTournamentConsumed,
  onOpenCommunityGroupChat,
}: {
  dashboardData: PlayerDashboardData | null
  favoriteClubId: string | null
  clubIds: string[]
  userId: string | null
  playerAccountId: string | null
  player: PlayerAccount | null
  onBack: () => void
  initialTournamentId?: string | null
  onInitialTournamentConsumed?: () => void
  onOpenCommunityGroupChat?: (groupId: string) => void
}) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'upcoming' | 'leagues' | 'history'>('upcoming')
  const [upcomingFromTour, setUpcomingFromTour] = useState<UpcomingTournamentFromTour[]>([])
  const [tourEnrolledCounts, setTourEnrolledCounts] = useState<Map<string, number>>(new Map())
  const [loadingUpcoming, setLoadingUpcoming] = useState(true)
  const [viewingLeague, setViewingLeague] = useState<{ id: string; name: string } | null>(null)
  const [leagueFull, setLeagueFull] = useState<any[]>([])
  const [leagueCategories, setLeagueCategories] = useState<{ category_name: string; standings: any[] }[]>([])
  const [leagueCategoryTab, setLeagueCategoryTab] = useState('')
  const [leagueLoading, setLeagueLoading] = useState(false)
  const [viewingTournament, setViewingTournament] = useState<{ id: string; name: string } | null>(null)
  const [tournamentDetail, setTournamentDetail] = useState<{ standings: any[]; myMatches: any[]; name: string } | null>(null)
  const [detailTab, setDetailTab] = useState<'standings' | 'matches'>('standings')
  const [viewingEnrolled, setViewingEnrolled] = useState<{ id: string; name: string } | null>(null)
  const [enrolledData, setEnrolledData] = useState<EnrolledByCategory[]>([])
  const [enrolledLoading, setEnrolledLoading] = useState(false)
  const [pastTournamentDetails, setPastTournamentDetails] = useState<Record<string, { standings: any[]; myMatches: any[]; playerPosition?: number; tournamentName: string; categoryStandings?: Record<string, { categoryName: string; standings: any[]; myMatches: any[]; allMatches: any[]; playerPosition?: number }> }>>({})
  const [pastTournamentLoading, setPastTournamentLoading] = useState(false)
  const [leaguesDirect, setLeaguesDirect] = useState<PlayerDashboardData['leagueStandings']>([])
  const [leaguesLoading, setLeaguesLoading] = useState(false)
  const [leaguesFetched, setLeaguesFetched] = useState(false)
  const [historyFetched, setHistoryFetched] = useState(false)
  const [availableTournaments, setAvailableTournaments] = useState<UpcomingTournamentFromTour[]>([])
  const [loadingAvailable, setLoadingAvailable] = useState(false)
  const [openGameHistory, setOpenGameHistory] = useState<import('./lib/openGames').OpenGameMatchResult[]>([])
  const [openGameHistoryLoading, setOpenGameHistoryLoading] = useState(false)
  const [openGameHistoryFetched, setOpenGameHistoryFetched] = useState(false)
  const [selectedTournamentDetail, setSelectedTournamentDetail] = useState<TournamentFullDetail | null>(null)
  const [selectedTournamentLoading, setSelectedTournamentLoading] = useState(false)
  const [pendingInviteForTournament, setPendingInviteForTournament] = useState<string | null>(null)
  const [inviteActionLoading, setInviteActionLoading] = useState(false)
  const [categoryDetails, setCategoryDetails] = useState<import('./lib/clubAndTournaments').TournamentCategoryDetail[]>([])
  const [categoryDetailsLoading, setCategoryDetailsLoading] = useState(false)
  const [expandedDetailCats, setExpandedDetailCats] = useState<Set<string>>(new Set())
  const [showFindPartnerModal, setShowFindPartnerModal] = useState(false)
  const [partnerSide, setPartnerSide] = useState<'right' | 'left' | 'both'>('both')
  const [partnerTargetMode, setPartnerTargetMode] = useState<'any' | 'following' | 'direct'>('any')
  const [partnerInviteePhone, setPartnerInviteePhone] = useState('')
  const [partnerInviteeLookup, setPartnerInviteeLookup] = useState<{ found: boolean; name: string | null; position: string | null } | null>(null)
  const [partnerInviteeLooking, setPartnerInviteeLooking] = useState(false)
  const partnerPhoneLookupRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [partnerMinLevel, setPartnerMinLevel] = useState<number>(1.0)
  const [partnerMaxLevel, setPartnerMaxLevel] = useState<number>(7.0)
  const [partnerLoading, setPartnerLoading] = useState(false)
  const [pendingPartnerInvites, setPendingPartnerInvites] = useState<PartnerInvite[]>([])
  const [partnerInvitesLoading, setPartnerInvitesLoading] = useState(false)
  const [partnerRequestSummary, setPartnerRequestSummary] = useState<PartnerMatchRequesterSummary | null>(null)
  const [partnerSummaryRefreshing, setPartnerSummaryRefreshing] = useState(false)

  const d = dashboardData
  const name = d?.playerName ?? ''

  const effectivePastDetails = useMemo(() => {
    const edge = d?.pastTournamentDetails || {}
    const client = pastTournamentDetails
    const merged: Record<string, any> = {}
    const allIds = new Set([...Object.keys(edge), ...Object.keys(client)])
    for (const id of allIds) {
      if (client[id] && edge[id]) {
        merged[id] = { ...edge[id], ...client[id] }
      } else {
        merged[id] = client[id] || edge[id]
      }
    }
    return merged
  }, [pastTournamentDetails, d?.pastTournamentDetails])

  // Preferir dados da edge function (leaguesDirect) pois incluem league_status e league_categories
  const leagueStandings = leaguesDirect.length > 0 ? leaguesDirect : (d?.leagueStandings ?? [])
  


  useEffect(() => {
    let active = true
    const effectiveClubIds = clubIds.length > 0 ? clubIds : (favoriteClubId ? [favoriteClubId] : [])
    ;(async () => {
      try {
        const list = await fetchUpcomingTournaments(
          effectiveClubIds.length > 0 ? effectiveClubIds : undefined,
          {
            playerPhone: player?.phone_number || null,
            playerLat: (player as any)?.lat || null,
            playerLng: (player as any)?.lng || null,
          }
        )
        if (!active) return

        let invitedIds = new Set<string>()
        if (player?.id) {
          const invites = await fetchMyTournamentInvites(player.id)
          invitedIds = new Set(invites.map(i => i.tournament_id))
        }

        const pg: string | undefined = player?.gender as string | undefined ||
          (player?.player_category?.startsWith('M') ? 'male' : undefined) ||
          (player?.player_category?.startsWith('F') ? 'female' : undefined)

        const inferGender = (t: UpcomingTournamentFromTour): string | null => {
          if (t.gender && t.gender !== 'all') return t.gender
          const nm = (t.name || '').toLowerCase()
          if (nm.includes('masc') || nm.includes(' m.') || nm.includes(' m ')) return 'male'
          if (nm.includes('fem') || nm.includes(' f.') || nm.includes(' f ')) return 'female'
          return null
        }

        const filtered = list
          .filter(t => {
            if (t.visibility === 'invite_only' && !invitedIds.has(t.id)) return false
            const tg = inferGender(t)
            if (tg && tg !== 'all' && tg !== 'mixed') {
              if (pg) {
                if (tg === 'male' && pg !== 'male') return false
                if (tg === 'female' && pg !== 'female') return false
              }
            }
            return true
          })
          .map(t => ({ ...t, is_invited: invitedIds.has(t.id) }))

        const tourIds = new Set(filtered.map(t => t.id))
        const enrolledIds = (d?.upcomingTournaments ?? []).map(t => t.id).filter(id => !tourIds.has(id))
        if (enrolledIds.length > 0) {
          const extra = await fetchTournamentsByIds(enrolledIds)
          extra.forEach(t => {
            if (!tourIds.has(t.id)) {
              filtered.push({ ...t, is_invited: invitedIds.has(t.id) })
            }
          })
        }

        const allIds = filtered.map(t => t.id)
        const counts = await fetchTournamentEnrolledCounts(allIds)

        if (active) {
          setUpcomingFromTour(filtered)
          setTourEnrolledCounts(counts)
          setLoadingUpcoming(false)
        }
      } catch {
        if (active) setLoadingUpcoming(false)
      }
    })()
    return () => { active = false }
  }, [clubIds, favoriteClubId, player?.id, player?.phone_number, (player as any)?.lat, (player as any)?.lng, d?.upcomingTournaments])


  // Buscar torneios disponíveis filtrados por género e nível
  useEffect(() => {
    if (activeTab !== 'upcoming') return
    let active = true
    const effIds = clubIds.length > 0 ? clubIds : (favoriteClubId ? [favoriteClubId] : [])
    setLoadingAvailable(true)

    ;(async () => {
      try {
        const list = await fetchUpcomingTournaments(
          effIds.length > 0 ? effIds : undefined,
          {
            playerPhone: player?.phone_number || null,
            playerLat: (player as any)?.lat || null,
            playerLng: (player as any)?.lng || null,
          }
        )
        if (!active) return

        let invitedIds = new Set<string>()
        if (player?.id) {
          const invites = await fetchMyTournamentInvites(player.id)
          invitedIds = new Set(invites.map(i => i.tournament_id))
        }

        const enrolledIds = new Set((d?.upcomingTournaments ?? []).map((t) => t.id))
        const playerGender = player?.gender as string | undefined ||
          (player?.player_category?.startsWith('M') ? 'male' : null) ||
          (player?.player_category?.startsWith('F') ? 'female' : null) ||
          undefined

        const inferTournamentGender = (t: UpcomingTournamentFromTour): string | null => {
          if (t.gender && t.gender !== 'all') return t.gender
          const nameLower = (t.name || '').toLowerCase()
          if (nameLower.includes('masc') || nameLower.includes(' m.') || nameLower.includes(' m ')) return 'male'
          if (nameLower.includes('fem') || nameLower.includes(' f.') || nameLower.includes(' f ')) return 'female'
          return null
        }

        const activeNotEnrolled = list
          .filter((t) => {
            if (t.status !== 'active' || enrolledIds.has(t.id)) return false
            if (t.visibility === 'invite_only' && !invitedIds.has(t.id)) return false
            // Filter by gender (explicit field or inferred from name)
            const tournamentGender = inferTournamentGender(t)
            if (tournamentGender && tournamentGender !== 'all' && tournamentGender !== 'mixed') {
              if (playerGender) {
                if (tournamentGender === 'male' && playerGender !== 'male') return false
                if (tournamentGender === 'female' && playerGender !== 'female') return false
              }
            }
            return true
          })
          .map(t => ({ ...t, is_invited: invitedIds.has(t.id) }))

        const { supabase } = await import('./lib/supabase')
        const filtered: UpcomingTournamentFromTour[] = []

        for (const tournament of activeNotEnrolled) {
          const { data: categories } = await supabase
            .from('tournament_categories')
            .select('id, name, min_level, max_level, max_teams')
            .eq('tournament_id', tournament.id)

          if (categories && categories.length > 0) {
            let hasCompatibleCategory: boolean
            const pLevel = player?.level != null ? Number(player.level) : null

            if (pLevel != null) {
              hasCompatibleCategory = categories.some(cat => {
                const minLvl = cat.min_level != null ? Number(cat.min_level) : null
                const maxLvl = cat.max_level != null ? Number(cat.max_level) : null
                if (minLvl == null && maxLvl == null) return true
                if (minLvl != null && pLevel < minLvl) return false
                if (maxLvl != null && pLevel > maxLvl) return false
                return true
              })
            } else {
              const allHaveLevel = categories.every(cat => cat.min_level != null || cat.max_level != null)
              hasCompatibleCategory = !allHaveLevel
            }

            if (hasCompatibleCategory) {
              const totalMax = categories.reduce((sum, c) => c.max_teams ? sum + c.max_teams : sum, 0)
              let isFull = false
              if (totalMax > 0) {
                const isIndiv = tournament.format === 'individual_groups_knockout' || tournament.format === 'mixed_american' || (tournament.format === 'round_robin' && tournament.round_robin_type === 'individual')
                const table = isIndiv ? 'players' : 'teams'
                const { count } = await supabase
                  .from(table)
                  .select('id', { count: 'exact', head: true })
                  .eq('tournament_id', tournament.id)
                isFull = (count ?? 0) >= totalMax
              }
              filtered.push({ ...tournament, is_full: isFull })
            }
          } else {
            filtered.push(tournament)
          }
        }

        if (active) {
          setAvailableTournaments(filtered.slice(0, 10))
          setLoadingAvailable(false)
        }
      } catch (err) {
        console.error('[Available Tournaments] Error:', err)
        if (active) setLoadingAvailable(false)
      }
    })()

    return () => { active = false }
  }, [activeTab, favoriteClubId, clubIds, d?.upcomingTournaments, player?.level, player?.gender, player?.player_category])

  // Buscar ligas quando abre o tab Ligas (via Edge Function - bypass RLS)
  useEffect(() => {
    if (activeTab !== 'leagues') return
    if (leaguesFetched) return
    if (!playerAccountId) return
    let active = true
    setLeaguesLoading(true)
    ;(async () => {
      try {
        // Fetching leagues for player
        
        const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxaXdueGNleHNjY2d1cnVpdGVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3Njc5MzcsImV4cCI6MjA3NTM0MzkzN30.Dl05zPQDtPVpmvn_Y-JokT3wDq0Oh9uF3op5xcHZpkY'
        
        // Usar fetch direto com Authorization e apikey
        const resp = await fetch(
          `https://rqiwnxcexsccguruiteq.supabase.co/functions/v1/get-player-leagues`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${anonKey}`,
              'apikey': anonKey,
            },
            body: JSON.stringify({ player_account_id: playerAccountId }),
          }
        )
        
        if (active && resp.ok) {
          const data = await resp.json()
          if (data?.leagues?.length) {
            setLeaguesDirect(data.leagues)
          }
        } else {
          const errorText = await resp.text()
          console.error('[Leagues] Edge Function error:', resp.status, errorText)
        }
      } catch (err) {
        console.error('[Leagues] ERROR:', err)
      }
      if (active) { setLeaguesLoading(false); setLeaguesFetched(true) }
    })()
    return () => { active = false }
  }, [activeTab, leaguesFetched, playerAccountId])

  // Reset open game history cache when dashboard data changes (e.g. after quick result)
  useEffect(() => {
    setOpenGameHistoryFetched(false)
  }, [dashboardData])

  // Carregar resultados de jogos abertos quando abre o tab history
  useEffect(() => {
    if (activeTab !== 'history') return
    if (!userId) return
    if (openGameHistoryFetched) return
    let active = true
    setOpenGameHistoryLoading(true)
    ;(async () => {
      try {
        const { fetchConfirmedOpenGameResults } = await import('./lib/openGames')
        const data = await fetchConfirmedOpenGameResults(userId, playerAccountId || undefined)
        console.log('[History] Fetched open game history:', data.length, 'games for userId:', userId, 'playerAccountId:', playerAccountId)
        if (active) setOpenGameHistory(data)
      } catch (err) {
        console.error('[History] Error fetching open game results:', err)
      }
      if (active) { setOpenGameHistoryLoading(false); setOpenGameHistoryFetched(true) }
    })()
    return () => { active = false }
  }, [activeTab, userId, playerAccountId, openGameHistoryFetched])

  const [historyVisibleCount, setHistoryVisibleCount] = useState(5)
  const [historyLoadedCount, setHistoryLoadedCount] = useState(0)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, Set<string>>>({})

  const toggleCategoryExpanded = (tournamentId: string, catId: string) => {
    setExpandedCategories(prev => {
      const copy = { ...prev }
      const set = new Set(copy[tournamentId] || [])
      if (set.has(catId)) set.delete(catId); else set.add(catId)
      copy[tournamentId] = set
      return copy
    })
  }

  useEffect(() => {
    if (activeTab !== 'history') return
    if (!d?.pastTournaments?.length) return
    if (!userId) return
    const completedTournaments = d.pastTournaments.filter((t: any) => {
      const isCompleted = t.status === 'completed' || t.status === 'finished'
      const isCanceled = t.status === 'canceled' || t.status === 'cancelled'
      return isCompleted && !isCanceled
    })
    const toLoad = completedTournaments.slice(0, historyVisibleCount)
    const alreadyLoaded = toLoad.filter(t => pastTournamentDetails[t.id])
    if (alreadyLoaded.length === toLoad.length) {
      setPastTournamentLoading(false)
      return
    }
    let active = true
    setPastTournamentLoading(true)
    ;(async () => {
      try {
        const { fetchTournamentStandingsAndMatches } = await import('./lib/playerDashboardData')
        const results: Record<string, any> = { ...pastTournamentDetails }
        for (const t of toLoad) {
          if (!active) break
          if (results[t.id]) continue
          try {
            const data = await fetchTournamentStandingsAndMatches(t.id, userId!)
            results[t.id] = { standings: data.standings, myMatches: data.myMatches, playerPosition: data.playerPosition, tournamentName: data.tournamentName, categoryStandings: data.categoryStandings }
            if (active) {
              setPastTournamentDetails({ ...results })
              setHistoryLoadedCount(Object.keys(results).length)
            }
          } catch (err) {
            console.error(`[History] Error ${t.name}:`, err)
            results[t.id] = { standings: [], myMatches: [], tournamentName: t.name }
          }
        }
      } catch (err) {
        console.error('[History] ERROR:', err)
      }
      if (active) { setPastTournamentLoading(false); setHistoryFetched(true) }
    })()
    return () => { active = false }
  }, [activeTab, d?.pastTournaments?.length, historyVisibleCount, userId])

  const viewLeague = async (id: string, leagueName: string) => {
    setViewingLeague({ id, name: leagueName })
    setLeagueFull([])
    setLeagueCategories([])
    setLeagueLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('get-league-standings', {
        body: { league_id: id, player_name: dashboardData?.playerName },
      })
      
      if (error) {
        console.error('[League] Error:', error)
      } else if (data) {
        setLeagueFull(data.standings || [])
        setLeagueCategories(data.categories || [])
      }
    } catch (err) {
      console.error('[League] Error:', err)
    }
    setLeagueLoading(false)
  }

  const viewEnrolled = async (tournamentId: string, tournamentName: string) => {
    setViewingEnrolled({ id: tournamentId, name: tournamentName })
    setEnrolledLoading(true)
    setEnrolledData([])
    try {
      const data = await fetchEnrolledByCategory(tournamentId)
      setEnrolledData(data)
    } catch {
      setEnrolledData([])
    }
    setEnrolledLoading(false)
  }

  const openTournamentDetail = async (tournamentId: string) => {
    setSelectedTournamentLoading(true)
    setSelectedTournamentDetail(null)
    setCategoryDetails([])
    setExpandedDetailCats(new Set())
    setPendingInviteForTournament(null)
    try {
      const detail = await fetchTournamentFullDetail(tournamentId, player?.id)
      console.log('[CompeteScreen] DETAIL LOADED:', { format: detail?.format, round_robin_type: detail?.round_robin_type, name: detail?.name })
      setSelectedTournamentDetail(detail)
      if (player?.id) {
        const invites = await fetchMyTournamentInvites(player.id)
        const pending = invites.find(i => i.tournament_id === tournamentId && i.status === 'pending')
        if (pending) setPendingInviteForTournament(tournamentId)
      }
      if (detail) {
        const isAmericano = ['mixed_american', 'individual_groups_knockout', 'round_robin', 'ladder'].includes(detail.format)
        if (!isAmericano) {
          setCategoryDetailsLoading(true)
          try {
            const { fetchTournamentCategoryDetails } = await import('./lib/clubAndTournaments')
            const catDetails = await fetchTournamentCategoryDetails(tournamentId)
            setCategoryDetails(catDetails)
            const autoExpand = new Set<string>()
            catDetails.forEach(cd => { if (cd.hasData) autoExpand.add(cd.category_id) })
            if (autoExpand.size > 0) setExpandedDetailCats(autoExpand)
          } catch (err) {
            console.error('[CompeteScreen] Error loading category details:', err)
          }
          setCategoryDetailsLoading(false)
        }
      }
    } catch (err) {
      console.error('[CompeteScreen] Error loading tournament detail:', err)
    }
    setSelectedTournamentLoading(false)
  }

  const fetchPartnerInvites = useCallback(async () => {
    if (!player?.id) return
    setPartnerInvitesLoading(true)
    try {
      const invites = await fetchPendingPartnerInvites(player.id)
      setPendingPartnerInvites(invites)
    } finally {
      setPartnerInvitesLoading(false)
    }
  }, [player?.id])

  useEffect(() => {
    if (!player?.id) return
    void fetchPartnerInvites()
    const interval = window.setInterval(() => void fetchPartnerInvites(), 25000)
    const onVis = () => {
      if (document.visibilityState === 'visible') void fetchPartnerInvites()
    }
    document.addEventListener('visibilitychange', onVis)
    const rtFilter = userId
      ? `invitee_user_id=eq.${userId}`
      : `invitee_player_account_id=eq.${player.id}`
    const channel = supabase
      .channel(`compete-partner-invites-${userId ?? player.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'partner_match_invites',
          filter: rtFilter,
        },
        () => void fetchPartnerInvites(),
      )
      .subscribe()
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVis)
      void supabase.removeChannel(channel)
    }
  }, [player?.id, userId, fetchPartnerInvites])

  const loadPartnerRequestSummary = async (tournamentId: string) => {
    if (!player?.id) {
      setPartnerRequestSummary(null)
      return
    }
    const s = await fetchPartnerMatchRequesterSummary(tournamentId)
    setPartnerRequestSummary(s)
  }

  useEffect(() => {
    setPartnerRequestSummary(null)
    if (!selectedTournamentDetail?.id || !player?.id) return
    let cancelled = false
    ;(async () => {
      const s = await fetchPartnerMatchRequesterSummary(selectedTournamentDetail.id)
      if (!cancelled) setPartnerRequestSummary(s)
    })()
    return () => {
      cancelled = true
    }
  }, [selectedTournamentDetail?.id, player?.id])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const deepTournamentId = params.get('tournament')
    const deepInviteId = params.get('partner_invite')
    const deepConfirmId = params.get('partner_confirm')
    if (deepTournamentId) openTournamentDetail(deepTournamentId)
    if (deepInviteId) {
      setActiveTab('upcoming')
      fetchPartnerInvites()
    }
    if (deepConfirmId && deepTournamentId) {
      // Requester landed from push — summary will show confirm button
      setActiveTab('upcoming')
    }
  }, [])

  useEffect(() => {
    if (initialTournamentId) {
      openTournamentDetail(initialTournamentId)
      onInitialTournamentConsumed?.()
    }
  }, [initialTournamentId])

  const formatFormatName = (format: string) => {
    const formatMap: Record<string, string> = {
      'round_robin': t.common.tournamentFormatRoundRobin,
      'single_elimination': t.common.tournamentFormatSingleElimination,
      'groups_knockout': t.common.tournamentFormatGroupsKnockout,
      'individual_groups_knockout': t.common.tournamentFormatIndividualGroupsKnockout,
      'ladder': t.common.tournamentFormatLadder,
      'super_teams': 'Super Equipas', // TODO: traduzir
    }
    return formatMap[format] || format
  }

  const isPartnerMatchingEligible = (format?: string, roundRobinType?: string | null) => {
    if (!format) return false
    if (format === 'round_robin') return roundRobinType !== 'individual'
    return !['individual_groups_knockout', 'mixed_american'].includes(format)
  }

  const handlePartnerPhoneLookup = async (phone: string) => {
    const normalized = normalizePhone(phone)
    if (normalized.length < 6) {
      setPartnerInviteeLookup(null)
      return
    }
    setPartnerInviteeLooking(true)
    try {
      const { data } = await supabase
        .from('player_accounts')
        .select('name, court_position')
        .eq('phone_number', normalized)
        .not('user_id', 'is', null)
        .maybeSingle()
      if (data) {
        setPartnerInviteeLookup({ found: true, name: data.name, position: data.court_position || null })
      } else {
        setPartnerInviteeLookup({ found: false, name: null, position: null })
      }
    } catch {
      setPartnerInviteeLookup({ found: false, name: null, position: null })
    }
    setPartnerInviteeLooking(false)
  }

  const handlePartnerPhoneChange = (phone: string) => {
    setPartnerInviteePhone(phone)
    setPartnerInviteeLookup(null)
    if (partnerPhoneLookupRef.current) clearTimeout(partnerPhoneLookupRef.current)
    if (phone.replace(/\s+/g, '').length >= 6) {
      partnerPhoneLookupRef.current = setTimeout(() => handlePartnerPhoneLookup(phone), 500)
    }
  }

  const handleRequestPartner = async (tournament: TournamentFullDetail) => {
    setPartnerLoading(true)
    try {
      const result = await requestPartnerMatch({
        tournamentId: tournament.id,
        categoryId: null,
        sidePreference: partnerSide,
        targetMode: partnerTargetMode,
        minLevel: partnerMinLevel,
        maxLevel: partnerMaxLevel,
        ...(partnerTargetMode === 'direct' && partnerInviteePhone ? { inviteePhone: partnerInviteePhone } : {}),
      })
      if (partnerTargetMode === 'direct' && result?.invitesSent > 0) {
        const name = result?.inviteeName || 'jogador'
        alert(`Convite enviado para ${name}! O jogador pode aceitar em Compete → Convites de Parceiro.`)
      } else if (result?.invitesSent > 0) {
        const delivered = Number(result?.pushDelivered || 0)
        alert(
          `Convites registados para ${result.invitesSent} jogador(es). Cada um pode ver o convite em Compete → Convites de Parceiro (não precisa de notificação push).\n\nNotificações push entregues: ${delivered} (só para quem tem alertas ativos neste dispositivo).`,
        )
      } else {
        alert('Pedido criado, sem candidatos disponíveis de momento.')
      }
      setShowFindPartnerModal(false)
      setPartnerInviteePhone('')
      setPartnerInviteeLookup(null)
      await loadPartnerRequestSummary(tournament.id)
    } catch (error: any) {
      alert(error?.message || 'Não foi possível enviar o pedido.')
    } finally {
      setPartnerLoading(false)
    }
  }

  const handleAcceptInvite = async (invite: PartnerInvite) => {
    try {
      const result = await acceptPartnerInvite(invite.id)
      await fetchPartnerInvites()
      if (selectedTournamentDetail?.id) await loadPartnerRequestSummary(selectedTournamentDetail.id)
      alert(
        result?.awaitingConfirmation
          ? `Aceitaste o convite! Aguarda que ${result.requesterName || 'o parceiro'} confirme a inscrição da dupla.`
          : ((t as any).partner?.pairCreatedSuccess || 'Dupla criada e inscrita com sucesso.'),
      )
    } catch (error: any) {
      alert(error?.message || (t as any).partner?.acceptError || 'Não foi possível aceitar o convite.')
    }
  }

  const handleConfirmPartnerMatch = async (inviteId: string) => {
    try {
      const result = await confirmPartnerMatch(inviteId)
      if (selectedTournamentDetail?.id) {
        await loadPartnerRequestSummary(selectedTournamentDetail.id)
        const refreshed = await fetchTournamentFullDetail(selectedTournamentDetail.id, player?.id)
        if (refreshed) setSelectedTournamentDetail(refreshed)
      }
      if (result?.checkoutUrl) window.open(result.checkoutUrl, '_blank', 'noopener,noreferrer')
      alert(
        result?.checkoutUrl
          ? 'Inscrição criada. Completa o pagamento para confirmar.'
          : 'Inscrição da dupla confirmada com sucesso!',
      )
    } catch (error: any) {
      alert(error?.message || 'Não foi possível confirmar a inscrição.')
    }
  }

  const handleDeclineInvite = async (invite: PartnerInvite) => {
    try {
      await declinePartnerInvite(invite.id)
      await fetchPartnerInvites()
    } catch (error: any) {
      alert(error?.message || (t as any).partner?.declineError || 'Não foi possível recusar o convite.')
    }
  }

  // Se o detalhe do torneio está aberto, mostra a página de detalhe
  if (selectedTournamentDetail || selectedTournamentLoading) {
    const td = selectedTournamentDetail
    const enrolledIds = new Set((d?.upcomingTournaments ?? []).map((t) => t.id))
    const isEnrolled = td ? enrolledIds.has(td.id) : false

    return (
      <div className="space-y-4 animate-fade-in">
        <button
          onClick={() => { setSelectedTournamentDetail(null); setSelectedTournamentLoading(false) }}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" /> {t.common.back}
        </button>

        {selectedTournamentLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-3 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : td ? (
          <div className="space-y-4">
            {/* Header com imagem */}
            {td.image_url ? (
              <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: '4/5' }}>
                <img src={td.image_url} alt={td.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h1 className="text-xl font-bold text-white drop-shadow">{td.name}</h1>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-2xl p-6">
                <h1 className="text-xl font-bold text-white">{td.name}</h1>
              </div>
            )}

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${td.is_full ? 'bg-red-100 text-red-700' : td.status === 'active' ? 'bg-green-100 text-green-700' : td.status === 'completed' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-700'}`}>
                {td.is_full ? '🔴 Cheio' : td.status === 'active' ? '🟢 Aberto' : td.status === 'completed' ? '✅ Concluído' : td.status === 'draft' ? '📝 Rascunho' : td.status}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                🏸 {formatFormatName(td.format)}
              </span>
              {isEnrolled && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                  ✅ Inscrito
                </span>
              )}
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Data</p>
                  <p className="text-sm font-semibold text-gray-900">{formatDate(td.start_date)}</p>
                  {td.start_date !== td.end_date && (
                    <p className="text-xs text-gray-500">até {formatDate(td.end_date)}</p>
                  )}
                </div>
              </div>
              <div className="card p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Horário</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {td.daily_start_time || '09:00'} - {td.daily_end_time || '21:00'}
                  </p>
                </div>
              </div>
              <div className="card p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Users className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Inscritos</p>
                  <p className="text-sm font-semibold text-gray-900">{td.total_enrolled}</p>
                </div>
              </div>
              <div className="card p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Campos</p>
                  <p className="text-sm font-semibold text-gray-900">{td.number_of_courts}</p>
                </div>
              </div>
            </div>

            {/* Clube */}
            {td.club_name && (
              <div className="card p-4 flex items-center gap-3">
                {td.club_logo ? (
                  <img src={td.club_logo} alt={td.club_name} className="w-10 h-10 rounded-xl object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500">{td.club_name!.includes(' · ') ? 'Clubes' : 'Clube'}</p>
                  <p className="text-sm font-semibold text-gray-900">{td.club_name}</p>
                </div>
              </div>
            )}

            {/* Descrição */}
            {td.description && (
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">{(t as any).partner?.description || 'Descrição'}</h3>
                <div className="text-sm text-gray-600 [&_p]:my-1 [&_ul]:pl-4 [&_li]:list-disc" dangerouslySetInnerHTML={{ __html: td.description }} />
              </div>
            )}

            {partnerRequestSummary && (
              <div className="card p-4 border border-blue-100 bg-blue-50/60">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">{(t as any).partner?.invitesSent || 'Convites que enviaste'}</h3>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!td) return
                      setPartnerSummaryRefreshing(true)
                      try {
                        await loadPartnerRequestSummary(td.id)
                      } finally {
                        setPartnerSummaryRefreshing(false)
                      }
                    }}
                    disabled={partnerSummaryRefreshing}
                    className="p-1.5 rounded-lg text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                    aria-label="Atualizar estado dos convites"
                  >
                    <RefreshCw className={`w-4 h-4 ${partnerSummaryRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-1 mb-3">
                  {(t as any).partner?.invitesSentHint || 'Todos os jogadores convidados podem ver o convite em Compete → Convites de Parceiro, mesmo sem alertas no telemóvel.'}
                </p>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-gray-500">{(t as any).partner?.invited || 'Convidados'}</dt>
                    <dd className="font-semibold text-gray-900">{partnerRequestSummary.invitationsTotal}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">{(t as any).partner?.pending || 'Em espera'}</dt>
                    <dd className="font-semibold text-amber-800">{partnerRequestSummary.pending}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">{(t as any).partner?.declined || 'Recusaram'}</dt>
                    <dd className="font-semibold text-gray-800">{partnerRequestSummary.declined}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">{(t as any).partner?.accepted || 'Aceitaram'}</dt>
                    <dd className="font-semibold text-green-700">{partnerRequestSummary.accepted}</dd>
                  </div>
                </dl>
                {(partnerRequestSummary.expired > 0 || partnerRequestSummary.cancelled > 0) && (
                  <p className="text-xs text-gray-500 mt-2">
                    {partnerRequestSummary.expired > 0 && <span>Expirados: {partnerRequestSummary.expired}. </span>}
                    {partnerRequestSummary.cancelled > 0 && <span>Cancelados: {partnerRequestSummary.cancelled}.</span>}
                  </p>
                )}
                <p className="text-xs text-gray-700 mt-3 leading-relaxed">
                  {partnerRequestSummary.status === 'awaiting_confirmation' && partnerRequestSummary.acceptedInviteId
                    ? `${partnerRequestSummary.acceptedInviteeName || 'Um jogador'} aceitou o teu convite. Confirma a inscrição da dupla.`
                    : partnerRequestSummary.pending > 0
                      ? `Ainda há ${partnerRequestSummary.pending} convite(s) por responder — podes conseguir parceiro se alguém aceitar.`
                      : partnerRequestSummary.accepted > 0
                        ? 'Alguém aceitou o convite. Confirma a inscrição abaixo.'
                        : 'Ninguém aceitou ainda e não há convites em espera. Podes usar «Encontrar parceiro» de novo para convidar outros jogadores.'}
                </p>
                {partnerRequestSummary.status === 'awaiting_confirmation' && partnerRequestSummary.acceptedInviteId && (
                  <button
                    type="button"
                    onClick={() => void handleConfirmPartnerMatch(partnerRequestSummary.acceptedInviteId!)}
                    className="mt-3 w-full py-3 px-3 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors"
                  >
                    Confirmar inscrição com {partnerRequestSummary.acceptedInviteeName || 'parceiro'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm('Tens a certeza que queres cancelar este pedido de parceiro? Todos os convites pendentes serão cancelados.')) return
                    try {
                      await cancelPartnerRequest(partnerRequestSummary.requestId)
                      setPartnerRequestSummary(null)
                    } catch (err: any) {
                      alert(err?.message || 'Erro ao cancelar o pedido.')
                    }
                  }}
                  className="mt-3 w-full py-2 px-3 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                >
                  Cancelar pedido de parceiro
                </button>
              </div>
            )}

            {/* Botão de inscrição / aceitar convite */}
            {!isEnrolled && td.status === 'active' && (
              <div className="space-y-2">
                {pendingInviteForTournament === td.id ? (
                  <>
                    <div className="card p-3 border-2 border-amber-200 bg-amber-50/40 mb-2">
                      <p className="text-sm text-amber-800 font-medium flex items-center gap-2">
                        <span>🔒</span> Foste convidado para este torneio exclusivo
                      </p>
                    </div>
                    <button
                      disabled={inviteActionLoading}
                      onClick={async () => {
                        if (!player?.id) return
                        setInviteActionLoading(true)
                        try {
                          await updateTournamentInviteStatus(player.id, td.id, 'accepted')
                          setPendingInviteForTournament(null)
                          alert('Inscrição aceite com sucesso!')
                          const refreshed = await fetchTournamentFullDetail(td.id, player?.id)
                          if (refreshed) setSelectedTournamentDetail(refreshed)
                        } catch (err) {
                          alert('Erro ao aceitar o convite.')
                        } finally {
                          setInviteActionLoading(false)
                        }
                      }}
                      className="flex items-center justify-center gap-2 w-full py-3.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
                    >
                      {inviteActionLoading ? 'A processar...' : 'Aceitar convite e inscrever-me'}
                    </button>
                    <button
                      disabled={inviteActionLoading}
                      onClick={async () => {
                        if (!player?.id) return
                        if (!confirm('Tens a certeza que queres recusar este convite?')) return
                        setInviteActionLoading(true)
                        try {
                          await updateTournamentInviteStatus(player.id, td.id, 'declined')
                          setPendingInviteForTournament(null)
                          setSelectedTournamentDetail(null)
                          setSelectedTournamentLoading(false)
                        } catch (err) {
                          alert('Erro ao recusar o convite.')
                        } finally {
                          setInviteActionLoading(false)
                        }
                      }}
                      className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-700 font-medium rounded-xl transition-colors"
                    >
                      Recusar convite
                    </button>
                  </>
                ) : (
                  <>
                    <a
                      href={getTournamentRegistrationUrl(td.id, player?.phone_number || undefined)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors"
                    >
                      {(t as any).partner?.registerMe || 'Inscrever-me'}
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    {isPartnerMatchingEligible(td.format, (td as any).round_robin_type || null) && (
                      <button
                        onClick={() => {
                          const lvl = player?.level ?? 3.0
                          setPartnerMinLevel(Math.max(1, parseFloat((lvl - 1).toFixed(1))))
                          setPartnerMaxLevel(Math.min(7, parseFloat((lvl + 1).toFixed(1))))
                          setShowFindPartnerModal(true)
                        }}
                        className="flex items-center justify-center gap-2 w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
                      >
                        {(t as any).partner?.findPartner || 'Encontrar Parceiro'}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Categorias: grupos, jogos e brackets (ou inscritos) */}
            {categoryDetailsLoading ? (
              <div className="card p-6 flex justify-center">
                <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {td.enrolled.length === 0 && categoryDetails.length === 0 ? (
                  <div className="card p-4">
                    <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-red-600" />
                      {(t as any).partner?.enrolledList || 'Inscritos'} ({td.total_enrolled})
                    </h3>
                    <p className="text-gray-500 text-center py-4">{(t as any).partner?.noEnrolled || 'Ainda sem inscritos.'}</p>
                  </div>
                ) : (
                  (() => {
                    const catDetailsMap = new Map(categoryDetails.map(cd => [cd.category_id, cd]))
                    const knockoutOrderLocal: Record<string, number> = { 'round_of_16': 0, 'quarter': 1, 'semi': 2, '3rd': 3, 'final': 4 }
                    const getKOOrder = (round: string) => {
                      const r = round.toLowerCase()
                      for (const [key, val] of Object.entries(knockoutOrderLocal)) { if (r.includes(key)) return val }
                      return 99
                    }
                    const knockoutLabelLocal = (round: string) => {
                      const r = round.toLowerCase()
                      if (r.includes('final') && !r.includes('semi') && !r.includes('quarter')) return 'Final'
                      if (r.includes('3rd')) return '3º/4º Lugar'
                      if (r.includes('semi')) return 'Meia-final'
                      if (r.includes('quarter')) return 'Quartos-de-final'
                      if (r.includes('round_of_16')) return 'Oitavos-de-final'
                      return round
                    }
                    const isAmericanoFormat = ['mixed_american', 'individual_groups_knockout', 'round_robin', 'ladder'].includes(td.format)
                    return td.enrolled.map((cat) => {
                      let catDetail = catDetailsMap.get(cat.category_id)
                      if (!catDetail && categoryDetails.length === 1) catDetail = categoryDetails[0]
                      const hasGroupsOrMatches = !isAmericanoFormat && catDetail?.hasData
                      const isExpanded = expandedDetailCats.has(cat.category_id)
                      const sortedKnockout = catDetail ? [...catDetail.knockoutMatches].sort((a, b) => getKOOrder(a.round) - getKOOrder(b.round)) : []

                      return (
                        <div key={cat.category_id} className="card p-4">
                          <button
                            onClick={() => setExpandedDetailCats(prev => {
                              const next = new Set(prev)
                              if (next.has(cat.category_id)) next.delete(cat.category_id)
                              else next.add(cat.category_id)
                              return next
                            })}
                            className="w-full flex items-center justify-between"
                          >
                            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-red-500" />
                              {cat.category_name}
                              <span className="text-xs font-normal text-gray-400">{cat.items.length} inscrito{cat.items.length !== 1 ? 's' : ''}</span>
                            </h3>
                            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </button>

                          {isExpanded && (
                            <div className="mt-3 space-y-3">
                              {td.format === 'ladder' && (
                                <PlayerLadderTournamentPanel
                                  tournamentId={td.id}
                                  categoryId={cat.category_id}
                                  authUserId={userId}
                                  playerAccountId={playerAccountId}
                                  tournamentName={td.name}
                                  onOpenChallengeChat={onOpenCommunityGroupChat}
                                />
                              )}
                              {hasGroupsOrMatches && catDetail ? (
                                <>
                                  {Object.keys(catDetail.groups).length > 0 && (
                                    Object.entries(catDetail.groups).sort(([a], [b]) => a.localeCompare(b)).map(([groupName, rows]) => {
                                      const groupTeamIds = new Set(rows.map(r => r.id))
                                      const matchesForGroup = catDetail.groupMatches.filter(m => {
                                        const r = m.round || ''
                                        if (r.includes(groupName) || r === `group_${groupName}` || r === `group ${groupName}`) return true
                                        if ((m.team1_id && groupTeamIds.has(m.team1_id)) || (m.team2_id && groupTeamIds.has(m.team2_id))) return true
                                        return false
                                      })
                                      return (
                                        <div key={groupName}>
                                          {Object.keys(catDetail.groups).length > 1 && (
                                            <p className="text-xs font-bold text-blue-600 mb-1">Grupo {groupName}</p>
                                          )}
                                          <table className="w-full text-sm mb-1">
                                            <thead>
                                              <tr className="text-gray-500 border-b">
                                                <th className="py-1 px-1 text-left font-medium w-6">#</th>
                                                <th className="py-1 px-1 text-left font-medium min-w-0">Nome</th>
                                                <th className="py-1 px-1 text-center font-medium w-6">V</th>
                                                <th className="py-1 px-1 text-center font-medium w-6">E</th>
                                                <th className="py-1 px-1 text-center font-medium w-6">D</th>
                                                <th className="py-1 px-1 text-center font-medium w-8">+/-</th>
                                                <th className="py-1 px-1 text-center font-semibold w-8">Pts</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {rows.map((row, i) => {
                                                const diff = row.points_for - row.points_against
                                                return (
                                                  <tr key={row.id} className="border-b border-gray-50">
                                                    <td className="py-1 px-1 text-xs">{i + 1}</td>
                                                    <td className="py-1 px-1 min-w-0">
                                                      <div className="font-medium break-words text-xs">{row.name}</div>
                                                    </td>
                                                    <td className="py-1 px-1 text-center text-green-600 text-xs">{row.wins}</td>
                                                    <td className="py-1 px-1 text-center text-yellow-600 text-xs">{row.draws}</td>
                                                    <td className="py-1 px-1 text-center text-red-500 text-xs">{row.losses}</td>
                                                    <td className={`py-1 px-1 text-center text-[10px] ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>{diff > 0 ? '+' : ''}{diff}</td>
                                                    <td className="py-1 px-1 text-center font-bold text-xs">{row.points}</td>
                                                  </tr>
                                                )
                                              })}
                                            </tbody>
                                          </table>
                                          {matchesForGroup.length > 0 && (
                                            <div className="space-y-1 mb-1">
                                              <p className="text-[10px] font-medium text-gray-400 uppercase">Jogos do Grupo</p>
                                              {matchesForGroup.map((m) => {
                                                const scores = [m.set1, m.set2, m.set3].filter(Boolean).join(' ')
                                                return (
                                                  <div key={m.id} className="flex justify-between items-center text-xs py-1 px-2 bg-gray-50 rounded">
                                                    <div className="flex-1 min-w-0">
                                                      <span className="text-gray-700">{m.team1_name}</span>
                                                      <span className="text-gray-400 mx-1">vs</span>
                                                      <span className="text-gray-700">{m.team2_name}</span>
                                                    </div>
                                                    <span className="font-semibold text-gray-800 ml-2 flex-shrink-0">{scores || (m.status === 'completed' ? '0-0' : '-')}</span>
                                                  </div>
                                                )
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })
                                  )}
                                  {Object.keys(catDetail.groups).length === 0 && catDetail.groupMatches.length > 0 && (
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-medium text-gray-400 uppercase">Jogos</p>
                                      {catDetail.groupMatches.map((m) => {
                                        const scores = [m.set1, m.set2, m.set3].filter(Boolean).join(' ')
                                        return (
                                          <div key={m.id} className="flex justify-between items-center text-xs py-1 px-2 bg-gray-50 rounded">
                                            <div className="flex-1 min-w-0">
                                              <span className="text-gray-700">{m.team1_name}</span>
                                              <span className="text-gray-400 mx-1">vs</span>
                                              <span className="text-gray-700">{m.team2_name}</span>
                                            </div>
                                            <span className="font-semibold text-gray-800 ml-2 flex-shrink-0">{scores || (m.status === 'completed' ? '0-0' : '-')}</span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                  {sortedKnockout.length > 0 && (
                                    <div className="pt-2 border-t border-gray-100">
                                      <p className="text-xs font-bold text-orange-600 mb-1">Fase Eliminatória</p>
                                      <div className="space-y-1">
                                        {sortedKnockout.map((m) => {
                                          const scores = [m.set1, m.set2, m.set3].filter(Boolean).join(' ')
                                          return (
                                            <div key={m.id} className="flex justify-between items-center text-xs py-1.5 px-2 bg-orange-50 rounded">
                                              <div className="flex-1 min-w-0">
                                                <span className="text-[10px] text-orange-500 font-medium mr-1">{knockoutLabelLocal(m.round)}</span>
                                                <span className="text-gray-700">{m.team1_name}</span>
                                                <span className="text-gray-400 mx-1">vs</span>
                                                <span className="text-gray-700">{m.team2_name}</span>
                                              </div>
                                              <span className="font-semibold text-gray-800 ml-2 flex-shrink-0">{scores || (m.status === 'completed' ? '0-0' : '-')}</span>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="space-y-1.5">
                                  {cat.items.map((item, idx) => (
                                    <div key={item.id} className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg">
                                      <span className="text-xs font-semibold text-gray-400 w-5 text-right">{idx + 1}</span>
                                      <div className="flex-1 min-w-0">
                                        {item.player_names?.length ? (
                                          <p className="text-sm text-gray-900 font-medium truncate">{item.name}</p>
                                        ) : item.player1_name || item.player2_name ? (
                                          <div>
                                            <p className="text-sm text-gray-900 font-medium truncate">{item.name}</p>
                                            <p className="text-xs text-gray-500 truncate">{[item.player1_name, item.player2_name].filter(Boolean).join(' / ')}</p>
                                          </div>
                                        ) : (
                                          <p className="text-sm text-gray-900 font-medium truncate">{item.name}</p>
                                        )}
                                        {item.player_names && item.player_names.length > 0 && (
                                          <p className="text-xs text-gray-500 truncate">{item.player_names.join(' · ')}</p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })
                  })()
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="card p-8 text-center text-gray-500">{(t as any).partner?.tournamentNotFound || 'Torneio não encontrado.'}</div>
        )}
        {showFindPartnerModal && td && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl p-4 w-full max-w-md space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">{(t as any).partner?.findPartner || 'Encontrar Parceiro'}</h3>
                <button onClick={() => { setShowFindPartnerModal(false); setPartnerInviteePhone(''); setPartnerInviteeLookup(null); }} className="p-1 rounded hover:bg-gray-100">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">{(t as any).partner?.positionQuestion || 'Que posição procuras no parceiro?'}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPartnerSide('right')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${partnerSide === 'right' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{(t as any).partner?.right || 'Direita'}</button>
                  <button onClick={() => setPartnerSide('left')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${partnerSide === 'left' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{(t as any).partner?.left || 'Esquerda'}</button>
                  <button onClick={() => setPartnerSide('both')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${partnerSide === 'both' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{(t as any).partner?.both || 'Ambos'}</button>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">{(t as any).partner?.targetQuestion || 'Como queres encontrar parceiro?'}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPartnerTargetMode('any')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${partnerTargetMode === 'any' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{(t as any).partner?.anyone || 'Qualquer um'}</button>
                  <button onClick={() => setPartnerTargetMode('following')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${partnerTargetMode === 'following' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{(t as any).partner?.followingOnly || 'Quem sigo'}</button>
                  <button onClick={() => setPartnerTargetMode('direct')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${partnerTargetMode === 'direct' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{(t as any).partner?.directInvite || 'Convidar'}</button>
                </div>
              </div>
              {partnerTargetMode === 'direct' && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">{(t as any).partner?.inviteePhoneLabel || 'Telemóvel do parceiro'}</p>
                  <div className="relative">
                    <input
                      type="tel"
                      value={partnerInviteePhone}
                      onChange={(e) => handlePartnerPhoneChange(e.target.value)}
                      className={`w-full p-2.5 border rounded-lg text-sm ${partnerInviteeLookup?.found ? 'border-green-400 bg-green-50' : partnerInviteeLookup && !partnerInviteeLookup.found ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                      placeholder="+351 912 345 678"
                    />
                    {partnerInviteeLooking && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  {partnerInviteeLookup?.found && (
                    <div className="mt-2 p-2.5 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                      <span className="text-green-600 text-lg">✓</span>
                      <div>
                        <p className="text-sm font-semibold text-green-800">{partnerInviteeLookup.name}</p>
                        {partnerInviteeLookup.position && (
                          <p className="text-xs text-green-600">Posição: {partnerInviteeLookup.position === 'right' ? 'Direita' : partnerInviteeLookup.position === 'left' ? 'Esquerda' : 'Ambos'}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {partnerInviteeLookup && !partnerInviteeLookup.found && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-xs text-red-600">Nenhum jogador encontrado com este número.</p>
                    </div>
                  )}
                  {!partnerInviteeLookup && !partnerInviteeLooking && (
                    <p className="text-xs text-gray-500 mt-1">{(t as any).partner?.inviteePhoneHint || 'O jogador tem que estar registado na app.'}</p>
                  )}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Intervalo de nível</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Mín</label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPartnerMinLevel(v => Math.max(1, parseFloat((v - 0.5).toFixed(1))))}
                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 text-lg font-bold active:bg-gray-100"
                      >−</button>
                      <span className="flex-1 text-center text-sm font-semibold text-gray-800">{partnerMinLevel.toFixed(1)}</span>
                      <button
                        type="button"
                        onClick={() => setPartnerMinLevel(v => Math.min(7, parseFloat((v + 0.5).toFixed(1))))}
                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 text-lg font-bold active:bg-gray-100"
                      >+</button>
                    </div>
                  </div>
                  <span className="text-gray-400 mt-5">—</span>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Máx</label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPartnerMaxLevel(v => Math.max(1, parseFloat((v - 0.5).toFixed(1))))}
                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 text-lg font-bold active:bg-gray-100"
                      >−</button>
                      <span className="flex-1 text-center text-sm font-semibold text-gray-800">{partnerMaxLevel.toFixed(1)}</span>
                      <button
                        type="button"
                        onClick={() => setPartnerMaxLevel(v => Math.min(7, parseFloat((v + 0.5).toFixed(1))))}
                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 text-lg font-bold active:bg-gray-100"
                      >+</button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">O teu nível: {player?.level?.toFixed(2) || '—'}</p>
              </div>
              <button
                onClick={() => handleRequestPartner(td)}
                disabled={partnerLoading || partnerMinLevel > partnerMaxLevel || (partnerTargetMode === 'direct' && (!partnerInviteeLookup?.found || partnerInviteePhone.replace(/\s+/g, '').length < 6))}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold"
              >
                {partnerLoading
                  ? ((t as any).partner?.searching || 'A procurar...')
                  : partnerTargetMode === 'direct'
                    ? ((t as any).partner?.sendInvite || 'Enviar Convite')
                    : ((t as any).partner?.find || 'Encontrar')}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-5 h-5" /> {t.common.back}
      </button>
      <h1 className="text-xl font-bold text-gray-900">{t.menu.compete}</h1>
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 min-w-0 py-2 px-3 rounded-lg text-sm font-medium whitespace-nowrap ${activeTab === 'upcoming' ? 'bg-red-600 text-white' : 'text-gray-600'}`}
        >
          {t.home.tournaments}
        </button>
        <button
          onClick={() => setActiveTab('leagues')}
          className={`flex-1 min-w-0 py-2 px-3 rounded-lg text-sm font-medium whitespace-nowrap ${activeTab === 'leagues' ? 'bg-red-600 text-white' : 'text-gray-600'}`}
        >
          {t.games.leagues}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 min-w-0 py-2 px-3 rounded-lg text-sm font-medium whitespace-nowrap ${activeTab === 'history' ? 'bg-red-600 text-white' : 'text-gray-600'}`}
        >
          {t.games.history}
        </button>
      </div>

      {activeTab === 'upcoming' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">{(t as any).partner?.partnerInvites || 'Convites de Parceiro'}</h3>
            <p className="text-xs text-gray-500 mb-3">{(t as any).partner?.partnerInvitesHint || 'Aparecem aqui mesmo sem notificações push ativadas — abre a app para veres e responderes.'}</p>
            {partnerInvitesLoading ? (
              <p className="text-sm text-gray-500">{(t as any).partner?.loading || 'A carregar...'}</p>
            ) : pendingPartnerInvites.length === 0 ? (
              <p className="text-sm text-gray-500">{(t as any).partner?.noPending || 'Sem convites pendentes.'}</p>
            ) : (
              <div className="space-y-2">
                {pendingPartnerInvites.map((inv) => (
                  <div key={inv.id} className="border border-gray-200 rounded-lg p-3">
                    <p className="text-sm text-gray-800">
                      <span className="font-semibold">{inv.requester_name || 'Jogador'}</span> {(t as any).partner?.invitedYouTo || 'convidou-o para o torneio'} <span className="font-semibold">{inv.tournament_name || 'Torneio'}</span>.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => handleAcceptInvite(inv)} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold">{t.home.accept}</button>
                      <button onClick={() => handleDeclineInvite(inv)} className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 text-xs font-semibold">{t.home.decline}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {loadingUpcoming ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (() => {
            const enrolledIds = new Set((d?.upcomingTournaments ?? []).map((t) => t.id))
            const tourById = new Map(upcomingFromTour.map((t) => [t.id, t]))
            const enrolledNotInList = (d?.upcomingTournaments ?? []).filter((t) => !tourById.has(t.id))
            const enrolledFromTour = upcomingFromTour.filter((t) => enrolledIds.has(t.id))
            const othersFromTour = upcomingFromTour.filter((t) => !enrolledIds.has(t.id))
            const enrolledMinimal: UpcomingTournamentFromTour[] = enrolledNotInList.map((t) => ({
              id: t.id,
              name: t.name,
              start_date: t.start_date,
              end_date: t.end_date,
              status: t.status || 'active',
              image_url: null,
              description: null,
            }))
            const enrolledList = [
              ...enrolledMinimal.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()),
              ...enrolledFromTour,
            ]
            const openList = othersFromTour
            const TournamentCard = ({ t, isEnrolled }: { t: UpcomingTournamentFromTour; isEnrolled: boolean }) => {
              const count = tourEnrolledCounts.get(t.id) ?? 0
              return (
              <div
                key={t.id}
                className="card overflow-hidden p-0 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => openTournamentDetail(t.id)}
              >
                <div className="relative w-full" style={{ aspectRatio: '4/5' }}>
                  {t.image_url ? (
                    <img src={t.image_url} alt={t.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-red-100 to-amber-100 flex flex-col items-center justify-center gap-3">
                      <Trophy className="w-16 h-16 text-red-400/70" />
                      <h3 className="font-bold text-gray-700 text-lg text-center px-4 line-clamp-2">{t.name}</h3>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(t.start_date)}
                      </p>
                      {count > 0 && (
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {count} inscritos
                        </p>
                      )}
                      {t.host_clubs_label && (
                        <p className="text-xs text-gray-600 flex items-center justify-center gap-1 px-4 text-center max-w-full">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="line-clamp-2">{t.host_clubs_label}</span>
                        </p>
                      )}
                    </div>
                  )}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    {count > 0 && (
                      <span className="px-2 py-1 rounded-lg text-xs font-medium bg-blue-600 text-white shadow flex items-center gap-1">
                        <Users className="w-3 h-3" />{count}
                      </span>
                    )}
                    {t.is_invited && (
                      <span className="px-2 py-1 rounded-lg text-xs font-medium bg-amber-500 text-white shadow">🔒 Convite</span>
                    )}
                    {isEnrolled && (
                      <span className="px-2 py-1 rounded-lg text-xs font-medium bg-green-500 text-white shadow">Inscrito</span>
                    )}
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium shadow ${t.is_full ? 'bg-red-600 text-white' : t.status === 'active' || t.status === 'in_progress' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'}`}>
                      {t.is_full ? 'Cheio' : t.status === 'active' || t.status === 'in_progress' ? 'Aberto' : t.status}
                    </span>
                  </div>
                  {t.image_url && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                      <h3 className="font-bold text-white text-sm line-clamp-1 drop-shadow">{t.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-white/80 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(t.start_date)}
                        </p>
                        {count > 0 && (
                          <p className="text-xs text-white/80 flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {count} inscritos
                          </p>
                        )}
                      </div>
                      {t.host_clubs_label && (
                        <p className="text-xs text-white/75 flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="line-clamp-2">{t.host_clubs_label}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            return (
              <div className="space-y-6">
                {enrolledList.length > 0 ? (
                  <div className="space-y-4">
                    {enrolledList.map((t) => (
                      <TournamentCard key={t.id} t={t} isEnrolled={true} />
                    ))}
                  </div>
                ) : (
                  <div className="card p-8 text-center text-gray-500">
                    {t.common.noTournamentsEnrolled}
                  </div>
                )}

                {/* Torneios Disponíveis */}
                {(() => {
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <span>🎯</span> {t.home.availableTournaments}
                        </h2>
                      </div>
                      <div className="space-y-4">
                        {loadingAvailable ? (
                          <div className="card p-6 text-center">
                            <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
                          </div>
                        ) : availableTournaments.length > 0 ? (
                          availableTournaments.map((tournament) => (
                            <TournamentCard key={tournament.id} t={tournament} isEnrolled={false} />
                          ))
                        ) : (
                          <div className="card p-6 text-center">
                            <span className="text-4xl mb-2 block">🎯</span>
                            <p className="text-gray-700 font-medium">
                              {player?.level != null
                                ? `Nenhum torneio disponível para o teu nível (${(player?.level ?? 0).toFixed(2)})`
                                : 'Nenhum torneio disponível'}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">{t.common.checkTourApp}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })()}
        </div>
      )}

      {activeTab === 'leagues' && (() => {
        const getPlayerLeagueCategory = (leagueCategories?: string[]): string | null => {
          if (!leagueCategories || leagueCategories.length === 0) return null

          // Check if categories are level ranges
          const pLevel = player?.level != null ? Number(player.level) : null
          let foundLevel = false
          if (pLevel != null) {
            for (const cat of leagueCategories) {
              const c = cat.trim()
              const plusMatch = c.match(/^[+>]\s*(\d+(?:\.\d+)?)$/)
              if (plusMatch) {
                foundLevel = true
                if (pLevel >= parseFloat(plusMatch[1])) return c
                continue
              }
              const rangeMatch = c.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/)
              if (rangeMatch) {
                foundLevel = true
                const min = parseFloat(rangeMatch[1])
                const max = parseFloat(rangeMatch[2])
                if (pLevel >= min && pLevel <= max) return c
                continue
              }
            }
            if (foundLevel) return null
          }

          // Check if categories are gender-based
          const genderLabels = ['masculino', 'feminino', 'male', 'female', 'masc', 'fem']
          const isGender = leagueCategories.every(c => genderLabels.includes(c.trim().toLowerCase()))
          if (isGender) {
            const playerCat = player?.player_category as string | undefined
            const playerGender = player?.gender as string | undefined
            const isMale = (playerCat && playerCat.startsWith('M')) || playerGender === 'male'
            const isFemale = (playerCat && playerCat.startsWith('F')) || playerGender === 'female'
            for (const cat of leagueCategories) {
              const lower = cat.trim().toLowerCase()
              if (isMale && (lower === 'masculino' || lower === 'male' || lower === 'masc')) return cat
              if (isFemale && (lower === 'feminino' || lower === 'female' || lower === 'fem')) return cat
            }
          }

          return null
        }
        return (
        <div className="space-y-4">
          {leaguesLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
            </div>
          ) : leagueStandings.length > 0 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Ligas onde participas</h2>
              {[...leagueStandings].sort((a, b) => {
                const aFinished = a.league_status === 'completed' ? 1 : 0
                const bFinished = b.league_status === 'completed' ? 1 : 0
                return aFinished - bFinished
              }).map((s, idx) => {
                const isFinished = s.league_status === 'completed'
                const categoryLabel = getPlayerLeagueCategory(s.league_categories)
                return (
                  <div key={idx} className={`card p-6 flex flex-col items-center justify-center text-center relative ${isFinished ? 'bg-gray-100 border-gray-300 opacity-75' : ''}`}>
                    {isFinished && (
                      <span className="absolute top-3 right-3 bg-gray-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Terminada</span>
                    )}
                    <h3 className={`text-base font-bold ${isFinished ? 'text-gray-500' : 'text-gray-600'}`}>{s.league_name}</h3>
                    {categoryLabel && (
                      <span className={`mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isFinished ? 'bg-gray-200 text-gray-600' : 'bg-red-100 text-red-700'}`}>Nível {categoryLabel}</span>
                    )}
                    <p className="text-2xl mt-3 flex items-center justify-center gap-2">
                      <span className="text-3xl">{isFinished ? '🏁' : '🏆'}</span>
                      <span className={`font-bold text-3xl ${isFinished ? 'text-gray-500' : 'text-red-600'}`}>{s.position}º</span>
                      <span className={`text-xl ${isFinished ? 'text-gray-400' : 'text-gray-600'}`}> de {s.total_participants} · </span>
                      <span className={`font-semibold text-xl ${isFinished ? 'text-gray-600' : 'text-gray-900'}`}>{s.points} pts</span>
                    </p>
                    <button onClick={() => viewLeague(s.league_id, s.league_name)} className={`mt-4 text-base font-semibold flex items-center gap-1 ${isFinished ? 'text-gray-500' : 'text-red-600'}`}>
                      Ver classificação <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <Trophy className="w-16 h-16 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">Ainda não participas em nenhuma liga.</p>
              <p className="text-sm text-gray-400 mt-1">{t.common.enrollInTournaments}</p>
            </div>
          )}
        </div>
        )
      })()}

      {activeTab === 'history' && (() => {
        const knockoutRounds = ['quarter', 'semi', 'final', '3rd', 'round_of_16']
        const isKnockoutRound = (round: string) => knockoutRounds.some(k => round.toLowerCase().includes(k))
        const knockoutOrder: Record<string, number> = { 'round_of_16': 0, 'quarter': 1, 'semi': 2, '3rd': 3, 'final': 4 }
        const getKnockoutOrder = (round: string) => {
          const r = round.toLowerCase()
          for (const [key, val] of Object.entries(knockoutOrder)) { if (r.includes(key)) return val }
          return 99
        }
        const knockoutLabel = (round: string) => {
          const r = round.toLowerCase()
          if (r.includes('final') && !r.includes('semi') && !r.includes('quarter')) return 'Final'
          if (r.includes('3rd')) return '3º/4º Lugar'
          if (r.includes('semi')) return 'Meia-final'
          if (r.includes('quarter')) return 'Quartos-de-final'
          if (r.includes('round_of_16')) return 'Oitavos-de-final'
          return round
        }

        const renderCategoryContent = (catDetail: any, myTeamNames: Set<string>) => {
          const groupMap = new Map<string, any[]>()
          catDetail.standings.forEach((row: any) => {
            const gn = row.group_name || 'Geral'
            if (!groupMap.has(gn)) groupMap.set(gn, [])
            groupMap.get(gn)!.push(row)
          })
          const sortedGroups = Array.from(groupMap.keys()).sort()
          const groupMatches = (catDetail.allMatches || []).filter((m: any) => !isKnockoutRound(m.round))
          const knockoutMatches = (catDetail.allMatches || []).filter((m: any) => isKnockoutRound(m.round))
          knockoutMatches.sort((a: any, b: any) => getKnockoutOrder(a.round) - getKnockoutOrder(b.round))

          return (
            <>
              {sortedGroups.map((groupName) => {
                const groupRows = groupMap.get(groupName) || []
                const groupTeamIds = new Set(groupRows.map((r: any) => r.id))
                const matchesForGroup = groupMatches.filter((m: any) => {
                  const r = m.round || ''
                  if (r.includes(groupName) || r === `group_${groupName}` || r === `group ${groupName}`) return true
                  if (groupTeamIds.has(m.team1_id) || groupTeamIds.has(m.team2_id)) return true
                  return false
                })
                return (
                  <div key={groupName} className="mb-3">
                    {sortedGroups.length > 1 && (
                      <p className="text-xs font-bold text-blue-600 mb-1">Grupo {groupName}</p>
                    )}
                    <table className="w-full text-sm mb-1">
                      <thead>
                        <tr className="text-gray-500 border-b">
                          <th className="py-1 px-1 text-left font-medium w-6">#</th>
                          <th className="py-1 px-1 text-left font-medium min-w-0">Nome</th>
                          <th className="py-1 px-1 text-center font-medium w-6">V</th>
                          <th className="py-1 px-1 text-center font-medium w-6">E</th>
                          <th className="py-1 px-1 text-center font-medium w-6">D</th>
                          <th className="py-1 px-1 text-center font-medium w-8">+/-</th>
                          <th className="py-1 px-1 text-center font-semibold w-8">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupRows.map((row: any, i: number) => {
                          const diff = (row.points_for ?? 0) - (row.points_against ?? 0)
                          const isMe = myTeamNames.has(row.name)
                          return (
                            <tr key={row.id} className={`border-b border-gray-50 ${isMe ? 'bg-red-50 font-semibold' : ''}`}>
                              <td className="py-1 px-1 text-xs">{i + 1}</td>
                              <td className="py-1 px-1 min-w-0">
                                <div className="font-medium break-words text-xs">{row.name}</div>
                                {row.player1_name && <div className="text-[10px] text-gray-500 break-words">{row.player1_name}</div>}
                                {row.player2_name && <div className="text-[10px] text-gray-500 break-words">{row.player2_name}</div>}
                              </td>
                              <td className="py-1 px-1 text-center text-green-600 text-xs">{row.wins}</td>
                              <td className="py-1 px-1 text-center text-yellow-600 text-xs">{row.draws ?? 0}</td>
                              <td className="py-1 px-1 text-center text-red-500 text-xs">{row.losses}</td>
                              <td className={`py-1 px-1 text-center text-[10px] ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>{diff > 0 ? '+' : ''}{diff}</td>
                              <td className="py-1 px-1 text-center font-bold text-xs">{row.points}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {matchesForGroup.length > 0 && (
                      <div className="space-y-1 mb-1">
                        <p className="text-[10px] font-medium text-gray-400 uppercase">Jogos do Grupo</p>
                        {matchesForGroup.map((m: any) => {
                          const scores = [m.set1, m.set2, m.set3].filter(Boolean).join(' ')
                          return (
                            <div key={m.id} className="flex justify-between items-center text-xs py-1 px-2 bg-gray-50 rounded">
                              <div className="flex-1 min-w-0">
                                <span className="text-gray-700">{m.team1_name}</span>
                                <span className="text-gray-400 mx-1">vs</span>
                                <span className="text-gray-700">{m.team2_name}</span>
                              </div>
                              <span className="font-semibold text-gray-800 ml-2 flex-shrink-0">{scores || '-'}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              {knockoutMatches.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-xs font-bold text-orange-600 mb-1">Fase Eliminatória</p>
                  <div className="space-y-1">
                    {knockoutMatches.map((m: any) => {
                      const scores = [m.set1, m.set2, m.set3].filter(Boolean).join(' ')
                      return (
                        <div key={m.id} className="flex justify-between items-center text-xs py-1.5 px-2 bg-orange-50 rounded">
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] text-orange-500 font-medium mr-1">{knockoutLabel(m.round)}</span>
                            <span className="text-gray-700">{m.team1_name}</span>
                            <span className="text-gray-400 mx-1">vs</span>
                            <span className="text-gray-700">{m.team2_name}</span>
                          </div>
                          <span className="font-semibold text-gray-800 ml-2 flex-shrink-0">{scores || '-'}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )
        }

        const completedTournaments = (d?.pastTournaments || []).filter((t: any) => {
          const isCompleted = t.status === 'completed' || t.status === 'finished'
          const isCanceled = t.status === 'canceled' || t.status === 'cancelled'
          return isCompleted && !isCanceled
        })
        const visibleTournaments = completedTournaments.slice(0, historyVisibleCount)
        const hasMore = completedTournaments.length > historyVisibleCount

        return (
        <div className="space-y-4">
          {pastTournamentLoading && Object.keys(pastTournamentDetails).length === 0 ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : visibleTournaments.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Torneios concluídos ({completedTournaments.length})</p>
              {visibleTournaments.map((t: any) => {
                const details = effectivePastDetails[t.id]
                const wins = details?.myMatches?.filter((m: any) => m.is_winner).length ?? 0
                const losses = details?.myMatches?.filter((m: any) => m.is_winner === false).length ?? 0
                const hasCats = details?.categoryStandings && Object.keys(details.categoryStandings).length > 0
                const expandedCats = expandedCategories[t.id] || new Set<string>()

                let myCatIds: string[] = []
                let otherCatIds: string[] = []
                if (hasCats) {
                  Object.entries(details.categoryStandings).forEach(([catId, catDetail]: [string, any]) => {
                    if (catDetail.myMatches && catDetail.myMatches.length > 0) {
                      myCatIds.push(catId)
                    } else {
                      otherCatIds.push(catId)
                    }
                  })
                }

                return (
                  <div key={t.id} className="card overflow-hidden p-0">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{t.name}</h3>
                          <p className="text-sm text-gray-500 mt-0.5">{formatDate(t.start_date)}</p>
                          {details && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {details.playerPosition != null && !hasCats && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-medium">
                                  <Trophy className="w-3.5 h-3.5" /> {details.playerPosition}º lugar
                                </span>
                              )}
                              {(wins > 0 || losses > 0) && (
                                <span className="inline-flex items-center px-2 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium">
                                  {wins}V {losses}D
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {!details && (
                          <span className="text-xs text-gray-400 animate-pulse flex-shrink-0">A carregar...</span>
                        )}
                      </div>

                      {hasCats ? (
                        <>
                          {myCatIds.map((catId) => {
                            const catDetail = details.categoryStandings[catId]
                            const myTeamNames = new Set<string>()
                            catDetail.myMatches.forEach((m: any) => {
                              myTeamNames.add(m.team1_name)
                              myTeamNames.add(m.team2_name)
                            })
                            return (
                              <div key={catId} className="mt-4 pt-4 border-t border-gray-200">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-purple-100 text-purple-800 text-xs font-bold">
                                    {catDetail.categoryName}
                                  </span>
                                  {catDetail.playerPosition != null && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-medium">
                                      <Trophy className="w-3 h-3" /> {catDetail.playerPosition}º
                                    </span>
                                  )}
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-medium">A tua categoria</span>
                                </div>
                                {renderCategoryContent(catDetail, myTeamNames)}
                              </div>
                            )
                          })}

                          {otherCatIds.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <p className="text-[10px] font-medium text-gray-400 uppercase mb-2">Outras categorias</p>
                              <div className="space-y-2">
                                {otherCatIds.map((catId) => {
                                  const catDetail = details.categoryStandings[catId]
                                  const isExpanded = expandedCats.has(catId)
                                  return (
                                    <div key={catId} className="border border-gray-200 rounded-lg overflow-hidden">
                                      <button
                                        onClick={() => toggleCategoryExpanded(t.id, catId)}
                                        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-xs font-bold">
                                            {catDetail.categoryName}
                                          </span>
                                          <span className="text-xs text-gray-500">{catDetail.standings.length} equipas · {(catDetail.allMatches || []).length} jogos</span>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                      </button>
                                      {isExpanded && (
                                        <div className="p-3">
                                          {renderCategoryContent(catDetail, new Set<string>())}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {details?.myMatches && details.myMatches.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                              <p className="text-xs font-medium text-gray-500 mb-2">Os teus resultados</p>
                              <div className="space-y-2">
                                {details.myMatches.map((m: any) => {
                                  const setScores = [m.set1, m.set2, m.set3].filter(Boolean)
                                  const scoreDisplay = setScores.length > 0 ? setScores.join(' ') : '-'
                                  const team1Won = m.team1_score !== undefined && m.team2_score !== undefined && m.team1_score > m.team2_score
                                  return (
                                    <div key={m.id} className="flex justify-between items-start text-sm py-2 px-3 bg-gray-50 rounded-lg">
                                      <div className="flex-1 mr-2 min-w-0">
                                        <div className={`text-gray-700 ${team1Won ? 'font-semibold' : ''}`}>{m.team1_name}</div>
                                        <div className={`text-gray-700 mt-1 ${!team1Won && m.team1_score !== undefined && m.team2_score !== undefined ? 'font-semibold' : ''}`}>{m.team2_name}</div>
                                      </div>
                                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                        <span className="font-semibold text-gray-900">{scoreDisplay}</span>
                                        {m.is_winner !== undefined && (
                                          <span className={`text-xs font-medium ${m.is_winner ? 'text-green-600' : 'text-red-600'}`}>{m.is_winner ? 'V' : 'D'}</span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {details?.standings && details.standings.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                              <p className="text-xs font-medium text-gray-500 mb-2">Classificação final</p>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-gray-500 border-b">
                                    <th className="py-1.5 px-2 text-left font-medium w-8">#</th>
                                    <th className="py-1.5 px-2 text-left font-medium min-w-0">Nome</th>
                                    <th className="py-1.5 px-1 text-center font-medium w-8">V</th>
                                    <th className="py-1.5 px-1 text-center font-medium w-8">E</th>
                                    <th className="py-1.5 px-1 text-center font-medium w-8">D</th>
                                    <th className="py-1.5 px-1 text-center font-medium w-10">+/-</th>
                                    <th className="py-1.5 px-1 text-center font-semibold w-10">Pts</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {details.standings.map((row: any, i: number) => {
                                    const diff = (row.points_for ?? 0) - (row.points_against ?? 0)
                                    return (
                                      <tr key={row.id} className={`border-b border-gray-50 ${details.playerPosition === i + 1 ? 'bg-red-50 font-semibold' : ''}`}>
                                        <td className="py-1.5 px-2">{i + 1}</td>
                                        <td className="py-1.5 px-2 min-w-0">
                                          <div className="font-medium break-words">{row.name}</div>
                                          {row.player1_name && <div className="text-xs text-gray-500 break-words">{row.player1_name}</div>}
                                          {row.player2_name && <div className="text-xs text-gray-500 break-words">{row.player2_name}</div>}
                                        </td>
                                        <td className="py-1.5 px-1 text-center text-green-600">{row.wins}</td>
                                        <td className="py-1.5 px-1 text-center text-yellow-600">{row.draws ?? 0}</td>
                                        <td className="py-1.5 px-1 text-center text-red-500">{row.losses}</td>
                                        <td className={`py-1.5 px-1 text-center text-xs ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>{diff > 0 ? '+' : ''}{diff}</td>
                                        <td className="py-1.5 px-1 text-center font-bold">{row.points}</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}

              {hasMore && (
                <button
                  onClick={() => setHistoryVisibleCount(prev => prev + 5)}
                  className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  Ver mais torneios ({completedTournaments.length - historyVisibleCount} restantes)
                  <ChevronDown className="w-4 h-4" />
                </button>
              )}

              {pastTournamentLoading && Object.keys(pastTournamentDetails).length > 0 && (
                <div className="flex justify-center py-4">
                  <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <Trophy className="w-16 h-16 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">Ainda não tens torneios concluídos.</p>
              <p className="text-sm text-gray-400 mt-1">Os torneios em que participares aparecerão aqui.</p>
            </div>
          )}
          {openGameHistoryLoading ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : openGameHistory.length > 0 && (
            <div className="space-y-4">
              {openGameHistory.map((game) => {
                const setScores = [game.set1, game.set2, game.set3].filter(Boolean)
                const scoreDisplay = setScores.length > 0 ? setScores.join(' ') : '-'
                const gameDate = new Date(game.start_time)
                const dateStr = gameDate.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
                const timeStr = gameDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
                const team1Won = game.score1 != null && game.score2 != null && game.score1 > game.score2
                
                const getAvatar = (avatar: string | null | undefined, name: string) => {
                  if (avatar) return avatar
                  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random&size=64&bold=true`
                }
                
                const p1Avatar = getAvatar((game as any).player1_avatar, game.player1_name)
                const p2Avatar = getAvatar((game as any).player2_avatar, game.player2_name)
                const p3Avatar = getAvatar((game as any).player3_avatar, game.player3_name)
                const p4Avatar = getAvatar((game as any).player4_avatar, game.player4_name)
                
                return (
                  <div key={game.id} className="card overflow-hidden p-0">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{dateStr}</span>
                          <span>·</span>
                          <span>{timeStr}</span>
                          {game.club_name && (
                            <>
                              <span>·</span>
                              <span className="font-medium text-gray-700">{game.club_name}</span>
                            </>
                          )}
                        </div>
                        {game.is_winner !== undefined && (
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${game.is_winner ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {game.is_winner ? 'Vitória' : 'Derrota'}
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-3">
                        <div className={`flex items-center justify-between p-3 rounded-lg ${team1Won ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="flex -space-x-2 flex-shrink-0">
                              <img src={p1Avatar} alt={game.player1_name} className="w-8 h-8 rounded-full border-2 border-white object-cover" />
                              <img src={p2Avatar} alt={game.player2_name} className="w-8 h-8 rounded-full border-2 border-white object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className={`text-sm ${team1Won ? 'font-semibold text-green-900' : 'text-gray-700'}`}>
                                {game.team1_name}
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 ml-2">
                            <span className={`text-sm font-semibold ${team1Won ? 'text-green-700' : 'text-gray-900'}`}>
                              {game.score1}
                            </span>
                          </div>
                        </div>
                        
                        <div className={`flex items-center justify-between p-3 rounded-lg ${!team1Won && game.score1 != null && game.score2 != null ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="flex -space-x-2 flex-shrink-0">
                              <img src={p3Avatar} alt={game.player3_name} className="w-8 h-8 rounded-full border-2 border-white object-cover" />
                              <img src={p4Avatar} alt={game.player4_name} className="w-8 h-8 rounded-full border-2 border-white object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className={`text-sm ${!team1Won && game.score1 != null && game.score2 != null ? 'font-semibold text-green-900' : 'text-gray-700'}`}>
                                {game.team2_name}
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 ml-2">
                            <span className={`text-sm font-semibold ${!team1Won && game.score1 != null && game.score2 != null ? 'text-green-700' : 'text-gray-900'}`}>
                              {game.score2}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {setScores.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <span className="font-medium">Sets:</span>
                            <span>{scoreDisplay}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        )
      })()}

      {/* Modal classificação da Liga */}
      {viewingLeague && (() => {
        const allTabs = [
          { key: 'geral', label: 'Geral' },
          ...(leagueCategories || []).map((c) => ({ key: c.category_name, label: c.category_name })),
        ]
        const hasTabs = leagueCategories.length > 0
        const activeLeagueTab = leagueCategoryTab || 'geral'
        const displayStandings = activeLeagueTab === 'geral'
          ? leagueFull
          : leagueCategories.find((c) => c.category_name === activeLeagueTab)?.standings || []

        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex flex-col" onClick={() => { setViewingLeague(null); setLeagueCategories([]); setLeagueCategoryTab('') }}>
            <div
              className="bg-white mt-auto sm:mt-12 sm:mx-auto sm:max-w-lg w-full rounded-t-2xl sm:rounded-xl max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
                <h2 className="text-xl font-bold truncate mr-2">{viewingLeague.name}</h2>
                <button onClick={() => { setViewingLeague(null); setLeagueCategories([]); setLeagueCategoryTab('') }} className="text-gray-400 hover:text-gray-600 text-xl leading-none flex-shrink-0">✕</button>
              </div>

              {/* Tabs de categorias */}
              {hasTabs && (
                <div className="flex gap-1 p-2 bg-gray-50 border-b overflow-x-auto flex-shrink-0">
                  {allTabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setLeagueCategoryTab(tab.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                        activeLeagueTab === tab.key ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Conteúdo */}
              <div className="overflow-y-auto flex-1">
                {leagueLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : displayStandings.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-2 text-left text-sm font-semibold text-gray-700 w-10">#</th>
                        <th className="px-2 py-2 text-left text-sm font-semibold text-gray-700">Nome</th>
                        <th className="px-2 py-2 text-center text-sm font-semibold text-gray-700 w-14">Pts</th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 w-12">Jogos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayStandings.map((row) => (
                        <tr key={row.position} className={`border-t border-gray-100 ${row.is_current_player ? 'bg-red-100 ring-2 ring-red-200' : ''}`}>
                          <td className={`px-2 py-2 text-sm ${row.is_current_player ? 'font-bold text-red-600' : 'text-gray-500'}`}>{row.position}</td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden bg-gray-200 flex items-center justify-center">
                                {(row.avatar_url || getCachedPlayerData(row.entity_name)?.avatar_url) ? (
                                  <img src={row.avatar_url || getCachedPlayerData(row.entity_name)?.avatar_url || ''} alt={row.entity_name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-xs font-bold text-gray-500">{row.entity_name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}</span>
                                )}
                              </div>
                              <div className="truncate max-w-[140px]">
                                <span className={row.is_current_player ? 'font-bold text-gray-900 text-base' : 'font-medium'}>{row.entity_name}</span>
                                {row.is_current_player && <span className="ml-1 text-xs bg-red-600 text-white px-1.5 py-0.5 rounded font-semibold">Tu</span>}
                              </div>
                            </div>
                          </td>
                          <td className={`px-2 py-2 text-center font-bold ${row.is_current_player ? 'text-red-600 text-base' : ''}`}>{row.total_points}</td>
                          <td className={`px-2 py-2 text-center text-sm ${row.is_current_player ? 'font-bold text-gray-900' : 'text-gray-500'}`}>{row.tournaments_played}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-gray-500 text-center py-8">Sem dados de classificação.</p>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal Inscritos por categoria */}
      {viewingEnrolled && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">{viewingEnrolled.name}</h2>
              <button onClick={() => { setViewingEnrolled(null); setEnrolledData([]) }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="overflow-y-auto max-h-[70vh] p-4">
              {enrolledLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : enrolledData.length === 0 ? (
                <p className="text-gray-500 text-center py-6">Sem inscritos ou categorias.</p>
              ) : (
                <div className="space-y-6">
                  {enrolledData.map((cat) => (
                    <div key={cat.category_id}>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        {cat.category_name}
                      </h3>
                      <ul className="space-y-1.5">
                        {cat.items.map((item, idx) => (
                          <li key={item.id} className="text-sm text-gray-900 py-1.5 px-3 bg-gray-50 rounded-lg">
                            <span className="font-medium text-gray-600">{idx + 1}.</span>{' '}
                            {item.player_names?.length ? (
                              <span>{item.player_names.join(' · ')}</span>
                            ) : item.player1_name != null || item.player2_name != null ? (
                              <span>{[item.player1_name, item.player2_name].filter(Boolean).join(' / ')}</span>
                            ) : (
                              <span>{item.name}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewingTournament && tournamentDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold">{tournamentDetail.name}</h2>
                <button onClick={() => { setViewingTournament(null); setTournamentDetail(null) }} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setDetailTab('standings')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${detailTab === 'standings' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Classificação</button>
                <button onClick={() => setDetailTab('matches')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${detailTab === 'matches' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Os Meus Jogos ({tournamentDetail.myMatches.length})</button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[70vh]">
              {detailTab === 'standings' && (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-1.5 py-2 text-left text-xs w-8">#</th>
                      <th className="px-1.5 py-2 text-left text-xs">Nome</th>
                      <th className="px-1 py-2 text-center text-xs w-8">V</th>
                      <th className="px-1 py-2 text-center text-xs w-8">E</th>
                      <th className="px-1 py-2 text-center text-xs w-8">D</th>
                      <th className="px-1 py-2 text-center text-xs w-10">+/-</th>
                      <th className="px-1.5 py-2 text-center text-xs font-semibold w-10">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tournamentDetail.standings.map((row, i) => {
                      const diff = (row.points_for ?? 0) - (row.points_against ?? 0)
                      const hasPlayers = row.player1_name || row.player2_name
                      return (
                        <tr key={row.id} className="border-t">
                          <td className="px-1.5 py-2 text-gray-500">{i + 1}</td>
                          <td className="px-1.5 py-2">
                            <div className="font-medium truncate max-w-[120px]">{row.name}</div>
                            {hasPlayers && (
                              <div className="text-xs text-gray-500 truncate max-w-[120px]">
                                {[row.player1_name, row.player2_name].filter(Boolean).join(' / ')}
                              </div>
                            )}
                          </td>
                          <td className="px-1 py-2 text-center text-green-600">{row.wins ?? 0}</td>
                          <td className="px-1 py-2 text-center text-yellow-600">{row.draws ?? 0}</td>
                          <td className="px-1 py-2 text-center text-red-500">{row.losses ?? 0}</td>
                          <td className={`px-1 py-2 text-center text-xs ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>{diff > 0 ? '+' : ''}{diff}</td>
                          <td className="px-1.5 py-2 text-center font-bold">{row.points}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
              {detailTab === 'matches' && (
                <div className="divide-y">
                  {tournamentDetail.myMatches.length === 0 ? <div className="p-6 text-center text-gray-500">Sem jogos registados</div> : tournamentDetail.myMatches.map((m) => {
                    const setScores = [m.set1, m.set2, m.set3].filter(Boolean)
                    // Mostrar sempre os jogos de cada set, nunca o resultado 1-0/0-1
                    const scoreDisplay = setScores.length > 0 ? setScores.join(' ') : '-'
                    return (
                    <div key={m.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div><p className="font-medium text-gray-900">{m.team1_name}</p><p className="text-sm text-gray-500">vs</p><p className="font-medium text-gray-900">{m.team2_name}</p></div>
                        <div className="text-right">
                          {m.status === 'completed' ? <span className="text-lg font-bold">{scoreDisplay}</span> : <span className="text-sm text-gray-500">{formatDateTime(m.scheduled_time)}</span>}
                          {m.is_winner !== undefined && <span className={`block text-xs mt-1 ${m.is_winner ? 'text-green-600' : 'text-red-600'}`}>{m.is_winner ? t.common.victory : t.common.defeat}</span>}
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ---------- Encontrar Jogo ----------
function FindGameScreen({
  player,
  userId,
  onBack,
  onOpenPlayerProfile,
  onRefresh,
  groupId,
  resultsOnly = false,
}: {
  player: PlayerAccount | null
  userId: string | null
  onBack: () => void
  onOpenPlayerProfile: (userId: string, opts?: { accountId?: string | null; nameHint?: string | null }) => void
  onRefresh?: () => Promise<void>
  groupId?: string | null
  resultsOnly?: boolean
}) {
  const { t } = useI18n()
  const [activeSection, setActiveSection] = useState<'existing' | 'request' | 'create' | 'results'>(resultsOnly ? 'results' : (groupId ? 'create' : 'existing'))
  const [loading, setLoading] = useState(true)
  const [games, setGames] = useState<import('./lib/openGames').OpenGame[]>([])
  const [clubsAvailability, setClubsAvailability] = useState<import('./lib/openGames').ClubWithAvailability[]>([])
  const [loadingClubs, setLoadingClubs] = useState(false)

  // Result entry state
  const [pastGames, setPastGames] = useState<(import('./lib/openGames').OpenGame & { _resultStatus?: string | null })[]>([])
  const [loadingPastGames, setLoadingPastGames] = useState(false)
  const [resultModal, setResultModal] = useState<{ game: import('./lib/openGames').OpenGame } | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ game: import('./lib/openGames').OpenGame; result: import('./lib/openGames').OpenGameResult } | null>(null)
  const [resultScores, setResultScores] = useState({ t1s1: '', t2s1: '', t1s2: '', t2s2: '', t1s3: '', t2s3: '' })
  const [submittingResult, setSubmittingResult] = useState(false)
  const [swapSelected, setSwapSelected] = useState<{ playerId: string; team: number; gameId: string } | null>(null)
  const [swapping, setSwapping] = useState(false)

  // Quick Result state
  const [quickResultModal, setQuickResultModal] = useState(false)
  const [qrStep, setQrStep] = useState<1 | 2 | 3>(1)
  const [qrClubId, setQrClubId] = useState('')
  const [qrClubName, setQrClubName] = useState('')
  const [qrDate, setQrDate] = useState(new Date().toISOString().split('T')[0])
  const [qrPlayers, setQrPlayers] = useState<{ position: number; id: string; name: string; avatar_url: string | null; level: number | null }[]>([])
  const [qrScores, setQrScores] = useState({ t1s1: '', t2s1: '', t1s2: '', t2s2: '', t1s3: '', t2s3: '' })
  const [qrSearchQuery, setQrSearchQuery] = useState('')
  const [qrSearchResults, setQrSearchResults] = useState<CommunityPlayer[]>([])
  const [qrSearching, setQrSearching] = useState(false)
  const [qrSelectingPosition, setQrSelectingPosition] = useState<number | null>(null)
  const [qrSwapPosition, setQrSwapPosition] = useState<number | null>(null)
  const [qrSubmitting, setQrSubmitting] = useState(false)
  const [qrClubs, setQrClubs] = useState<{ id: string; name: string; logo_url: string | null }[]>([])
  const [qrClubsLoading, setQrClubsLoading] = useState(false)

  const loadPastGames = async () => {
    if (!userId) return
    setLoadingPastGames(true)
    try {
      const { fetchResultGamesForTab } = await import('./lib/openGames')
      const data = await fetchResultGamesForTab(userId, player?.id)
      setPastGames(data)
    } finally {
      setLoadingPastGames(false)
    }
  }

  useEffect(() => {
    if (resultsOnly && userId) {
      void loadPastGames()
    }
  }, [resultsOnly, userId, player?.id])

  // Load clubs when quick result modal opens
  useEffect(() => {
    if (quickResultModal && qrClubs.length === 0) {
      setQrClubsLoading(true)
      fetchAllClubs().then(clubs => {
        setQrClubs(clubs.map(c => ({ id: c.id, name: c.name, logo_url: c.logo_url })))
        setQrClubsLoading(false)
      })
    }
  }, [quickResultModal])

  // Pre-fill creator as player 1
  useEffect(() => {
    if (quickResultModal && qrPlayers.length === 0 && player) {
      setQrPlayers([{
        position: 1,
        id: player.id,
        name: player.name || '',
        avatar_url: player.avatar_url || null,
        level: player.level || null,
      }])
    }
  }, [quickResultModal, player])

  // Search players for quick result
  useEffect(() => {
    if (!qrSearchQuery || qrSearchQuery.length < 2) { setQrSearchResults([]); return }
    const timeout = setTimeout(async () => {
      setQrSearching(true)
      const excludeIds = qrPlayers.map(p => p.id)
      const results = await searchPlayers(qrSearchQuery, excludeIds.map(id => {
        // searchPlayers excludes by user_id, but we have player_account_id
        return id
      }))
      setQrSearchResults(results)
      setQrSearching(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [qrSearchQuery, qrPlayers])

  const openQuickResultModal = (prefill?: { clubId: string; clubName: string; date: string; players: typeof qrPlayers }) => {
    if (prefill) {
      setQrClubId(prefill.clubId)
      setQrClubName(prefill.clubName)
      setQrDate(prefill.date)
      setQrPlayers(prefill.players)
      setQrStep(2)
    } else {
      setQrClubId('')
      setQrClubName('')
      setQrDate(new Date().toISOString().split('T')[0])
      setQrPlayers(player ? [{
        position: 1,
        id: player.id,
        name: player.name || '',
        avatar_url: player.avatar_url || null,
        level: player.level || null,
      }] : [])
      setQrStep(1)
    }
    setQrScores({ t1s1: '', t2s1: '', t1s2: '', t2s2: '', t1s3: '', t2s3: '' })
    setQrSearchQuery('')
    setQrSearchResults([])
    setQrSelectingPosition(null)
    setQrSwapPosition(null)
    setQrSubmitting(false)
    setQuickResultModal(true)
  }

  const handleQuickResultSubmit = async () => {
    if (!userId || !qrClubId || qrPlayers.length !== 4) return
    if (!qrScores.t1s1 || !qrScores.t2s1 || !qrScores.t1s2 || !qrScores.t2s2) return
    setQrSubmitting(true)
    try {
      const { createQuickResultGame } = await import('./lib/openGames')
      const scheduledAt = new Date(qrDate + 'T12:00:00').toISOString()
      const result = await createQuickResultGame({
        userId,
        playerAccountId: player?.id || null,
        clubId: qrClubId,
        scheduledAt,
        players: qrPlayers.map(p => ({
          player_account_id: p.id,
          position: p.position,
          name: p.name,
        })),
        sets: {
          t1s1: parseInt(qrScores.t1s1) || 0,
          t2s1: parseInt(qrScores.t2s1) || 0,
          t1s2: parseInt(qrScores.t1s2) || 0,
          t2s2: parseInt(qrScores.t2s2) || 0,
          t1s3: parseInt(qrScores.t1s3) || 0,
          t2s3: parseInt(qrScores.t2s3) || 0,
        },
      })
      if (result.success) {
        alert(t.common.resultSaved)
        setQuickResultModal(false)
        // Refresh past games
        if (userId) {
          const { fetchResultGamesForTab } = await import('./lib/openGames')
          const data = await fetchResultGamesForTab(userId, player?.id)
          setPastGames(data)
        }
        if (onRefresh) onRefresh()
      } else {
        alert(result.error || 'Erro ao registar resultado')
      }
    } catch (err) {
      console.error('[QuickResult] Error:', err)
      alert('Erro ao registar resultado')
    }
    setQrSubmitting(false)
  }

  const handlePlayerSwap = async (clickedPlayer: any, clickedTeam: number, gameId: string, gamePlayersRef: any[]) => {
    if (swapping) return
    if (!swapSelected || swapSelected.gameId !== gameId) {
      setSwapSelected({ playerId: clickedPlayer.id, team: clickedTeam, gameId })
      return
    }
    if (swapSelected.playerId === clickedPlayer.id) {
      setSwapSelected(null)
      return
    }
    if (swapSelected.team === clickedTeam) {
      setSwapSelected({ playerId: clickedPlayer.id, team: clickedTeam, gameId })
      return
    }
    setSwapping(true)
    try {
      const { swapPlayerTeam } = await import('./lib/openGames')
      const res = await swapPlayerTeam(swapSelected.playerId, clickedPlayer.id)
      if (res.success) {
        const pA = gamePlayersRef.find((p: any) => p.id === swapSelected.playerId)
        const pB = gamePlayersRef.find((p: any) => p.id === clickedPlayer.id)
        if (pA && pB) {
          const tmpPos = pA.position
          pA.position = pB.position
          pB.position = tmpPos
        }
        setPastGames([...pastGames])
        if (resultModal) setResultModal({ ...resultModal })
      }
    } catch (err) {
      console.error('[Swap] Error:', err)
    }
    setSwapSelected(null)
    setSwapping(false)
  }
  
  // Filtros
  const [selectedClubId, setSelectedClubId] = useState<string>('')
  const [selectedDay, setSelectedDay] = useState<number>(0) // 0 = today, 1 = tomorrow, etc.
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all') // all, morning, afternoon, night
  const [showFilters, setShowFilters] = useState(false)
  
  // Modal para criar jogo
  const [createModal, setCreateModal] = useState<{
    clubId: string
    clubName: string
    date: string
    time: string
    courts: { court_id: string; court_name: string; court_type: string | null; durations: number[]; price_60: number; price_90: number; price_120: number }[]
  } | null>(null)
  const [selectedCourtIdx, setSelectedCourtIdx] = useState<number>(0)
  const [createGameType, setCreateGameType] = useState<'competitive' | 'friendly'>('competitive')
  const [createGender, setCreateGender] = useState<'all' | 'male' | 'female' | 'mixed'>('all')
  const [createDuration, setCreateDuration] = useState<number>(90)
  const [creating, setCreating] = useState(false)
  const [groupName, setGroupName] = useState<string | null>(null)

  useEffect(() => {
    if (!groupId) { setGroupName(null); return }
    (async () => {
      const { getGroupDetails } = await import('./lib/communityGroups')
      const g = await getGroupDetails(groupId)
      setGroupName(g?.name || null)
    })()
  }, [groupId])

  // Add player modal
  const [addPlayerModal, setAddPlayerModal] = useState<{ gameId: string; position?: number } | null>(null)
  const [playerSearchQuery, setPlayerSearchQuery] = useState('')
  const [playerSearchResults, setPlayerSearchResults] = useState<{ id: string; name: string; avatar_url: string | null; level: number | null; player_category: string | null; phone_number: string | null }[]>([])
  const [searchingPlayers, setSearchingPlayers] = useState(false)
  const [addingPlayer, setAddingPlayer] = useState(false)

  // Clubs list for filter
  const [allClubs, setAllClubs] = useState<{ id: string; name: string }[]>([])

  // Player level
  const playerLevel = player?.level || 3.0

  // Generate dates for filter (14 days)
  const generateDates = () => {
    const dates: { label: string; value: number; dateStr: string }[] = []
    const now = new Date()
    const dayNames = t.common.dayNamesShort
    for (let i = 0; i < 14; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() + i)
      let label = ''
      if (i === 0) label = t.common.today
      else if (i === 1) label = t.common.tomorrow
      else label = `${dayNames[d.getDay()]} ${d.getDate()}/${(d.getMonth() + 1).toString().padStart(2, '0')}`
      dates.push({ label, value: i, dateStr: d.toISOString().split('T')[0] })
    }
    return dates
  }
  const dates = generateDates()

  // Period to time filter
  const getPeriodFilter = () => {
    switch (selectedPeriod) {
      case 'morning': return { from: '06:00', to: '12:00' }
      case 'afternoon': return { from: '12:00', to: '18:00' }
      case 'night': return { from: '18:00', to: '24:00' }
      default: return { from: '00:00', to: '24:00' }
    }
  }

  // Load games
  useEffect(() => {
    const loadGames = async () => {
      setLoading(true)
      const { fetchOpenGames } = await import('./lib/openGames')
      const dateStr = dates[selectedDay]?.dateStr
      const dateFrom = dateStr ? dateStr + 'T00:00:00' : undefined
      const dateTo = dateStr ? dateStr + 'T23:59:59' : undefined
      const period = getPeriodFilter()
      
      const data = await fetchOpenGames({
        clubId: selectedClubId || undefined,
        dateFrom,
        dateTo,
        timeFrom: selectedPeriod !== 'all' ? period.from : undefined,
        timeTo: selectedPeriod !== 'all' ? period.to : undefined,
      })
      setGames(data)
      setLoading(false)
    }
    loadGames()
    const onVis = () => {
      if (document.visibilityState === 'visible') loadGames()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [selectedClubId, selectedDay, selectedPeriod])

  // Load clubs list for filter
  useEffect(() => {
    const loadClubs = async () => {
      const clubs = await fetchAllClubs()
      setAllClubs(clubs.map(c => ({ id: c.id, name: c.name })))
    }
    loadClubs()
  }, [])

  // Load clubs availability when "create" section is opened
  useEffect(() => {
    if (activeSection === 'create') {
      const loadAvailability = async () => {
        setLoadingClubs(true)
        const { fetchClubsWithAvailability } = await import('./lib/openGames')
        const data = await fetchClubsWithAvailability()
        setClubsAvailability(data)
        setLoadingClubs(false)
      }
      loadAvailability()
    }
  }, [activeSection])

  // Separate games: within level (existing) vs out of level (request)
  // Show open games + full games where user is already in
  // Also show games where user is already a player, regardless of status (except cancelled)
  const existingGames = games.filter(g => {
    const inMyLevel = playerLevel >= g.level_min && playerLevel <= g.level_max
    const imInGame = g.players.some(p => p.user_id === userId || (player?.id && p.player_account_id === player.id))
    // Show if: (1) I'm already in the game (any status except cancelled), OR (2) in my level and open/full/pending
    return (imInGame && g.status !== 'cancelled') || 
           (inMyLevel && (g.status === 'open' || g.status === 'full' || g.status === 'pending'))
  })
  const requestGames = games.filter(g => {
    const outOfLevel = playerLevel < g.level_min || playerLevel > g.level_max
    const imInGame = g.players.some(p => p.user_id === userId || (player?.id && p.player_account_id === player.id))
    // Show if: (1) I'm already in the game (any status except cancelled), OR (2) out of level and open/full/pending
    return (imInGame && g.status !== 'cancelled') || 
           (outOfLevel && (g.status === 'open' || g.status === 'full' || g.status === 'pending'))
  })

  // Join a game with selected position
  const handleJoinGameWithPosition = async (game: import('./lib/openGames').OpenGame, position: number) => {
    if (!userId) return
    const { joinOpenGame } = await import('./lib/openGames')
    const result = await joinOpenGame({
      gameId: game.id,
      userId,
      playerAccountId: player?.id || null,
      playerLevel,
      gameLevelMin: game.level_min,
      gameLevelMax: game.level_max,
      position,
    })
    if (result.success) {
      // Refresh games
      const { fetchOpenGames } = await import('./lib/openGames')
      const dateStr = dates[selectedDay]?.dateStr
      const data = await fetchOpenGames({
        clubId: selectedClubId || undefined,
        dateFrom: dateStr ? dateStr + 'T00:00:00' : undefined,
        dateTo: dateStr ? dateStr + 'T23:59:59' : undefined,
      })
      setGames(data)
      if (result.status === 'pending') {
        alert(t.games.joinRequest)
      } else if (result.status === 'confirmed' && game.club_payment_method && game.club_payment_method !== 'at_club' && game.price_per_player > 0 && player?.id) {
        // Offer online payment after joining
        const wantsToPay = confirm(`${t.common.enteredGame} ${t.common.wantToPay} ${game.price_per_player.toFixed(2)}€ ${t.common.onlineNow}`)
        if (wantsToPay) {
          try {
            const { data: checkoutData, error: checkoutErr } = await supabase.functions.invoke('create-game-checkout', {
              body: {
                gameId: game.id,
                paymentType: 'per_player',
                playerAccountId: player.id,
                successUrl: window.location.origin,
                cancelUrl: window.location.origin,
              },
            })
            if (!checkoutErr && checkoutData?.url) {
              window.location.href = checkoutData.url
              return
            }
          } catch (e) {
            console.error('Stripe checkout error:', e)
          }
        }
      }
    } else {
      alert(result.error || t.common.joinGameError)
    }
  }

  // Create a game
  const handleCreateGame = async () => {
    if (!createModal || !userId) return
    const court = createModal.courts[selectedCourtIdx]
    if (!court) return
    setCreating(true)
    const { createOpenGame } = await import('./lib/openGames')
    const scheduledAt = `${createModal.date}T${createModal.time}:00`
    const pricePerPlayer = createDuration === 120 ? (court.price_120 || court.price_90 * 4/3) : createDuration === 90 ? court.price_90 : court.price_60
    
    const result = await createOpenGame({
      userId,
      playerAccountId: player?.id || null,
      playerName: player?.name || null,
      playerPhone: player?.phone_number || null,
      clubId: createModal.clubId,
      courtId: court.court_id,
      scheduledAt,
      durationMinutes: createDuration,
      gameType: createGameType,
      gender: createGender,
      playerLevel,
      pricePerPlayer,
      groupId: groupId || undefined,
    })
    
    setCreating(false)
    if (result.success) {
      setCreateModal(null)
      setActiveSection('existing')
      // Refresh games list
      const { fetchOpenGames } = await import('./lib/openGames')
      const dateStr = dates[selectedDay]?.dateStr
      const data = await fetchOpenGames({
        clubId: selectedClubId || undefined,
        dateFrom: dateStr ? dateStr + 'T00:00:00' : undefined,
        dateTo: dateStr ? dateStr + 'T23:59:59' : undefined,
      })
      setGames(data)
      // Send a system message in the group chat
      if (groupId && result.gameId) {
        try {
          const { sendMessage } = await import('./lib/groupChat')
          const dateObj = new Date(scheduledAt)
          const timeStr = dateObj.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
          const dateDisplay = dateObj.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })
          await sendMessage({
            groupId,
            content: `🎾 Novo jogo criado para o grupo!\n📅 ${dateDisplay} às ${timeStr}\n📍 ${createModal.clubName}`,
            messageType: 'system',
          })
        } catch (_) { /* ignore */ }
      }
      // Refresh dashboard
      if (onRefresh) onRefresh()
    } else {
      alert(result.error || 'Erro ao criar jogo')
    }
  }

  // Format date for display
  const formatGameDate = (isoStr: string) => {
    const d = new Date(isoStr)
    const days = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
    return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]} | ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  const formatDateLabel = (dateStr: string) => {
    const now = new Date()
    const d = new Date(dateStr + 'T12:00:00')
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return t.common.today
    if (diffDays === 1) return t.common.tomorrow
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`
  }

  // Check if current user is already in a game
  const isPlayerInGame = (game: import('./lib/openGames').OpenGame) => {
    return game.players.some(p => p.user_id === userId || (player?.id && p.player_account_id === player.id))
  }
  
  const isGameCreator = (game: import('./lib/openGames').OpenGame) => {
    return game.creator_user_id === userId || game.players.some(p => p.position === 1 && (p.user_id === userId || (player?.id && p.player_account_id === player.id)))
  }

  // Cancel a game
  const handleCancelGame = async (game: import('./lib/openGames').OpenGame) => {
                if (!confirm(t.games.cancelConfirmSimple)) return
    const { cancelOpenGame } = await import('./lib/openGames')
    const success = await cancelOpenGame(game.id)
    if (success) {
      const { fetchOpenGames } = await import('./lib/openGames')
      const data = await fetchOpenGames({})
      setGames(data)
    } else {
      alert(t.common.cancelGameError)
    }
  }

  // Search players for add player modal
  const handleSearchPlayers = async (query: string) => {
    setPlayerSearchQuery(query)
    if (query.length < 2) {
      setPlayerSearchResults([])
      return
    }
    setSearchingPlayers(true)
    const { searchPlayerAccounts } = await import('./lib/openGames')
    const results = await searchPlayerAccounts(query)
    setPlayerSearchResults(results)
    setSearchingPlayers(false)
  }

  // Add player to game
  const handleAddPlayerToGame = async (playerAccountId: string) => {
    if (!addPlayerModal) return
    setAddingPlayer(true)
    const { addPlayerToOpenGame } = await import('./lib/openGames')
    const result = await addPlayerToOpenGame({
      gameId: addPlayerModal.gameId,
      playerAccountId,
      position: addPlayerModal.position,
    })
    setAddingPlayer(false)
    if (result.success) {
      setAddPlayerModal(null)
      setPlayerSearchQuery('')
      setPlayerSearchResults([])
      // Refresh games
      const { fetchOpenGames } = await import('./lib/openGames')
      const data = await fetchOpenGames({})
      setGames(data)
    } else {
      alert(result.error || t.common.addPlayerError)
    }
  }

  // Remove player from game (creator action)
  const handleRemovePlayerFromGameScreen = async (game: import('./lib/openGames').OpenGame, p: any) => {
    const playerName = (p.name || '').split(' ')[0] || t.common.player
    if (!confirm((t.games.removePlayerConfirm || 'Remover {name} do jogo?').replace('{name}', playerName))) return
    const { removePlayerFromOpenGame } = await import('./lib/openGames')
    const success = await removePlayerFromOpenGame({
      gameId: game.id,
      playerId: p.id,
      playerAccountId: p.player_account_id,
      playerName: p.name,
    })
    if (success) {
      // Refresh games
      const { fetchOpenGames } = await import('./lib/openGames')
      const dateStr = dates[selectedDay]?.dateStr
      const data = await fetchOpenGames({
        clubId: selectedClubId || undefined,
        dateFrom: dateStr ? dateStr + 'T00:00:00' : undefined,
        dateTo: dateStr ? dateStr + 'T23:59:59' : undefined,
      })
      setGames(data)
      if (onRefresh) onRefresh()
    } else {
      alert(t.games.removePlayerError || 'Erro ao remover jogador')
    }
  }

  // Render game card (Playtomic style)
  const renderGameCard = (game: import('./lib/openGames').OpenGame, isRequest: boolean = false) => {
    const confirmedPlayers = game.players.filter(p => p.status === 'confirmed')
    const emptySlots = game.max_players - confirmedPlayers.length
    const isInGame = isPlayerInGame(game)
    const isCreator = isGameCreator(game)
    const lvlColors = levelColors(player?.level)
    const myPlayer = game.players.find(p => p.user_id === userId || (player?.id && p.player_account_id === player.id))

    return (
      <div key={game.id} className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
        <div className="p-4">
          {/* Date & Time */}
          <p className="font-bold text-gray-900 text-sm mb-1">
            {formatGameDate(game.scheduled_at)}
          </p>
          
          {/* Game Type & Level Range */}
          <div className="flex items-center gap-3 text-xs text-gray-500 mb-3 flex-wrap">
            <span className="flex items-center gap-1">
              {game.game_type === 'competitive' ? '🏆' : '🤝'} {game.game_type === 'competitive' ? t.games.competitive : t.games.friendly}
            </span>
            <span className="flex items-center gap-1">
              📊 {game.level_min.toFixed(2)} - {game.level_max.toFixed(2)}
            </span>
            {game.gender !== 'all' && (
              <span className="flex items-center gap-1">
                {game.gender === 'male' ? '♂️' : game.gender === 'female' ? '♀️' : '⚥'} {game.gender === 'male' ? t.games.male : game.gender === 'female' ? t.games.female : t.games.mixed}
              </span>
            )}
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
          </div>

          {/* Player circles */}
          <div className="flex items-start gap-4 mb-3">
            {/* Left team - Positions 1 and 2 */}
            <div className="flex gap-3 flex-1 justify-center">
              {[1, 2].map(position => {
                const p = confirmedPlayers.find(pl => pl.position === position)
                if (p) {
                  const pColors = levelColors(p.level)
                  const isMe = p.user_id === userId || (player?.id && p.player_account_id === player.id)
                  const canRemove = isCreator && !isMe
                  return (
                    <div key={p.id} className="flex flex-col items-center relative group">
                      <div 
                        className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => p.user_id && onOpenPlayerProfile(p.user_id)}
                      >
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      {canRemove && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemovePlayerFromGameScreen(game, p) }}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                          title={t.games.removePlayer}
                        >
                          ✕
                        </button>
                      )}
                      <span className="text-[10px] text-gray-700 font-medium mt-1 truncate max-w-[70px] text-center">{(p.name || '').split(' ')[0]}</span>
                      {p.level != null && (
                        <div className="mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: pColors?.hex || '#9ca3af' }}>
                          {p.level.toFixed(2)}
                        </div>
                      )}
                    </div>
                  )
                } else {
                  return (
                    <div key={`empty-${position}`} className="flex flex-col items-center">
                      <div 
                        className={`w-14 h-14 rounded-full border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors ${
                          isInGame 
                            ? 'border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50' 
                            : 'border-gray-300 hover:border-red-400 hover:bg-red-50'
                        }`}
                        onClick={() => {
                          if (isInGame) {
                            setAddPlayerModal({ gameId: game.id, position })
                            setPlayerSearchQuery('')
                            setPlayerSearchResults([])
                          } else {
                            // Join directly in this position
                            handleJoinGameWithPosition(game, position)
                          }
                        }}
                      >
                        <Plus className={`w-6 h-6 ${isInGame ? 'text-indigo-400' : 'text-gray-400'}`} />
                      </div>
                      <span className={`text-[10px] font-medium mt-1 ${isInGame ? 'text-indigo-600' : 'text-blue-600'}`}>
                        {isInGame ? t.common.add : t.common.free}
                      </span>
                    </div>
                  )
                }
              })}
            </div>
            
            {/* Divider */}
            <div className="w-px h-20 bg-gray-200 self-center" />
            
            {/* Right team - Positions 3 and 4 */}
            <div className="flex gap-3 flex-1 justify-center">
              {[3, 4].map(position => {
                const p = confirmedPlayers.find(pl => pl.position === position)
                if (p) {
                  const pColors = levelColors(p.level)
                  const isMe = p.user_id === userId || (player?.id && p.player_account_id === player.id)
                  const canRemove = isCreator && !isMe
                  return (
                    <div key={p.id} className="flex flex-col items-center relative group">
                      <div 
                        className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => p.user_id && onOpenPlayerProfile(p.user_id)}
                      >
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      {canRemove && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemovePlayerFromGameScreen(game, p) }}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                          title={t.games.removePlayer}
                        >
                          ✕
                        </button>
                      )}
                      <span className="text-[10px] text-gray-700 font-medium mt-1 truncate max-w-[70px] text-center">{(p.name || '').split(' ')[0]}</span>
                      {p.level != null && (
                        <div className="mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: pColors?.hex || '#9ca3af' }}>
                          {p.level.toFixed(2)}
                        </div>
                      )}
                    </div>
                  )
                } else {
                  return (
                    <div key={`empty-${position}`} className="flex flex-col items-center">
                      <div 
                        className={`w-14 h-14 rounded-full border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors ${
                          isInGame 
                            ? 'border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50' 
                            : 'border-gray-300 hover:border-red-400 hover:bg-red-50'
                        }`}
                        onClick={() => {
                          if (isInGame) {
                            setAddPlayerModal({ gameId: game.id, position })
                            setPlayerSearchQuery('')
                            setPlayerSearchResults([])
                          } else {
                            // Join directly in this position
                            handleJoinGameWithPosition(game, position)
                          }
                        }}
                      >
                        <Plus className={`w-6 h-6 ${isInGame ? 'text-indigo-400' : 'text-gray-400'}`} />
                      </div>
                      <span className={`text-[10px] font-medium mt-1 ${isInGame ? 'text-indigo-600' : 'text-blue-600'}`}>
                        {isInGame ? t.common.add : t.common.free}
                      </span>
                    </div>
                  )
                }
              })}
            </div>
          </div>
        </div>

        {/* Pending requests section (visible to confirmed players) */}
        {(() => {
          const pendingPlayers = game.players.filter(p => p.status === 'pending')
          const myPendingEntry = game.players.find(p => p.status === 'pending' && (p.user_id === userId || (player?.id && p.player_account_id === player.id)))
          const isConfirmedPlayer = confirmedPlayers.some(p => p.user_id === userId || (player?.id && p.player_account_id === player.id))
          
          return (
            <>
              {/* Banner: Pedido pendente (para quem pediu) */}
              {myPendingEntry && (
                <div className="mx-4 mb-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⏳</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-800">{t.common.pendingRequest}</p>
                      <p className="text-xs text-amber-600">{t.common.awaitingApproval}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Banner: Pedido rejeitado (para quem pediu) */}
              {game.players.some(p => p.status === 'rejected' && (p.user_id === userId || (player?.id && p.player_account_id === player.id))) && (
                <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">❌</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-800">{t.common.rejectedRequest}</p>
                      <p className="text-xs text-red-600">{t.common.playersRejectedRequest}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Pedidos pendentes (visível para jogadores confirmados) */}
              {isConfirmedPlayer && pendingPlayers.length > 0 && (
                <div className="mx-4 mb-2">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1">
                      <span>📩</span> {pendingPlayers.length} {pendingPlayers.length > 1 ? t.common.joinRequestsPlural : t.common.joinRequests} {t.common.ofJoin}
                    </p>
                    <div className="space-y-2">
                      {pendingPlayers.map(pp => {
                        const ppColors = levelColors(pp.level)
                        return (
                          <div key={pp.id} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-amber-100">
                            <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                              {pp.avatar_url ? (
                                <img src={pp.avatar_url} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-sm font-bold text-gray-600">{(pp.name || '?').charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{pp.name || 'Jogador'}</p>
                              <div className="flex items-center gap-1">
                                {pp.level != null && (
                                  <span className="text-[9px] font-bold text-white px-1.5 py-0 rounded-full" style={{ backgroundColor: ppColors?.hex || '#9ca3af' }}>
                                    {pp.level.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  const { voteOnJoinRequest } = await import('./lib/openGames')
                                  const result = await voteOnJoinRequest(pp.id, 'accept')
                                  if (result.success) {
                                    if (result.resolved && result.newStatus === 'confirmed') {
                                      alert(`${pp.name} ${t.common.acceptedInGame}`)
                                    } else if (!result.resolved) {
                                      alert(`${t.common.voteRegistered} (${result.votesCount}/${result.votesNeeded})`)
                                    }
                                    // Refresh games
                                    const { fetchOpenGames } = await import('./lib/openGames')
                                    const dateStr = dates[selectedDay]?.dateStr
                                    const data = await fetchOpenGames({
                                      clubId: selectedClubId || undefined,
                                      dateFrom: dateStr ? dateStr + 'T00:00:00' : undefined,
                                      dateTo: dateStr ? dateStr + 'T23:59:59' : undefined,
                                    })
                                    setGames(data)
                                  } else {
                                    alert(result.error || t.common.voteError)
                                  }
                                }}
                                className="px-2.5 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-xs font-semibold"
                              >
                                ✓ {t.games.voteAccept}
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  const { voteOnJoinRequest } = await import('./lib/openGames')
                                  const result = await voteOnJoinRequest(pp.id, 'reject')
                                  if (result.success) {
                                    if (result.resolved && result.newStatus === 'rejected') {
                                      alert(`${pp.name} ${t.common.wasRejected}`)
                                    }
                                    // Refresh games
                                    const { fetchOpenGames } = await import('./lib/openGames')
                                    const dateStr = dates[selectedDay]?.dateStr
                                    const data = await fetchOpenGames({
                                      clubId: selectedClubId || undefined,
                                      dateFrom: dateStr ? dateStr + 'T00:00:00' : undefined,
                                      dateTo: dateStr ? dateStr + 'T23:59:59' : undefined,
                                    })
                                    setGames(data)
                                  } else {
                                    alert(result.error || t.common.voteError)
                                  }
                                }}
                                className="px-2.5 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-xs font-semibold"
                              >
                                ✗ {t.games.voteReject}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )
        })()}

        {/* Club & Price footer */}
        <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            {game.club_logo_url ? (
              <img src={game.club_logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-gray-400" />
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-900">{game.club_name}</p>
              {game.club_city && <p className="text-[10px] text-gray-500">{game.club_city}</p>}
            </div>
          </div>
          <div className="text-right">
            {game.price_per_player > 0 && (
              <p className="text-lg font-bold text-blue-600">{game.price_per_player.toFixed(2)}€</p>
            )}
            <p className="text-[10px] text-gray-500">{game.duration_minutes}min</p>
            {game.club_payment_method && game.club_payment_method !== 'at_club' && game.price_per_player > 0 && (
              <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">💳 Online</span>
            )}
            {isInGame && myPlayer?.payment_status === 'paid' && (
              <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium mt-0.5 inline-block">✅ Pago</span>
            )}
          </div>
        </div>

        {/* Pay online button for players who joined but haven't paid */}
        {isInGame && myPlayer?.payment_status !== 'paid' && game.club_payment_method && game.club_payment_method !== 'at_club' && game.price_per_player > 0 && (
          <div className="px-4 pb-2 pt-0">
            <button
              onClick={async () => {
                if (!player?.id) return
                try {
                  const { data: checkoutData, error: checkoutErr } = await supabase.functions.invoke('create-game-checkout', {
                    body: {
                      gameId: game.id,
                      paymentType: 'per_player',
                      playerAccountId: player.id,
                      successUrl: window.location.origin,
                      cancelUrl: window.location.origin,
                    },
                  })
                  if (!checkoutErr && checkoutData?.url) {
                    window.location.href = checkoutData.url
                  } else {
                    alert(t.common.paymentError)
                  }
                } catch (e) {
                  alert(t.common.paymentError)
                }
              }}
              className="w-full py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              💳 Pagar {game.price_per_player.toFixed(2)}€
            </button>
          </div>
        )}

        {/* Join/Request/Cancel buttons */}
        {!isInGame && !game.players.some(p => (p.status === 'pending' || p.status === 'rejected') && (p.user_id === userId || (player?.id && p.player_account_id === player.id))) && (
          <div className="px-4 pb-3 pt-0 bg-gray-50/50">
            <button
              onClick={() => {
                // Find first available position
                const occupiedPositions = new Set(confirmedPlayers.map(p => p.position).filter(Boolean))
                let firstAvailable = 1
                for (let pos = 1; pos <= 4; pos++) {
                  if (!occupiedPositions.has(pos)) {
                    firstAvailable = pos
                    break
                  }
                }
                handleJoinGameWithPosition(game, firstAvailable)
              }}
              className={`w-full py-2 rounded-xl text-sm font-semibold transition-colors ${
                isRequest 
                  ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isRequest ? `📩 ${t.common.requestSpot}` : `🎾 ${t.common.joinGame}`}
            </button>
          </div>
        )}
        {isInGame && (
          <div className="px-4 pb-3 pt-0 bg-gray-50/50 space-y-2">
            {/* Sair do jogo — visível para todos (incluindo criador) */}
            <button
              onClick={async () => {
                if (!userId) return
                if (!confirm(t.common.sureLeaveGame)) return
                const { leaveOpenGame } = await import('./lib/openGames')
                const success = await leaveOpenGame(game.id, userId)
                if (success) {
                  const { fetchOpenGames } = await import('./lib/openGames')
                  const dateStr = dates[selectedDay]?.dateStr
                  const data = await fetchOpenGames({
                    clubId: selectedClubId || undefined,
                    dateFrom: dateStr ? dateStr + 'T00:00:00' : undefined,
                    dateTo: dateStr ? dateStr + 'T23:59:59' : undefined,
                  })
                  setGames(data)
                  if (onRefresh) onRefresh()
                } else {
                  alert(t.common.leaveGameError)
                }
              }}
              className="w-full py-2 rounded-xl text-sm font-semibold text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors"
            >
              🚪 {t.common.leaveGame}
            </button>
            {/* Cancelar jogo — só para o criador */}
            {isCreator && (
              <button
                onClick={() => handleCancelGame(game)}
                className="w-full py-1.5 rounded-xl text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
              >
                ❌ {t.common.cancelGame}
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1 -ml-1">
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {resultsOnly ? t.common.quickResultTitle : t.games.title}
        </h1>
      </div>

      {!resultsOnly && (
      <>
      {/* Filter Bar */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 snap-x">
        {/* Club filter */}
        <select
          value={selectedClubId}
          onChange={(e) => setSelectedClubId(e.target.value)}
          className="flex-shrink-0 px-3 py-2 bg-gray-900 text-white rounded-full text-sm font-medium appearance-none cursor-pointer min-w-[100px]"
        >
          <option value="">{t.common.club}s ({allClubs.length})</option>
          {allClubs.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Day selector - horizontal scroll */}
        {dates.slice(0, 7).map(d => (
          <button
            key={d.value}
            onClick={() => setSelectedDay(d.value)}
            className={`flex-shrink-0 px-3 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
              selectedDay === d.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Period filter */}
      <div className="flex gap-2">
        {[
          { value: 'all', label: t.common.allDay, icon: '🕐' },
          { value: 'morning', label: t.common.morning, icon: '🌅' },
          { value: 'afternoon', label: t.common.afternoon, icon: '☀️' },
          { value: 'night', label: t.common.evening, icon: '🌙' },
        ].map(p => (
          <button
            key={p.value}
            onClick={() => setSelectedPeriod(p.value)}
            className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
              selectedPeriod === p.value ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveSection('existing')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
            activeSection === 'existing' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          🎾 {t.common.gamesTab} ({existingGames.length})
        </button>
        <button
          onClick={() => setActiveSection('request')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
            activeSection === 'request' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          📩 {t.common.requestTab} ({requestGames.length})
        </button>
        <button
          onClick={() => setActiveSection('create')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
            activeSection === 'create' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          ➕ {t.common.createTab}
        </button>
        <button
          onClick={async () => {
            setActiveSection('results')
            await loadPastGames()
          }}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
            activeSection === 'results' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          📊 {t.common.resultsTab}
        </button>
      </div>
      </>
      )}

      {/* === SECTION: Jogos Existentes === */}
      {activeSection === 'existing' && (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t.games.existingGames}</h2>
            <p className="text-xs text-gray-500">{t.games.existingGamesDesc}</p>
          </div>
          
          {loading ? (
            <div className="text-center py-10">
              <div className="animate-spin w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm text-gray-500">A carregar jogos...</p>
            </div>
          ) : existingGames.length > 0 ? (
            <div className="space-y-4">
              {existingGames.map(game => renderGameCard(game, false))}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <span className="text-4xl block mb-3">🎾</span>
              <p className="font-semibold text-gray-700 mb-1">{t.games.noGames}</p>
              <p className="text-sm text-gray-500 mb-4">{t.games.noGamesForLevel}</p>
              <button
                onClick={() => setActiveSection('create')}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                ➕ {t.games.createAGame}
              </button>
            </div>
          )}
        </div>
      )}

      {/* === SECTION: Solicite o seu Lugar === */}
      {activeSection === 'request' && (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t.games.requestSpot}</h2>
            <p className="text-xs text-gray-500">{t.games.requestSpotDesc}</p>
          </div>
          
          {loading ? (
            <div className="text-center py-10">
              <div className="animate-spin w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full mx-auto mb-3" />
            </div>
          ) : requestGames.length > 0 ? (
            <div className="space-y-4">
              {requestGames.map(game => renderGameCard(game, true))}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <span className="text-4xl block mb-3">📩</span>
              <p className="font-semibold text-gray-700 mb-1">{t.games.noGamesOutOfLevel}</p>
              <p className="text-sm text-gray-500">{t.games.allGamesSuitable}</p>
            </div>
          )}
        </div>
      )}

      {/* === SECTION: Crie um Jogo === */}
      {activeSection === 'create' && (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t.games.createGameSection}</h2>
            <p className="text-xs text-gray-500">{t.games.createGameSectionDesc}</p>
          </div>
          {groupId && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2">
              <Lock className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <p className="text-sm text-blue-800">
                Jogo privado para o grupo <strong>{groupName || '...'}</strong> — apenas membros poderão ver e participar.
              </p>
            </div>
          )}

          {loadingClubs ? (
            <div className="text-center py-10">
              <div className="animate-spin w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm text-gray-500">A carregar disponibilidades...</p>
            </div>
          ) : clubsAvailability.length > 0 ? (
            <div className="space-y-6">
              {clubsAvailability.map(club => (
                <div key={club.id} className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                  {/* Club header */}
                  <div className="p-4 flex items-center gap-3 border-b border-gray-100">
                    {club.logo_url ? (
                      <img src={club.logo_url} alt="" className="w-14 h-14 rounded-xl object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center">
                        <Building2 className="w-7 h-7 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-gray-900">{club.name}</p>
                      {club.city && <p className="text-xs text-gray-500">{club.city}</p>}
                    </div>
                  </div>

                  {/* Time slots by day */}
                  <div className="p-4 space-y-4">
                    {Object.entries(club.availability).map(([date, slots]) => (
                      <div key={date}>
                        <p className="font-bold text-gray-800 text-sm mb-2">{formatDateLabel(date)}</p>
                        <div className="flex gap-2 flex-wrap">
                          {slots.map((slot, idx) => (
                            <button
                              key={`${date}-${idx}`}
                              onClick={() => {
                                setCreateModal({
                                  clubId: club.id,
                                  clubName: club.name,
                                  date,
                                  time: slot.time,
                                  courts: slot.courts?.map(c => ({ ...c, court_type: c.court_type || null })) || [{ court_id: slot.court_id, court_name: slot.court_name, court_type: null, durations: slot.durations, price_90: slot.price_90, price_60: slot.price_60, price_120: (slot as any).price_120 || 0 }],
                                })
                                setSelectedCourtIdx(0)
                                const firstCourt = slot.courts?.[0] || slot
                                setCreateDuration(firstCourt.durations.includes(90) ? 90 : firstCourt.durations[0] || 60)
                              }}
                              className="px-3 py-2 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors text-center"
                            >
                              <p className="font-bold text-gray-900 text-sm">{slot.time}</p>
                              <p className="text-[10px] text-gray-500">
                                {(slot.courts?.length || 1)} {(slot.courts?.length || 1) > 1 ? t.games.courts : t.games.court} • {slot.durations.sort((a: number, b: number) => a - b).map((d: number) => `${d}min`).join('/')}
                              </p>
                              {slot.courts && slot.courts.length === 1 && slot.courts[0].court_type && (
                                <p className="text-[9px] text-gray-400">
                                  {slot.courts[0].court_type === 'indoor' ? `🏠 ${t.games.indoor}` : slot.courts[0].court_type === 'outdoor' ? `☀️ ${t.games.outdoor}` : `🏗️ ${t.games.covered}`}
                                </p>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <span className="text-4xl block mb-3">🏟️</span>
              <p className="font-semibold text-gray-700 mb-1">Sem disponibilidades</p>
              <p className="text-sm text-gray-500">Não há clubes com disponibilidade neste momento</p>
            </div>
          )}
        </div>
      )}

      {/* === SECTION: Resultados === */}
      {activeSection === 'results' && (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Resultados</h2>
            <p className="text-xs text-gray-500">Regista resultados para atualizar o ranking. A equipa adversária pode disputar.</p>
          </div>

          {/* Quick Result Button */}
          <button
            onClick={() => openQuickResultModal()}
            className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl text-sm font-bold hover:from-green-700 hover:to-emerald-700 transition-all shadow-md flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t.common.quickResult}
          </button>
          
          {loadingPastGames ? (
            <div className="text-center py-10">
              <div className="animate-spin w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm text-gray-500">A carregar jogos...</p>
            </div>
          ) : pastGames.length > 0 ? (
            <div className="space-y-3">
              {pastGames.map(game => {
                const confirmedPlayers = game.players.filter(p => p.status === 'confirmed')
                const team1 = confirmedPlayers.filter(p => (p.position || 0) <= 2)
                const team2 = confirmedPlayers.filter(p => (p.position || 0) > 2)
                const resultStatus = (game as any)._resultStatus as string | null
                const resultData = (game as any)._resultData as import('./lib/openGames').OpenGameResult | null | undefined
                const hasResult = !!resultStatus && !!resultData
                const submittedByTeam = (game as any)._submittedByTeam || resultData?.submitted_by_team || 0
                
                const myPlayer = confirmedPlayers.find(p => p.user_id === userId || (player?.id && p.player_account_id === player.id))
                const myTeam = myPlayer ? ((myPlayer.position || 0) <= 2 ? 1 : 2) : 0
                const canDispute = hasResult && myTeam !== 0 && myTeam !== submittedByTeam

                return (
                  <div key={game.id} className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-bold text-gray-900">
                          {new Date(game.scheduled_at).toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit' })} às {new Date(game.scheduled_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {hasResult ? (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">✓ {t.games.confirmed}</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Sem resultado</span>
                        )}
                      </div>
                      
                      {/* Teams display - tap to swap */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex-1 text-center">
                          <p className="text-xs font-semibold text-gray-500 mb-1">Equipa 1</p>
                          <div className="flex justify-center gap-2">
                            {team1.map(p => {
                              const isSelected = swapSelected?.playerId === p.id && swapSelected?.gameId === game.id
                              return (
                              <div key={p.id} className="flex flex-col items-center cursor-pointer" onClick={() => handlePlayerSwap(p, 1, game.id, confirmedPlayers)}>
                                <div className={`w-11 h-11 rounded-full overflow-hidden flex items-center justify-center transition-all ${isSelected ? 'ring-3 ring-blue-500 ring-offset-1 scale-110' : 'bg-gray-200'}`}>
                                  {p.avatar_url ? (
                                    <img src={p.avatar_url} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                      <span className="text-sm font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                                    </div>
                                  )}
                                </div>
                                <span className="text-[10px] text-gray-600 mt-0.5 truncate max-w-[55px]">{(p.name || '').split(' ')[0]}</span>
                              </div>
                              )
                            })}
                          </div>
                        </div>
                        <span className="text-gray-300 text-lg font-bold">VS</span>
                        <div className="flex-1 text-center">
                          <p className="text-xs font-semibold text-gray-500 mb-1">Equipa 2</p>
                          <div className="flex justify-center gap-2">
                            {team2.map(p => {
                              const isSelected = swapSelected?.playerId === p.id && swapSelected?.gameId === game.id
                              return (
                              <div key={p.id} className="flex flex-col items-center cursor-pointer" onClick={() => handlePlayerSwap(p, 2, game.id, confirmedPlayers)}>
                                <div className={`w-11 h-11 rounded-full overflow-hidden flex items-center justify-center transition-all ${isSelected ? 'ring-3 ring-blue-500 ring-offset-1 scale-110' : 'bg-gray-200'}`}>
                                  {p.avatar_url ? (
                                    <img src={p.avatar_url} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                      <span className="text-sm font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                                    </div>
                                  )}
                                </div>
                                <span className="text-[10px] text-gray-600 mt-0.5 truncate max-w-[55px]">{(p.name || '').split(' ')[0]}</span>
                              </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                      {swapSelected?.gameId === game.id && (
                        <p className="text-[10px] text-blue-500 text-center mb-2 animate-pulse">Toca num jogador da outra equipa para trocar</p>
                      )}
                      
                      {/* Club info */}
                      <div className="flex items-center gap-2 mb-3">
                        {game.club_logo_url ? (
                          <img src={game.club_logo_url} alt="" className="w-6 h-6 rounded-lg object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-lg bg-gray-200 flex items-center justify-center">
                            <Building2 className="w-3 h-3 text-gray-400" />
                          </div>
                        )}
                        <span className="text-xs text-gray-600">{game.club_name}</span>
                        {game.court_name && <span className="text-xs text-gray-400">· {game.court_name}</span>}
                      </div>

                      {/* Actions */}
                      {!hasResult && (
                        <button
                          onClick={() => {
                            setResultModal({ game })
                            setResultScores({ t1s1: '', t2s1: '', t1s2: '', t2s2: '', t1s3: '', t2s3: '' })
                          }}
                          className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
                        >
                          📊 Introduzir resultado
                        </button>
                      )}
                      {hasResult && resultData && (
                        <div className="space-y-2">
                          <OpenGameResultScores result={resultData} />
                          {canDispute && (
                            <button
                              onClick={async () => {
                                setConfirmModal({ game, result: resultData })
                              }}
                              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors bg-red-100 text-red-700 hover:bg-red-200"
                            >
                              ⚠️ {t.results.disputeResult}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Duplicate button — available on any completed game with result */}
                      {hasResult && (
                        <button
                          onClick={() => {
                            openQuickResultModal({
                              clubId: game.club_id,
                              clubName: game.club_name,
                              date: new Date().toISOString().split('T')[0],
                              players: confirmedPlayers.map(p => ({
                                position: p.position || 0,
                                id: p.player_account_id || '',
                                name: p.name || '',
                                avatar_url: p.avatar_url || null,
                                level: p.level ?? null,
                              })),
                            })
                          }}
                          className="w-full py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5 mt-2"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          {t.common.duplicateGameDesc}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <span className="text-4xl block mb-3">📊</span>
              <p className="font-semibold text-gray-700 mb-1">Sem jogos para avaliar</p>
              <p className="text-sm text-gray-500">Os jogos terminados que necessitam de resultado aparecerão aqui</p>
            </div>
          )}
        </div>
      )}

      {/* === MODAL: Introduzir Resultado === */}
      {resultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setResultModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-gray-900">📊 Introduzir resultado</h3>
              <button onClick={() => setResultModal(null)} className="p-1">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              {/* Teams - tap to swap */}
              {(() => {
                const cp = resultModal.game.players.filter(p => p.status === 'confirmed')
                const t1 = cp.filter(p => (p.position || 0) <= 2)
                const t2 = cp.filter(p => (p.position || 0) > 2)
                return (
                  <>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 text-center">
                      <p className="text-xs font-bold text-blue-600 mb-2">Equipa 1</p>
                      <div className="flex justify-center gap-2">
                        {t1.map(p => {
                          const isSelected = swapSelected?.playerId === p.id && swapSelected?.gameId === resultModal.game.id
                          return (
                          <div key={p.id} className="flex flex-col items-center cursor-pointer" onClick={() => handlePlayerSwap(p, 1, resultModal.game.id, cp)}>
                            <div className={`w-11 h-11 rounded-full overflow-hidden flex items-center justify-center transition-all ${isSelected ? 'ring-3 ring-blue-500 ring-offset-1 scale-110' : 'bg-gray-200'}`}>
                              {p.avatar_url ? (
                                <img src={p.avatar_url} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                  <span className="text-sm font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-600 mt-0.5 truncate max-w-[55px]">{(p.name || '').split(' ')[0]}</span>
                          </div>
                          )
                        })}
                      </div>
                    </div>
                    <span className="text-gray-300 font-bold">VS</span>
                    <div className="flex-1 text-center">
                      <p className="text-xs font-bold text-red-600 mb-2">Equipa 2</p>
                      <div className="flex justify-center gap-2">
                        {t2.map(p => {
                          const isSelected = swapSelected?.playerId === p.id && swapSelected?.gameId === resultModal.game.id
                          return (
                          <div key={p.id} className="flex flex-col items-center cursor-pointer" onClick={() => handlePlayerSwap(p, 2, resultModal.game.id, cp)}>
                            <div className={`w-11 h-11 rounded-full overflow-hidden flex items-center justify-center transition-all ${isSelected ? 'ring-3 ring-blue-500 ring-offset-1 scale-110' : 'bg-gray-200'}`}>
                              {p.avatar_url ? (
                                <img src={p.avatar_url} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                  <span className="text-sm font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-600 mt-0.5 truncate max-w-[55px]">{(p.name || '').split(' ')[0]}</span>
                          </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                  {swapSelected?.gameId === resultModal.game.id && (
                    <p className="text-[10px] text-blue-500 text-center animate-pulse">Toca num jogador da outra equipa para trocar</p>
                  )}
                  </>
                )
              })()}
              
              {/* Score inputs */}
              <div className="space-y-3">
                {['Set 1', 'Set 2', 'Set 3'].map((label, idx) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className={`text-sm font-medium w-12 ${idx === 2 ? 'text-gray-400' : 'text-gray-700'}`}>{label}</span>
                    <input
                      type="number"
                      min="0"
                      max="7"
                      placeholder="E1"
                      value={idx === 0 ? resultScores.t1s1 : idx === 1 ? resultScores.t1s2 : resultScores.t1s3}
                      onChange={e => {
                        const key = idx === 0 ? 't1s1' : idx === 1 ? 't1s2' : 't1s3'
                        setResultScores(prev => ({ ...prev, [key]: e.target.value }))
                      }}
                      className="flex-1 text-center py-2 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="text-gray-300">-</span>
                    <input
                      type="number"
                      min="0"
                      max="7"
                      placeholder="E2"
                      value={idx === 0 ? resultScores.t2s1 : idx === 1 ? resultScores.t2s2 : resultScores.t2s3}
                      onChange={e => {
                        const key = idx === 0 ? 't2s1' : idx === 1 ? 't2s2' : 't2s3'
                        setResultScores(prev => ({ ...prev, [key]: e.target.value }))
                      }}
                      className="flex-1 text-center py-2 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                ))}
              </div>
              
              <p className="text-xs text-gray-400 text-center">O 3° set é opcional (apenas se necessário)</p>
              
              <button
                disabled={submittingResult || !resultScores.t1s1 || !resultScores.t2s1 || !resultScores.t1s2 || !resultScores.t2s2}
                onClick={async () => {
                  setSubmittingResult(true)
                  const { submitGameResult } = await import('./lib/openGames')
                  const res = await submitGameResult({
                    gameId: resultModal.game.id,
                    t1Set1: parseInt(resultScores.t1s1) || 0,
                    t2Set1: parseInt(resultScores.t2s1) || 0,
                    t1Set2: parseInt(resultScores.t1s2) || 0,
                    t2Set2: parseInt(resultScores.t2s2) || 0,
                    t1Set3: parseInt(resultScores.t1s3) || 0,
                    t2Set3: parseInt(resultScores.t2s3) || 0,
                  })
                  if (res.success) {
                    alert(t.results.resultRegistered)
                    setResultModal(null)
                    // Award points for submitting
                    try {
                      const { awardGameRewardPoints: _aw } = await import('./lib/openGames')
                    } catch {}
                    // Refresh past games
                    if (userId) {
                      const { fetchResultGamesForTab } = await import('./lib/openGames')
                      const data = await fetchResultGamesForTab(userId, player?.id)
                      setPastGames(data)
                    }
                  } else {
                    alert(res.error || 'Erro ao submeter resultado')
                  }
                  setSubmittingResult(false)
                }}
                className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingResult ? 'A submeter...' : '✓ Submeter resultado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: Resultado Rápido (3 passos) === */}
      {quickResultModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={() => setQuickResultModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in my-4" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-gray-900">{t.common.quickResultTitle}</h3>
                <p className="text-xs text-gray-500">{t.common.step} {qrStep}/3</p>
              </div>
              <button onClick={() => setQuickResultModal(false)} className="p-1">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="flex gap-1 px-4 pt-3">
              {[1, 2, 3].map(s => (
                <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${s <= qrStep ? 'bg-green-500' : 'bg-gray-200'}`} />
              ))}
            </div>

            <div className="p-5 space-y-4">
              {/* === STEP 1: Club + Date === */}
              {qrStep === 1 && (
                <>
                  {/* Date */}
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">📅 {t.common.selectDate}</label>
                    <input
                      type="date"
                      value={qrDate}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={e => setQrDate(e.target.value)}
                      className="w-full py-2.5 px-4 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  {/* Club selection */}
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">🏟️ {t.common.selectClub}</label>
                    {qrClubsLoading ? (
                      <div className="text-center py-4">
                        <div className="animate-spin w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full mx-auto" />
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-200 rounded-xl p-2">
                        {qrClubs.map(club => (
                          <button
                            key={club.id}
                            onClick={() => { setQrClubId(club.id); setQrClubName(club.name) }}
                            className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${qrClubId === club.id ? 'bg-green-50 border border-green-300' : 'hover:bg-gray-50'}`}
                          >
                            {club.logo_url ? (
                              <img src={club.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-gray-400" />
                              </div>
                            )}
                            <span className="text-sm font-medium text-gray-900">{club.name}</span>
                            {qrClubId === club.id && <Check className="w-4 h-4 text-green-600 ml-auto" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    disabled={!qrClubId}
                    onClick={() => setQrStep(2)}
                    className="w-full py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t.common.next} →
                  </button>
                </>
              )}

              {/* === STEP 2: Players === */}
              {qrStep === 2 && (
                <>
                  {/* Swap hint */}
                  {qrPlayers.length === 4 && (
                    <p className="text-[10px] text-blue-500 text-center animate-pulse">
                      {qrSwapPosition !== null ? 'Toca num jogador da outra equipa para trocar' : 'Toca num jogador para trocar de equipa'}
                    </p>
                  )}

                  <div className="flex items-center gap-4">
                    {/* Team 1 */}
                    <div className="flex-1">
                      <p className="text-xs font-bold text-blue-600 mb-2 text-center">{t.common.team1}</p>
                      <div className="space-y-2">
                        {[1, 2].map(pos => {
                          const p = qrPlayers.find(pl => pl.position === pos)
                          const isSwapSelected = qrSwapPosition === pos
                          const otherTeamSelected = qrSwapPosition !== null && qrSwapPosition > 2
                          return (
                            <div key={pos} className="flex items-center gap-2">
                              {p ? (
                                <div
                                  onClick={() => {
                                    if (qrSwapPosition === pos) { setQrSwapPosition(null); return }
                                    if (qrSwapPosition !== null) {
                                      const swapTeam = qrSwapPosition <= 2 ? 1 : 2
                                      const thisTeam = pos <= 2 ? 1 : 2
                                      if (swapTeam !== thisTeam) {
                                        setQrPlayers(prev => prev.map(pl => {
                                          if (pl.position === pos) return { ...pl, position: qrSwapPosition! }
                                          if (pl.position === qrSwapPosition!) return { ...pl, position: pos }
                                          return pl
                                        }))
                                        setQrSwapPosition(null)
                                        return
                                      }
                                    }
                                    setQrSwapPosition(pos)
                                  }}
                                  className={`flex-1 flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                                    isSwapSelected ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-400 scale-105' :
                                    otherTeamSelected ? 'bg-blue-50 border-blue-300 hover:border-blue-500 hover:bg-blue-100' :
                                    'bg-blue-50 border-blue-200'
                                  }`}
                                >
                                  <div className="w-8 h-8 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center flex-shrink-0">
                                    {p.avatar_url ? (
                                      <img src={p.avatar_url} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-xs font-bold text-blue-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-gray-900 truncate">{p.name.split(' ')[0]}</p>
                                    {p.level && <p className="text-[10px] text-gray-500">Nv. {Number(p.level).toFixed(2)}</p>}
                                  </div>
                                  {p.id !== player?.id && (
                                    <button onClick={e => { e.stopPropagation(); setQrPlayers(prev => prev.filter(pl => pl.position !== pos)); setQrSwapPosition(null) }} className="p-1 text-red-400 hover:text-red-600">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setQrSelectingPosition(pos); setQrSwapPosition(null); setQrSearchQuery(''); setQrSearchResults([]) }}
                                  className={`flex-1 flex items-center justify-center gap-1 p-2 rounded-lg border-2 border-dashed transition-colors ${qrSelectingPosition === pos ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-green-400'}`}
                                >
                                  <Plus className="w-3.5 h-3.5 text-gray-400" />
                                  <span className="text-xs text-gray-500">{t.common.player} {pos}</span>
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <span className="text-gray-300 font-bold text-lg">VS</span>

                    {/* Team 2 */}
                    <div className="flex-1">
                      <p className="text-xs font-bold text-red-600 mb-2 text-center">{t.common.team2}</p>
                      <div className="space-y-2">
                        {[3, 4].map(pos => {
                          const p = qrPlayers.find(pl => pl.position === pos)
                          const isSwapSelected = qrSwapPosition === pos
                          const otherTeamSelected = qrSwapPosition !== null && qrSwapPosition <= 2
                          return (
                            <div key={pos} className="flex items-center gap-2">
                              {p ? (
                                <div
                                  onClick={() => {
                                    if (qrSwapPosition === pos) { setQrSwapPosition(null); return }
                                    if (qrSwapPosition !== null) {
                                      const swapTeam = qrSwapPosition <= 2 ? 1 : 2
                                      const thisTeam = pos <= 2 ? 1 : 2
                                      if (swapTeam !== thisTeam) {
                                        setQrPlayers(prev => prev.map(pl => {
                                          if (pl.position === pos) return { ...pl, position: qrSwapPosition! }
                                          if (pl.position === qrSwapPosition!) return { ...pl, position: pos }
                                          return pl
                                        }))
                                        setQrSwapPosition(null)
                                        return
                                      }
                                    }
                                    setQrSwapPosition(pos)
                                  }}
                                  className={`flex-1 flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                                    isSwapSelected ? 'bg-red-100 border-red-500 ring-2 ring-red-400 scale-105' :
                                    otherTeamSelected ? 'bg-red-50 border-red-300 hover:border-red-500 hover:bg-red-100' :
                                    'bg-red-50 border-red-200'
                                  }`}
                                >
                                  <div className="w-8 h-8 rounded-full overflow-hidden bg-red-100 flex items-center justify-center flex-shrink-0">
                                    {p.avatar_url ? (
                                      <img src={p.avatar_url} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-xs font-bold text-red-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-gray-900 truncate">{p.name.split(' ')[0]}</p>
                                    {p.level && <p className="text-[10px] text-gray-500">Nv. {Number(p.level).toFixed(2)}</p>}
                                  </div>
                                  <button onClick={e => { e.stopPropagation(); setQrPlayers(prev => prev.filter(pl => pl.position !== pos)); setQrSwapPosition(null) }} className="p-1 text-red-400 hover:text-red-600">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setQrSelectingPosition(pos); setQrSwapPosition(null); setQrSearchQuery(''); setQrSearchResults([]) }}
                                  className={`flex-1 flex items-center justify-center gap-1 p-2 rounded-lg border-2 border-dashed transition-colors ${qrSelectingPosition === pos ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-green-400'}`}
                                >
                                  <Plus className="w-3.5 h-3.5 text-gray-400" />
                                  <span className="text-xs text-gray-500">{t.common.player} {pos}</span>
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Player search */}
                  {qrSelectingPosition !== null && (
                    <div className="border border-green-200 rounded-xl p-3 bg-green-50/50">
                      <p className="text-xs font-semibold text-green-700 mb-2">{t.common.addPlayer} - {t.common.player} {qrSelectingPosition}</p>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder={t.common.searchPlayer}
                          value={qrSearchQuery}
                          onChange={e => setQrSearchQuery(e.target.value)}
                          className="w-full py-2 pl-9 pr-4 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          autoFocus
                        />
                      </div>
                      {qrSearching && (
                        <div className="text-center py-2">
                          <div className="animate-spin w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full mx-auto" />
                        </div>
                      )}
                      {qrSearchResults.length > 0 && (
                        <div className="mt-2 max-h-36 overflow-y-auto space-y-1">
                          {qrSearchResults.map(p => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setQrPlayers(prev => [...prev, {
                                  position: qrSelectingPosition!,
                                  id: p.id,
                                  name: p.name,
                                  avatar_url: p.avatar_url || null,
                                  level: p.level ?? null,
                                }])
                                setQrSelectingPosition(null)
                                setQrSearchQuery('')
                                setQrSearchResults([])
                              }}
                              className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white transition-colors"
                            >
                              <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                                {p.avatar_url ? (
                                  <img src={p.avatar_url} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[10px] font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                                )}
                              </div>
                              <span className="text-sm text-gray-900">{p.name}</span>
                              {p.level && <span className="text-[10px] text-gray-400 ml-auto">Nv. {Number(p.level).toFixed(2)}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                      {!qrSearching && qrSearchQuery.length >= 2 && qrSearchResults.length === 0 && (
                        <p className="text-xs text-gray-400 text-center mt-2">{t.common.noPlayersFound}</p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => setQrStep(1)}
                      className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors"
                    >
                      ← {t.common.previous}
                    </button>
                    <button
                      disabled={qrPlayers.length !== 4}
                      onClick={() => setQrStep(3)}
                      className="flex-1 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t.common.next} →
                    </button>
                  </div>
                </>
              )}

              {/* === STEP 3: Scores === */}
              {qrStep === 3 && (
                <>
                  {/* Summary */}
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">{qrClubName}</span>
                      <span className="text-xs text-gray-400 ml-auto">{new Date(qrDate).toLocaleDateString('pt-PT')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 text-center">
                        <p className="text-[10px] font-bold text-blue-600">{t.common.team1}</p>
                        {qrPlayers.filter(p => p.position <= 2).map(p => (
                          <p key={p.id} className="text-xs text-gray-700 truncate">{p.name.split(' ')[0]}</p>
                        ))}
                      </div>
                      <span className="text-gray-300 text-sm font-bold">VS</span>
                      <div className="flex-1 text-center">
                        <p className="text-[10px] font-bold text-red-600">{t.common.team2}</p>
                        {qrPlayers.filter(p => p.position > 2).map(p => (
                          <p key={p.id} className="text-xs text-gray-700 truncate">{p.name.split(' ')[0]}</p>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Score inputs */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-3 gap-y-2 items-center">
                      <span className="text-xs text-transparent">.</span>
                      <span className="text-[10px] font-bold text-blue-600 text-center">{t.common.team1}</span>
                      <span className="text-xs text-transparent">.</span>
                      <span className="text-[10px] font-bold text-red-600 text-center">{t.common.team2}</span>
                    </div>
                    {['Set 1', 'Set 2', 'Set 3'].map((label, idx) => (
                      <div key={label} className="flex items-center gap-3">
                        <span className={`text-sm font-medium w-12 ${idx === 2 ? 'text-gray-400' : 'text-gray-700'}`}>{label}</span>
                        <input
                          type="number"
                          min="0"
                          max="7"
                          placeholder="0"
                          value={idx === 0 ? qrScores.t1s1 : idx === 1 ? qrScores.t1s2 : qrScores.t1s3}
                          onChange={e => {
                            const key = idx === 0 ? 't1s1' : idx === 1 ? 't1s2' : 't1s3'
                            setQrScores(prev => ({ ...prev, [key]: e.target.value }))
                          }}
                          className="flex-1 text-center py-2.5 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                        <span className="text-gray-300 font-bold">-</span>
                        <input
                          type="number"
                          min="0"
                          max="7"
                          placeholder="0"
                          value={idx === 0 ? qrScores.t2s1 : idx === 1 ? qrScores.t2s2 : qrScores.t2s3}
                          onChange={e => {
                            const key = idx === 0 ? 't2s1' : idx === 1 ? 't2s2' : 't2s3'
                            setQrScores(prev => ({ ...prev, [key]: e.target.value }))
                          }}
                          className="flex-1 text-center py-2.5 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 text-center">O 3° set é opcional</p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setQrStep(2)}
                      className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors"
                    >
                      ← {t.common.previous}
                    </button>
                    <button
                      disabled={qrSubmitting || !qrScores.t1s1 || !qrScores.t2s1 || !qrScores.t1s2 || !qrScores.t2s2}
                      onClick={handleQuickResultSubmit}
                      className="flex-1 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {qrSubmitting ? 'A gravar...' : `✓ ${t.common.confirmResult}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: Disputar Resultado === */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-gray-900">📊 {t.results.disputeResult}</h3>
              <button onClick={() => setConfirmModal(null)} className="p-1">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              {/* Teams */}
              {(() => {
                const cp = confirmModal.game.players.filter(p => p.status === 'confirmed')
                const t1 = cp.filter(p => (p.position || 0) <= 2)
                const t2 = cp.filter(p => (p.position || 0) > 2)
                const r = confirmModal.result
                
                // Determine winner
                const s1 = [r.team1_score_set1 || 0, r.team2_score_set1 || 0]
                const s2 = [r.team1_score_set2 || 0, r.team2_score_set2 || 0]
                const s3 = [r.team1_score_set3 || 0, r.team2_score_set3 || 0]
                const sets1 = (s1[0] > s1[1] ? 1 : 0) + (s2[0] > s2[1] ? 1 : 0) + (s3[0] > s3[1] ? 1 : 0)
                const sets2 = (s1[1] > s1[0] ? 1 : 0) + (s2[1] > s2[0] ? 1 : 0) + (s3[1] > s3[0] ? 1 : 0)
                const team1Won = sets1 > sets2
                
                return (
                  <>
                    <div className="flex items-center gap-4">
                      <div className={`flex-1 text-center p-3 rounded-xl ${team1Won ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                        <p className="text-xs font-bold text-blue-600 mb-1">Equipa 1 {team1Won ? '🏆' : ''}</p>
                        {t1.map(p => <p key={p.id} className="text-xs text-gray-700">{(p.name || '').split(' ')[0]}</p>)}
                      </div>
                      <span className="text-gray-300 font-bold">VS</span>
                      <div className={`flex-1 text-center p-3 rounded-xl ${!team1Won ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                        <p className="text-xs font-bold text-red-600 mb-1">Equipa 2 {!team1Won ? '🏆' : ''}</p>
                        {t2.map(p => <p key={p.id} className="text-xs text-gray-700">{(p.name || '').split(' ')[0]}</p>)}
                      </div>
                    </div>
                    
                    {/* Scores display */}
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-[10px] text-gray-500 mb-1">Set 1</p>
                          <p className="text-lg font-bold text-gray-900">{r.team1_score_set1} - {r.team2_score_set1}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 mb-1">Set 2</p>
                          <p className="text-lg font-bold text-gray-900">{r.team1_score_set2} - {r.team2_score_set2}</p>
                        </div>
                        {(r.team1_score_set3 > 0 || r.team2_score_set3 > 0) && (
                          <div>
                            <p className="text-[10px] text-gray-500 mb-1">Set 3</p>
                            <p className="text-lg font-bold text-gray-900">{r.team1_score_set3} - {r.team2_score_set3}</p>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 text-center mt-2">
                        Submetido pela Equipa {r.submitted_by_team}
                      </p>
                    </div>
                  </>
                )
              })()}
              
              {/* Determine if I can confirm/dispute */}
              {(() => {
                const myPlayer = confirmModal.game.players.find(p => p.user_id === userId || (player?.id && p.player_account_id === player.id))
                const myTeam = myPlayer ? ((myPlayer.position || 0) <= 2 ? 1 : 2) : 0
                const canDispute = myTeam !== 0 && myTeam !== confirmModal.result.submitted_by_team

                if (!canDispute) {
                  return (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                      <p className="text-sm text-green-700 font-medium">✓ {t.results.resultRegistered}</p>
                    </div>
                  )
                }

                return (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 text-center">O resultado já está registado. Discordas do resultado?</p>
                    <button
                      onClick={async () => {
                        if (!confirm(t.results.disputePrompt)) return
                        setSubmittingResult(true)
                        const { disputeGameResult } = await import('./lib/openGames')
                        const res = await disputeGameResult(confirmModal.game.id)
                        if (res.success) {
                          alert(t.results.resultDisputed)
                          setConfirmModal(null)
                          if (userId) {
                            const { fetchResultGamesForTab } = await import('./lib/openGames')
                            const data = await fetchResultGamesForTab(userId, player?.id)
                            setPastGames(data)
                          }
                        } else {
                          alert(res.error || t.results.disputeError)
                        }
                        setSubmittingResult(false)
                      }}
                      disabled={submittingResult}
                      className="w-full py-3 bg-red-100 text-red-700 rounded-xl text-sm font-semibold hover:bg-red-200 transition-colors disabled:opacity-50"
                    >
                      ✗ {t.results.disputeResult}
                    </button>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: Criar Jogo === */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in my-4">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-gray-900">{t.games.createGame}</h3>
              <button onClick={() => setCreateModal(null)} className="p-1">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Info */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{createModal.clubName}</p>
                  <p className="text-xs text-gray-500">{createModal.date} às {createModal.time}</p>
                </div>
              </div>

              {/* Court Selector */}
              {createModal.courts.length > 1 && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">🏟️ {t.games.court}</label>
                  <div className="flex gap-2 flex-wrap">
                    {createModal.courts.map((c, i) => {
                      const typeLabel = c.court_type === 'indoor' ? `🏠 ${t.games.indoor}` : c.court_type === 'outdoor' ? `☀️ ${t.games.outdoor}` : c.court_type === 'covered' ? `🏗️ ${t.games.covered}` : ''
                      return (
                        <button
                          key={c.court_id}
                          onClick={() => {
                            setSelectedCourtIdx(i)
                            setCreateDuration(c.durations.includes(90) ? 90 : c.durations[0] || 60)
                          }}
                          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                            selectedCourtIdx === i 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <span>{c.court_name}</span>
                          {typeLabel && <span className="block text-[10px] font-normal opacity-80">{typeLabel}</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              {createModal.courts.length === 1 && (
                <div className="p-3 bg-indigo-50 rounded-xl flex items-center gap-2">
                  <span className="text-sm text-gray-600">🏟️ {t.games.court}:</span>
                  <span className="font-semibold text-indigo-700 text-sm">
                    {createModal.courts[0].court_name}
                    {createModal.courts[0].court_type && (
                      <span className="ml-2 text-xs font-normal text-indigo-500">
                        {createModal.courts[0].court_type === 'indoor' ? `🏠 ${t.games.indoor}` : createModal.courts[0].court_type === 'outdoor' ? `☀️ ${t.games.outdoor}` : `🏗️ ${t.games.covered}`}
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Duration */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">Duração</label>
                <div className="flex gap-2">
                  {(createModal.courts[selectedCourtIdx]?.durations || [90]).map(d => (
                    <button
                      key={d}
                      onClick={() => setCreateDuration(d)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                        createDuration === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Gender */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">Género</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'all' as const, label: 'Todos' },
                    { value: 'male' as const, label: 'Apenas Masculino' },
                    { value: 'female' as const, label: 'Apenas Feminino' },
                    { value: 'mixed' as const, label: t.learn.mixedPlural },
                  ].map(g => (
                    <button
                      key={g.value}
                      onClick={() => setCreateGender(g.value)}
                      className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        createGender === g.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price info */}
              {(() => {
                const court = createModal.courts[selectedCourtIdx]
                const price = court ? (createDuration === 120 ? (court.price_120 || court.price_90 * 4/3) : createDuration === 90 ? court.price_90 : court.price_60) : 0
                return (
                  <div className="p-3 bg-blue-50 rounded-xl flex items-center justify-between">
                    <span className="text-sm text-gray-700">Preço por jogador</span>
                    <span className="font-bold text-blue-600 text-lg">{price.toFixed(2)}€</span>
                  </div>
                )
              })()}

              {/* Level range info */}
              <div className="p-3 bg-gray-50 rounded-xl text-center">
                <p className="text-xs text-gray-500">Intervalo de nível</p>
                <p className="font-bold text-gray-900">
                  {Math.max(1.0, playerLevel - 0.5).toFixed(2)} - {Math.min(7.0, playerLevel + 0.5).toFixed(2)}
                </p>
                <p className="text-[10px] text-gray-400">Baseado no teu nível ({playerLevel.toFixed(2)})</p>
              </div>

              {/* Create button */}
              <button
                onClick={handleCreateGame}
                disabled={creating}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {creating ? t.booking.creating : `🎾 ${t.games.createGame}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: Adicionar Jogador === */}
      {addPlayerModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl overflow-hidden animate-fade-in max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold text-lg text-gray-900">
                {t.games.addPlayer ?? 'Adicionar jogador'}
                {addPlayerModal.position != null && (
                  <span className="ml-2 text-sm font-normal text-indigo-600">
                    ({addPlayerModal.position <= 2 ? t.games.team1 ?? 'Equipa 1' : t.games.team2 ?? 'Equipa 2'})
                  </span>
                )}
              </h3>
              <button
                onClick={() => { setAddPlayerModal(null); setPlayerSearchQuery(''); setPlayerSearchResults([]) }}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-gray-100 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Pesquisar jogador por nome..."
                  value={playerSearchQuery}
                  onChange={(e) => handleSearchPlayers(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  autoFocus
                />
              </div>
            </div>

            {/* Results */}
            <div className="overflow-y-auto flex-1 p-2">
              {searchingPlayers && (
                <div className="text-center py-8 text-gray-500 text-sm">A pesquisar...</div>
              )}
              {!searchingPlayers && playerSearchQuery.length >= 2 && playerSearchResults.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">Nenhum jogador encontrado</div>
              )}
              {!searchingPlayers && playerSearchQuery.length < 2 && (
                <div className="text-center py-8 text-gray-400 text-sm">Escreve pelo menos 2 letras para pesquisar</div>
              )}
              {playerSearchResults.map(pr => {
                const prColors = levelColors(pr.level)
                // Check if already in game
                const currentGame = games.find(g => g.id === addPlayerModal.gameId)
                const alreadyInGame = currentGame?.players.some(p => p.player_account_id === pr.id)
                return (
                  <button
                    key={pr.id}
                    disabled={addingPlayer || alreadyInGame}
                    onClick={() => handleAddPlayerToGame(pr.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${
                      alreadyInGame 
                        ? 'opacity-50 cursor-not-allowed bg-gray-50' 
                        : 'hover:bg-indigo-50 active:bg-indigo-100'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
                      {pr.avatar_url ? (
                        <img src={pr.avatar_url} alt={pr.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg font-bold text-gray-500">{(pr.name || '?').charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">{pr.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {pr.level != null && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: prColors?.hex || '#9ca3af' }}>
                            {pr.level.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Action */}
                    <div className="flex-shrink-0">
                      {alreadyInGame ? (
                        <span className="text-xs text-green-600 font-medium">No jogo</span>
                      ) : (
                        <Plus className="w-5 h-5 text-indigo-500" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Tipos para aulas (usando os do classes.ts)
type ClassGender = 'M' | 'F' | 'Misto'

// ---------- Aprender ----------
function LearnScreen({
  userId,
  playerAccountId,
  onBack,
  onOpenPlayerProfile,
  onOpenClub,
}: {
  userId: string | null
  playerAccountId: string | null
  onBack: () => void
  onOpenPlayerProfile: (userId: string, opts?: { accountId?: string | null; nameHint?: string | null }) => void
  onOpenClub: (clubId: string) => void
}) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'inscrever' | 'minhas-aulas'>('inscrever')
  const [availableClasses, setAvailableClasses] = useState<ClassData[]>([])
  const [myClasses, setMyClasses] = useState<ClassData[]>([])
  const [loading, setLoading] = useState(true)
  const [enrollingClassId, setEnrollingClassId] = useState<string | null>(null)
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null)

  // Carregar aulas disponíveis
  useEffect(() => {
    if (activeTab === 'inscrever') {
      loadAvailableClasses()
    } else if (activeTab === 'minhas-aulas' && userId) {
      loadMyClasses()
    }
  }, [activeTab, userId])

  // Atualizar automaticamente a cada 10 segundos para ver novas inscrições
  useEffect(() => {
    if (activeTab === 'inscrever') {
      const interval = setInterval(() => {
        loadAvailableClasses()
      }, 10000) // Atualizar a cada 10 segundos

      return () => clearInterval(interval)
    }
  }, [activeTab])

  const loadAvailableClasses = async () => {
    setLoading(true)
    try {
      const classes = await fetchAvailableClasses(null, userId, playerAccountId)
      setAvailableClasses(classes)
    } catch (error) {
      console.error('[LearnScreen] Error loading classes:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMyClasses = async () => {
    if (!userId) return
    setLoading(true)
    try {
      const classes = await fetchMyClasses(userId, playerAccountId)
      setMyClasses(classes)
    } catch (error) {
      console.error('[LearnScreen] Error loading my classes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEnroll = async (classId: string) => {
    if (!userId) {
      alert(t.learn.needAuth)
      return
    }

    setEnrollingClassId(classId)
    try {
      const success = await enrollInClass(classId, userId, playerAccountId)
      if (success) {
        alert(t.learn.enrollSuccess)
        // Recarregar aulas em ambas as tabs para garantir que todos veem a atualização
        await loadAvailableClasses()
        if (userId) {
          await loadMyClasses()
        }
      } else {
        alert(t.learn.enrollError)
      }
    } catch (error) {
      console.error('[LearnScreen] Error enrolling:', error)
      alert(t.learn.enrollErrorGeneric)
    } finally {
      setEnrollingClassId(null)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const days = t.common.dayNamesFull
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'] // TODO: traduzir meses
    return `${days[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]}`
  }

  const formatDateShort = (dateStr: string) => {
    const date = new Date(dateStr)
    const days = t.common.dayNamesFull.map(d => d.toUpperCase())
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'] // TODO: traduzir meses
    return `${days[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]}`
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }

  const getGenderIcon = (gender: ClassGender) => {
    if (gender === 'M') return '♂'
    if (gender === 'F') return '♀'
    return '⚥'
  }

  const getGenderLabel = (gender: ClassGender) => {
    if (gender === 'M') return t.games.male
    if (gender === 'F') return t.games.female
    return t.learn.mixed
  }

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{t.learn.title}</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('inscrever')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'inscrever' 
              ? 'bg-white text-gray-900 shadow-sm' 
              : 'text-gray-500'
          }`}
        >
          {t.common.enrollMe}
        </button>
        <button
          onClick={() => setActiveTab('minhas-aulas')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'minhas-aulas' 
              ? 'bg-white text-gray-900 shadow-sm' 
              : 'text-gray-500'
          }`}
        >
          {t.learn.myClasses}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">{t.common.loading}</div>
        </div>
      ) : (
        <>
          {activeTab === 'inscrever' && (
            <div className="space-y-4">
              {availableClasses.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  {t.learn.noClassesAvailable}
                </div>
              ) : (
                availableClasses.map((classItem) => (
                  <ClassCard 
                    key={classItem.id} 
                    classItem={classItem} 
                    formatDate={formatDate} 
                    formatDateShort={formatDateShort}
                    formatTime={formatTime}
                    getGenderIcon={getGenderIcon} 
                    getGenderLabel={getGenderLabel}
                    onEnroll={handleEnroll}
                    isEnrolling={enrollingClassId === classItem.id}
                    onOpenPlayerProfile={onOpenPlayerProfile}
                    onOpenClub={onOpenClub}
                    onClick={() => setSelectedClass(classItem)}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === 'minhas-aulas' && (
            <div className="space-y-4">
              {myClasses.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  {t.learn.noClassesEnrolled}
                </div>
              ) : (
                myClasses.map((classItem) => (
                  <ClassCard 
                    key={classItem.id} 
                    classItem={classItem} 
                    formatDate={formatDate} 
                    formatDateShort={formatDateShort}
                    formatTime={formatTime}
                    getGenderIcon={getGenderIcon} 
                    getGenderLabel={getGenderLabel}
                    isMyClass={true}
                    onOpenPlayerProfile={onOpenPlayerProfile}
                    onOpenClub={onOpenClub}
                    onClick={() => setSelectedClass(classItem)}
                  />
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Modal de detalhes da aula */}
      {selectedClass && (
        <ClassDetailsModal
          classItem={selectedClass}
          formatDate={formatDate}
          formatTime={formatTime}
          getGenderIcon={getGenderIcon}
          getGenderLabel={getGenderLabel}
          onClose={() => setSelectedClass(null)}
          onOpenPlayerProfile={onOpenPlayerProfile}
          onOpenClub={onOpenClub}
        />
      )}
    </div>
  )
}

// Componente de Modal de Detalhes da Aula
function ClassDetailsModal({
  classItem,
  formatDate,
  formatTime,
  getGenderIcon,
  getGenderLabel,
  onClose,
  onOpenPlayerProfile,
  onOpenClub,
}: {
  classItem: ClassData
  formatDate: (dateStr: string) => string
  formatTime: (dateStr: string) => string
  getGenderIcon: (gender: ClassGender) => string
  getGenderLabel: (gender: ClassGender) => string
  onClose: () => void
  onOpenPlayerProfile?: (userId: string) => void
  onOpenClub?: (clubId: string) => void
}) {
  const { t } = useI18n()
  const { scheduled_at, title, professor, professor_phone, professor_avatar, club, club_id, level, gender, maxPlayers, participants, price, court_name, notes, club_address, club_city, club_phone, club_email, club_website } = classItem
  const timeStr = formatTime(scheduled_at)
  const filledSlots = participants.length
  const emptySlots = maxPlayers - filledSlots

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-gray-900">{t.learn.classDetails}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Header da Aula */}
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-2xl text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-600 mb-1">
                {formatDate(scheduled_at)} às {timeStr}
              </p>
              {court_name && (
                <p className="text-sm text-gray-600">{t.common.court}: {court_name}</p>
              )}
            </div>
          </div>

          {/* Informações da Aula */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="w-5 h-5 text-gray-400" />
              {club_id && onOpenClub ? (
                <button
                  onClick={() => {
                    onOpenClub(club_id)
                    onClose()
                  }}
                  className="text-red-600 hover:text-red-700 hover:underline font-medium"
                >
                  {club}
                </button>
              ) : (
                <span className="text-gray-700">{club}</span>
              )}
            </div>
            {club_address && (
              <div className="flex items-start gap-3 text-sm ml-8">
                <span className="text-gray-600">{club_address}{club_city ? `, ${club_city}` : ''}</span>
              </div>
            )}
            {club_phone && (
              <div className="flex items-center gap-3 text-sm ml-8">
                <Phone className="w-4 h-4 text-gray-400" />
                <a href={`tel:${club_phone}`} className="text-blue-600 hover:underline">{club_phone}</a>
              </div>
            )}
            {club_email && (
              <div className="flex items-center gap-3 text-sm ml-8">
                <Mail className="w-4 h-4 text-gray-400" />
                <a href={`mailto:${club_email}`} className="text-blue-600 hover:underline">{club_email}</a>
              </div>
            )}
            {club_website && (
              <div className="flex items-center gap-3 text-sm ml-8">
                <Globe className="w-4 h-4 text-gray-400" />
                <a href={club_website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                  {club_website}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            <div className="flex items-center gap-3 text-sm">
              <TrendingUp className="w-5 h-5 text-gray-400" />
              <span className="text-gray-700">{t.home.level}: <span className="font-medium">{level || (t.language === 'pt' ? 'Todos os níveis' : t.language === 'en' ? 'All levels' : t.language === 'es' ? 'Todos los niveles' : 'Tous les niveaux')}</span></span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Users className="w-5 h-5 text-gray-400" />
              <span className="text-gray-700">{getGenderIcon(gender)} <span className="font-medium">{getGenderLabel(gender)}</span></span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <User className="w-5 h-5 text-gray-400" />
              {professor_phone && onOpenPlayerProfile ? (
                <button
                  onClick={async () => {
                    const { findPlayerUserIdByPhone } = await import('./lib/classes')
                    const userId = await findPlayerUserIdByPhone(professor_phone)
                    if (userId) {
                      onOpenPlayerProfile(userId)
                      onClose()
                    }
                  }}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  {professor_avatar ? (
                    <img
                      src={professor_avatar}
                      alt={professor}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white text-xs font-semibold">
                      {professor.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-red-600 hover:text-red-700 hover:underline font-medium">Prof. {professor === 'Sem professor' ? t.common.noProfessor : professor}</span>
                </button>
              ) : (
                <span className="text-gray-700">Prof. {professor === 'Sem professor' ? t.common.noProfessor : professor}</span>
              )}
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Users className="w-5 h-5 text-gray-400" />
              <span className="text-gray-700">Participantes: <span className="font-medium">{filledSlots}/{maxPlayers}</span></span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <CreditCard className="w-5 h-5 text-gray-400" />
              <span className="text-gray-700">Preço: <span className="font-medium">{price}€</span></span>
            </div>
          </div>

          {/* Notas */}
          {notes && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes}</p>
            </div>
          )}

          {/* Lista de Participantes */}
          <div className="border-t border-gray-200 pt-4">
            <h4 className="font-semibold text-gray-900 mb-4">Participantes ({filledSlots}/{maxPlayers})</h4>
            {participants.length === 0 ? (
              <p className="text-gray-500 text-sm">Ainda não há participantes inscritos</p>
            ) : (
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    {participant.avatar_url ? (
                      <img
                        src={participant.avatar_url}
                        alt={participant.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white font-semibold">
                        {participant.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {participant.user_id && onOpenPlayerProfile ? (
                      <button
                        onClick={() => {
                          onOpenPlayerProfile(participant.user_id!)
                          onClose()
                        }}
                        className="flex-1 text-left text-gray-900 font-medium hover:text-red-600 transition-colors"
                      >
                        {participant.name}
                      </button>
                    ) : (
                      <span className="flex-1 text-gray-900 font-medium">{participant.name}</span>
                    )}
                  </div>
                ))}
                {Array.from({ length: emptySlots }).map((_, idx) => (
                  <div
                    key={`empty-${idx}`}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300"
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <Plus className="w-5 h-5 text-gray-400" />
                    </div>
                    <span className="text-gray-400 text-sm">Vaga disponível</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Componente de Card de Aula
function ClassCard({
  classItem,
  formatDate,
  formatDateShort,
  formatTime,
  getGenderIcon,
  getGenderLabel,
  onEnroll,
  isEnrolling,
  isMyClass = false,
  onOpenPlayerProfile,
  onOpenClub,
  onClick,
}: {
  classItem: ClassData
  formatDate: (dateStr: string) => string
  formatDateShort: (dateStr: string) => string
  formatTime: (dateStr: string) => string
  getGenderIcon: (gender: ClassGender) => string
  getGenderLabel: (gender: ClassGender) => string
  onEnroll?: (classId: string) => void
  isEnrolling?: boolean
  isMyClass?: boolean
  onOpenPlayerProfile?: (userId: string) => void
  onOpenClub?: (clubId: string) => void
  onClick?: () => void
}) {
  const { t } = useI18n()
  const { scheduled_at, title, professor, professor_phone, professor_avatar, club, club_id, level, gender, maxPlayers, participants, price } = classItem
  const dateStr = scheduled_at.split('T')[0]
  const timeStr = formatTime(scheduled_at)
  const isFull = participants.length >= maxPlayers
  const filledSlots = participants.length
  const emptySlots = maxPlayers - filledSlots
  

  return (
    <div className={`card p-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`} onClick={onClick}>
      <div className="flex gap-4">
        {/* Left side - Icon */}
        <div className="flex-shrink-0">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <div className="text-center mt-2">
            <p className="text-xs font-semibold text-gray-700">Padel</p>
            <p className="text-xs text-gray-500">{t.learn.class}</p>
          </div>
        </div>

        {/* Right side - Details */}
        <div className="flex-1 min-w-0">
          {/* Date */}
          <p className="text-xs text-gray-500 mb-1">
            {formatDateShort(scheduled_at)} | {timeStr}
          </p>

          {/* Title */}
          <h3 className="font-bold text-lg text-gray-900 mb-2">{title}</h3>

          {/* Details row */}
          <div className="space-y-1.5 mb-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400" />
              {club_id && onOpenClub ? (
                <button
                  onClick={() => onOpenClub(club_id)}
                  className="text-red-600 hover:text-red-700 hover:underline font-medium"
                >
                  {club}
                </button>
              ) : (
                <span>{club}</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              <span className="font-medium">{t.home.level}: {level || (t.language === 'pt' ? 'Todos os níveis' : t.language === 'en' ? 'All levels' : t.language === 'es' ? 'Todos los niveles' : 'Tous les niveaux')}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="font-medium">{getGenderIcon(gender)} {getGenderLabel(gender)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="w-4 h-4 text-gray-400" />
              {professor_phone && onOpenPlayerProfile ? (
                <button
                  onClick={async () => {
                    const { findPlayerUserIdByPhone } = await import('./lib/classes')
                    const userId = await findPlayerUserIdByPhone(professor_phone)
                    if (userId) {
                      onOpenPlayerProfile(userId)
                    }
                  }}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  {professor_avatar ? (
                    <img
                      src={professor_avatar}
                      alt={professor}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white text-xs font-semibold">
                      {professor.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-red-600 hover:text-red-700 hover:underline font-medium">Prof. {professor}</span>
                </button>
              ) : (
                <span>Prof. {professor === 'Sem professor' ? t.common.noProfessor : professor}</span>
              )}
            </div>
          </div>

          {/* Players row */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              {/* Player slots */}
              <div className="flex items-center gap-1.5">
                {participants.map((participant, idx) => (
                  <div
                    key={participant.id}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white text-xs font-semibold border-2 border-white shadow-sm"
                    title={participant.name}
                  >
                    {participant.avatar_url ? (
                      <img
                        src={participant.avatar_url}
                        alt={participant.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span>{participant.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                ))}
                {Array.from({ length: emptySlots }).map((_, idx) => (
                  <div
                    key={`empty-${idx}`}
                    className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center border-2 border-white"
                  >
                    <Plus className="w-4 h-4 text-gray-400" />
                  </div>
                ))}
              </div>
              {/* Counter */}
              <span className="text-sm font-medium text-gray-600 ml-1">
                {filledSlots}/{maxPlayers}
              </span>
            </div>

            {/* Sign up button */}
            {isMyClass ? (
              <div className="px-4 py-2 bg-emerald-100 text-emerald-700 text-sm font-semibold rounded-lg text-center">
                Inscrito
              </div>
            ) : (
              <button 
                onClick={() => onEnroll?.(classItem.id)}
                disabled={isEnrolling || isFull}
                className={`px-4 py-2 text-white text-sm font-semibold rounded-lg transition-colors ${
                  isFull 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : isEnrolling
                    ? 'bg-blue-400 cursor-wait'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isEnrolling ? t.common.enrolling : isFull ? t.common.classFull : `${t.common.enrollMe} - ${price}€`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Reservar ----------
function BookingScreen({
  player,
  userId,
  onBack,
  onOpenPlayerProfile,
  onRefresh,
}: {
  player: PlayerAccount | null
  userId: string | null
  onBack: () => void
  onOpenPlayerProfile: (userId: string, opts?: { accountId?: string | null; nameHint?: string | null }) => void
  onRefresh?: () => Promise<void>
}) {
  const { t } = useI18n()
  // Wizard step: 1=club, 2=date/time, 3=config, 4=players/teams, 5=confirmation
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [loading, setLoading] = useState(false)

  // Step 1: Club selection
  const [clubs, setClubs] = useState<import('./lib/openGames').ClubWithAvailability[]>([])
  const [loadingClubs, setLoadingClubs] = useState(true)
  const [selectedClub, setSelectedClub] = useState<import('./lib/openGames').ClubWithAvailability | null>(null)

  // Step 2: Date + time + court
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [selectedCourt, setSelectedCourt] = useState<import('./lib/openGames').CourtSlot | null>(null)

  // Step 3: Game config
  const [isPublic, setIsPublic] = useState(false)
  const [gameType, setGameType] = useState<'competitive' | 'friendly'>('competitive')
  const [gender, setGender] = useState<'all' | 'male' | 'female' | 'mixed'>('all')
  const [duration, setDuration] = useState<number>(90)

  // Step 4: Players
  const [players, setPlayers] = useState<{ slot: number; id: string; name: string; avatar_url: string | null; level: number | null; player_category: string | null; user_id?: string }[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; avatar_url: string | null; level: number | null; player_category: string | null; phone_number: string | null }[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)

  // Booking + Payment
  const [creating, setCreating] = useState(false)
  const [paymentChoice, setPaymentChoice] = useState<'at_club' | 'per_player' | 'full_court'>('at_club')

  const playerLevel = player?.level || 3.0

  // Determine payment options from selected club
  const clubPaymentMethod = selectedClub?.payment_method || 'at_club'
  const hasOnlinePayment = clubPaymentMethod !== 'at_club'
  const paymentOptions: { value: 'at_club' | 'per_player' | 'full_court'; label: string; icon: string; desc: string }[] = (() => {
    const opts: { value: 'at_club' | 'per_player' | 'full_court'; label: string; icon: string; desc: string }[] = []
    const allowsAtClub = ['at_club', 'at_club_or_per_player', 'at_club_or_full_court', 'all'].includes(clubPaymentMethod)
    const allowsPerPlayer = ['per_player', 'at_club_or_per_player', 'all'].includes(clubPaymentMethod)
    const allowsFullCourt = ['full_court', 'at_club_or_full_court', 'all'].includes(clubPaymentMethod)
    if (allowsAtClub) opts.push({ value: 'at_club', label: t.booking.paymentAtClubDesc, icon: '🏢', desc: t.booking.paymentAtClubDesc })
    if (allowsPerPlayer) opts.push({ value: 'per_player', label: t.common.payOnline, icon: '💳', desc: t.common.eachPlayerPays })
    if (allowsFullCourt) opts.push({ value: 'full_court', label: t.games.paymentOnlineFullCourt, icon: '💳', desc: t.booking.paymentOnlineFullCourtDesc })
    if (opts.length === 0) opts.push({ value: 'at_club', label: t.games.paymentAtClub, icon: '🏢', desc: t.booking.paymentAtClubDesc })
    return opts
  })()

  // Load clubs with availability
  useEffect(() => {
    const loadClubs = async () => {
      setLoadingClubs(true)
      const { fetchClubsWithAvailability } = await import('./lib/openGames')
      const data = await fetchClubsWithAvailability()
      setClubs(data)
      setLoadingClubs(false)
    }
    loadClubs()
  }, [])

  // Initialize player 1 (creator) on mount
  useEffect(() => {
    if (player) {
      setPlayers([{
        slot: 1,
        id: player.id,
        name: player.name || t.common.me,
        avatar_url: player.avatar_url || null,
        level: player.level || null,
        player_category: player.player_category || null,
        user_id: player.user_id || undefined,
      }])
    }
  }, [player])

  // Get dates for selected club
  const availableDates = selectedClub ? Object.keys(selectedClub.availability).sort() : []

  // Get time slots for selected date
  const availableSlots = (selectedClub && selectedDate)
    ? (selectedClub.availability[selectedDate] || [])
    : []

  // Get courts for selected time slot
  const availableCourts = availableSlots.find(s => s.time === selectedTime)?.courts || []

  // Format date for display
  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return ''
    
    try {
      const now = new Date()
      const d = new Date(dateStr + 'T12:00:00')
      
      // Verificar se a data é válida
      if (isNaN(d.getTime())) {
        return dateStr // Retornar a string original se a data for inválida
      }
      
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      
      if (diffDays === 0) return t.common.today || 'Hoje'
      if (diffDays === 1) return t.common.tomorrow || 'Amanhã'
      
      // Usar fallback se dayNamesShort não existir
      const dayNames = t.common.dayNamesShort || ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
      const dayIndex = d.getDay()
      
      // Verificar se o índice é válido
      if (dayIndex < 0 || dayIndex >= dayNames.length) {
        return `${d.getDate()}/${(d.getMonth() + 1).toString().padStart(2, '0')}`
      }
      
      return `${dayNames[dayIndex]} ${d.getDate()}/${(d.getMonth() + 1).toString().padStart(2, '0')}`
    } catch (error) {
      console.error('Error formatting date:', error, dateStr)
      return dateStr // Retornar a string original em caso de erro
    }
  }

  // Search players
  const handleSearch = async (q: string) => {
    setSearchQuery(q)
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    const { searchPlayerAccounts } = await import('./lib/openGames')
    const results = await searchPlayerAccounts(q)
    // Filter out already added players
    const existingIds = new Set(players.map(p => p.id))
    setSearchResults(results.filter(r => !existingIds.has(r.id)))
    setSearching(false)
  }

  // Add player to slot
  const handleAddPlayer = (p: { id: string; name: string; avatar_url: string | null; level: number | null; player_category: string | null }) => {
    if (selectedSlot == null) return
    setPlayers(prev => {
      const filtered = prev.filter(x => x.slot !== selectedSlot)
      return [...filtered, { slot: selectedSlot, ...p }].sort((a, b) => a.slot - b.slot)
    })
    setSelectedSlot(null)
    setSearchQuery('')
    setSearchResults([])
  }

  // Remove player from slot
  const handleRemovePlayer = (slot: number) => {
    if (slot === 1) return // Can't remove creator
    setPlayers(prev => prev.filter(x => x.slot !== slot))
  }

  // Swap player positions
  const handleSwapPlayers = (slotA: number, slotB: number) => {
    setPlayers(prev => {
      const a = prev.find(p => p.slot === slotA)
      const b = prev.find(p => p.slot === slotB)
      if (!a && !b) return prev
      const rest = prev.filter(p => p.slot !== slotA && p.slot !== slotB)
      if (a && b) return [...rest, { ...a, slot: slotB }, { ...b, slot: slotA }].sort((x, y) => x.slot - y.slot)
      if (a) return [...rest, { ...a, slot: slotB }].sort((x, y) => x.slot - y.slot)
      if (b) return [...rest, { ...b, slot: slotA }].sort((x, y) => x.slot - y.slot)
      return prev
    })
  }

  // Calculate price based on selected duration
  const pricePerPlayer = selectedCourt
    ? (duration === 120 ? selectedCourt.price_120 : duration === 90 ? selectedCourt.price_90 : selectedCourt.price_60)
    : 0

  // Create booking
  const handleCreateBooking = async () => {
    if (!selectedClub || !selectedCourt || !selectedDate || !selectedTime || !userId) return
    setCreating(true)

    const scheduledAt = `${selectedDate}T${selectedTime}:00`

    if (isPublic) {
      // Create as open game (public)
      const { createOpenGame } = await import('./lib/openGames')
      
      // Prepare players list (excluding creator who is already added)
      const otherPlayers = players.filter(p => p.slot !== 1).map(p => ({
        player_account_id: p.id,
        position: p.slot,
        name: p.name,
        phone_number: null, // Will be fetched from player_accounts if needed
      }))

      const result = await createOpenGame({
        userId,
        playerAccountId: player?.id || null,
        playerName: player?.name || null,
        playerPhone: player?.phone_number || null,
        clubId: selectedClub.id,
        courtId: selectedCourt.court_id,
        scheduledAt,
        durationMinutes: duration,
        gameType,
        gender,
        playerLevel,
        pricePerPlayer,
        isPrivate: false, // Public game
        players: otherPlayers, // Pre-fill players
      })

      if (result.success && result.gameId) {
        // Handle online payment if selected
        if (paymentChoice !== 'at_club' && pricePerPlayer > 0 && player?.id) {
          try {
            const { data: checkoutData, error: checkoutErr } = await supabase.functions.invoke('create-game-checkout', {
              body: {
                gameId: result.gameId,
                paymentType: paymentChoice,
                playerAccountId: player.id,
                successUrl: window.location.origin,
                cancelUrl: window.location.origin,
              },
            })
            if (!checkoutErr && checkoutData?.url) {
              window.location.href = checkoutData.url
              return
            }
          } catch (e) {
            console.error('Stripe checkout error:', e)
          }
        }
        setCreating(false)
        setStep(5)
        if (onRefresh) onRefresh()
      } else {
        setCreating(false)
        alert(result.error || t.games.createError)
      }
    } else {
      // Private booking: create via open_game with isPrivate flag
      const { createOpenGame } = await import('./lib/openGames')

      const otherPlayersPrivate = players.filter(p => p.slot !== 1).map(p => ({
        player_account_id: p.id,
        position: p.slot,
        name: p.name,
        phone_number: null,
      }))

      const result = await createOpenGame({
        userId,
        playerAccountId: player?.id || null,
        playerName: player?.name || null,
        playerPhone: player?.phone_number || null,
        clubId: selectedClub.id,
        courtId: selectedCourt.court_id,
        scheduledAt,
        durationMinutes: duration,
        gameType,
        gender,
        playerLevel,
        pricePerPlayer,
        isPrivate: true,
        players: otherPlayersPrivate,
      })

      if (result.success && result.gameId) {
        // Handle online payment for private bookings
        if (paymentChoice !== 'at_club' && pricePerPlayer > 0 && player?.id) {
          try {
            const { data: checkoutData, error: checkoutErr } = await supabase.functions.invoke('create-game-checkout', {
              body: {
                gameId: result.gameId,
                paymentType: paymentChoice,
                playerAccountId: player.id,
                successUrl: window.location.origin,
                cancelUrl: window.location.origin,
              },
            })
            if (!checkoutErr && checkoutData?.url) {
              window.location.href = checkoutData.url
              return
            }
          } catch (e) {
            console.error('Stripe checkout error:', e)
          }
        }

        // Update the court_booking notes to indicate private
        await supabase
          .from('court_bookings')
          .update({ notes: `${t.common.privateBookingNote} | ID: ${result.gameId}` })
          .like('notes', `%ID: ${result.gameId}%`)
          .eq('event_type', 'open_game')

        setCreating(false)
        setStep(5)
        if (onRefresh) onRefresh()
      } else {
        setCreating(false)
        alert(result.error || t.booking.bookingError)
      }
    }
  }

  // Render player slot
  const renderSlot = (slotNum: number, team: 'A' | 'B') => {
    const p = players.find(x => x.slot === slotNum)
    const pColors = levelColors(p?.level)
    if (p) {
      return (
        <div key={slotNum} className="flex flex-col items-center relative group">
          <div
            className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center border-2 border-white shadow-sm"
            onClick={() => p.user_id && onOpenPlayerProfile(p.user_id)}
          >
            {p.avatar_url ? (
              <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
            )}
          </div>
          <span className="text-[10px] text-gray-700 font-medium mt-1 truncate max-w-[70px] text-center">{(p.name || '').split(' ')[0]}</span>
          {p.level != null && (
            <div className="mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: pColors?.hex || '#9ca3af' }}>
                          {p.level.toFixed(2)}
            </div>
          )}
          {slotNum !== 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); handleRemovePlayer(slotNum) }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            >
              ×
            </button>
          )}
        </div>
      )
    }
    return (
      <div key={slotNum} className="flex flex-col items-center">
        <button
          onClick={() => { setSelectedSlot(slotNum); setSearchQuery(''); setSearchResults([]) }}
          className="w-14 h-14 rounded-full border-2 border-dashed border-indigo-300 flex items-center justify-center hover:bg-indigo-50 hover:border-indigo-500 transition-colors"
        >
          <UserPlus className="w-5 h-5 text-indigo-400" />
        </button>
        <span className="text-[10px] text-indigo-600 font-medium mt-1">Adicionar</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={step === 1 ? onBack : () => setStep(prev => Math.max(1, prev - 1) as any)} className="p-1 -ml-1">
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{t.booking.title}</h1>
      </div>

      {/* Progress bar */}
      {step < 5 && (
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-lime-500' : 'bg-gray-200'}`} />
          ))}
        </div>
      )}

      {/* === STEP 1: Choose Club === */}
      {step === 1 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t.common.chooseClub}</h2>
            <p className="text-xs text-gray-500">{t.common.selectClubWherePlay}</p>
          </div>
          {loadingClubs ? (
            <div className="text-center py-10">
              <div className="animate-spin w-8 h-8 border-2 border-lime-600 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm text-gray-500">{t.common.loadingClubs}</p>
            </div>
          ) : clubs.length > 0 ? (
            <div className="space-y-3">
              {clubs.map(club => (
                <button
                  key={club.id}
                  onClick={() => { setSelectedClub(club); setSelectedDate(''); setSelectedTime(''); setSelectedCourt(null); setStep(2) }}
                  className={`w-full border rounded-2xl overflow-hidden text-left transition-all hover:border-lime-400 hover:shadow-sm ${
                    selectedClub?.id === club.id ? 'border-lime-500 bg-lime-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  {/* Club photo banner if available */}
                  {(club.photo_url_1 || club.photo_url_2) && (
                    <div className="w-full flex gap-0.5">
                      {club.photo_url_1 && (
                        <img src={club.photo_url_1} alt="" className={`${club.photo_url_2 ? 'w-1/2' : 'w-full'} h-28 object-cover`} />
                      )}
                      {club.photo_url_2 && (
                        <img src={club.photo_url_2} alt="" className={`${club.photo_url_1 ? 'w-1/2' : 'w-full'} h-28 object-cover`} />
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-3 w-full p-4">
                    {club.logo_url ? (
                      <img src={club.logo_url} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900">{club.name}</p>
                      {club.city && <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {club.city}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {club.courts.length} {club.courts.length > 1 ? t.games.courts : t.games.court} • {club.operating_hours.start} - {club.operating_hours.end}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <span className="text-4xl block mb-3">🏟️</span>
              <p className="font-semibold text-gray-700 mb-1">{t.common.noClubsAvailable}</p>
              <p className="text-sm text-gray-500">{t.common.noClubsAvailability}</p>
            </div>
          )}
        </div>
      )}

      {/* === STEP 2: Choose Date + Time + Court === */}
      {step === 2 && selectedClub && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            {selectedClub.logo_url ? (
              <img src={selectedClub.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-gray-400" />
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-900 text-sm">{selectedClub.name}</p>
              {selectedClub.city && <p className="text-xs text-gray-500">{selectedClub.city}</p>}
            </div>
          </div>

          {/* Club facility photos */}
          {(selectedClub.photo_url_1 || selectedClub.photo_url_2) && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {selectedClub.photo_url_1 && (
                <img
                  src={selectedClub.photo_url_1}
                  alt="Instalações"
                  className="h-32 w-auto rounded-xl object-cover flex-shrink-0"
                />
              )}
              {selectedClub.photo_url_2 && (
                <img
                  src={selectedClub.photo_url_2}
                  alt="Instalações"
                  className="h-32 w-auto rounded-xl object-cover flex-shrink-0"
                />
              )}
            </div>
          )}

          {/* Date picker */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">📅 {t.common.date}</label>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
              {availableDates.map(d => (
                <button
                  key={d}
                  onClick={() => { setSelectedDate(d); setSelectedTime(''); setSelectedCourt(null) }}
                  className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors snap-start ${
                    selectedDate === d ? 'bg-lime-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {formatDateLabel(d)}
                </button>
              ))}
            </div>
          </div>

          {/* Time picker */}
          {selectedDate && (
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">🕐 {t.common.time}</label>
              {availableSlots.length > 0 ? (
                <div className="flex gap-2 flex-wrap">
                  {availableSlots.map(slot => (
                    <button
                      key={slot.time}
                      onClick={() => {
                        setSelectedTime(slot.time)
                        // Auto-select first court
                        setSelectedCourt(slot.courts[0] || null)
                      }}
                      className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                        selectedTime === slot.time ? 'bg-lime-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">{t.common.noTimeSlotsAvailable}</p>
              )}
            </div>
          )}

          {/* Court picker */}
          {selectedTime && availableCourts.length > 1 && (
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">🏟️ {t.common.court}</label>
              <div className="flex gap-2 flex-wrap">
                {availableCourts.map(court => {
                  const typeLabel = court.court_type === 'indoor' ? `🏠 ${t.games.indoor}` : court.court_type === 'outdoor' ? `☀️ ${t.games.outdoor}` : court.court_type === 'covered' ? `🏗️ ${t.games.covered}` : ''
                  return (
                    <button
                      key={court.court_id}
                      onClick={() => {
                        setSelectedCourt(court)
                        // Default to 90 if available, else first available duration
                        setDuration(court.durations.includes(90) ? 90 : court.durations[0] || 60)
                      }}
                      className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                        selectedCourt?.court_id === court.court_id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span>{court.court_name}</span>
                      {typeLabel && <span className="block text-[10px] font-normal opacity-80">{typeLabel}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Selected court info (single court) */}
          {selectedTime && availableCourts.length === 1 && selectedCourt && (
            <div className="p-3 bg-indigo-50 rounded-xl flex items-center gap-2">
              <span className="text-sm text-gray-600">🏟️ Campo:</span>
              <span className="font-semibold text-indigo-700 text-sm">
                {selectedCourt.court_name}
                {selectedCourt.court_type && (
                  <span className="ml-2 text-xs font-normal text-indigo-500">
                    {selectedCourt.court_type === 'indoor' ? `🏠 ${t.games.indoor}` : selectedCourt.court_type === 'outdoor' ? `☀️ ${t.games.outdoor}` : `🏗️ ${t.games.covered}`}
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Continue button */}
          {selectedCourt && (
            <button
              onClick={() => setStep(3)}
              className="w-full py-3 bg-lime-600 text-white rounded-xl font-bold text-sm hover:bg-lime-700 transition-colors"
            >
              {t.common.continue} →
            </button>
          )}
        </div>
      )}

      {/* === STEP 3: Game Configuration === */}
      {step === 3 && selectedClub && selectedCourt && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="p-4 bg-gray-50 rounded-xl space-y-1">
            <p className="font-bold text-gray-900 text-sm">{selectedClub.name}</p>
            <p className="text-xs text-gray-500">{selectedCourt.court_name} • {formatDateLabel(selectedDate)} às {selectedTime}</p>
          </div>

          {/* Public / Private */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">{t.common.bookingType}</label>
            <div className="flex gap-2">
              <button
                onClick={() => setIsPublic(false)}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors border-2 ${
                  !isPublic ? 'border-lime-500 bg-lime-50 text-lime-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Lock className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                {t.common.private}
              </button>
              <button
                onClick={() => setIsPublic(true)}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors border-2 ${
                  isPublic ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Globe className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                {t.common.public}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {isPublic
                ? t.common.publicDesc
                : t.common.privateDesc}
            </p>
          </div>

          {/* Duration */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">⏱️ {t.common.duration}</label>
            <div className="flex gap-2">
              {(selectedCourt.durations || [90]).map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    duration === d ? 'bg-lime-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {d} min
                </button>
              ))}
            </div>
          </div>

          {/* Gender */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">👤 {t.booking.gender}</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'all' as const, label: t.common.all, icon: '👥' },
                { value: 'male' as const, label: t.games.male, icon: '♂️' },
                { value: 'female' as const, label: t.games.female, icon: '♀️' },
                { value: 'mixed' as const, label: t.learn.mixed, icon: '⚥' },
              ].map(g => (
                <button
                  key={g.value}
                  onClick={() => setGender(g.value)}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    gender === g.value ? 'bg-lime-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {g.icon} {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Price info */}
          <div className="p-3 bg-blue-50 rounded-xl flex items-center justify-between">
            <span className="text-sm text-gray-700">Preço por jogador</span>
            <span className="font-bold text-blue-600 text-lg">{pricePerPlayer.toFixed(2)}€</span>
          </div>

          <button
            onClick={() => setStep(4)}
            className="w-full py-3 bg-lime-600 text-white rounded-xl font-bold text-sm hover:bg-lime-700 transition-colors"
          >
            Continuar →
          </button>
        </div>
      )}

      {/* === STEP 4: Players & Teams === */}
      {step === 4 && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="p-4 bg-gray-50 rounded-xl space-y-1">
            <p className="font-bold text-gray-900 text-sm">{selectedClub?.name}</p>
            <p className="text-xs text-gray-500">
              {selectedCourt?.court_name} • {formatDateLabel(selectedDate)} às {selectedTime} • {duration}min
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isPublic ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                {isPublic ? '🌍 Público' : '🔒 Privado'}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                {gameType === 'competitive' ? '🏆 Competitivo' : '🤝 Amigável'}
              </span>
            </div>
          </div>

          {/* Teams layout */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-3 block">🎾 {t.common.teams}</label>
            <div className="flex items-start gap-4">
              {/* Team A */}
              <div className="flex-1">
                <p className="text-center text-xs font-bold text-gray-400 mb-2">{t.common.teamA}</p>
                <div className="flex gap-3 justify-center">
                  {renderSlot(1, 'A')}
                  {renderSlot(2, 'A')}
                </div>
              </div>
              {/* Divider */}
              <div className="flex flex-col items-center gap-1 pt-6">
                <div className="w-px h-16 bg-gray-200" />
                <span className="text-xs font-bold text-gray-300">VS</span>
                <div className="w-px h-16 bg-gray-200" />
              </div>
              {/* Team B */}
              <div className="flex-1">
                <p className="text-center text-xs font-bold text-gray-400 mb-2">{t.common.teamB}</p>
                <div className="flex gap-3 justify-center">
                  {renderSlot(3, 'B')}
                  {renderSlot(4, 'B')}
                </div>
              </div>
            </div>
          </div>

          {/* Swap buttons */}
          {players.length >= 2 && (
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-2">{t.common.swapPlayersBetweenTeams}</p>
              <div className="flex gap-2 justify-center flex-wrap">
                {players.length >= 2 && players.some(p => p.slot <= 2) && players.some(p => p.slot >= 3) && (
                  <button
                    onClick={() => {
                      const teamAPlayer = players.find(p => p.slot <= 2 && p.slot !== 1)
                        || players.find(p => p.slot <= 2)
                      const teamBPlayer = players.find(p => p.slot >= 3)
                      if (teamAPlayer && teamBPlayer) {
                        handleSwapPlayers(teamAPlayer.slot, teamBPlayer.slot)
                      }
                    }}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-600 transition-colors"
                  >
                    🔄 {t.common.swap}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Search player panel */}
          {selectedSlot != null && (
            <div className="border border-indigo-200 rounded-2xl overflow-hidden bg-white shadow-sm">
              <div className="p-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-indigo-800">{t.common.addPlayerPosition} {selectedSlot})</p>
                <button onClick={() => setSelectedSlot(null)} className="p-1 hover:bg-indigo-100 rounded-full">
                  <X className="w-4 h-4 text-indigo-500" />
                </button>
              </div>
              <div className="p-3">
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder={t.common.searchByName}
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    autoFocus
                  />
                </div>
                {searching && <p className="text-center text-sm text-gray-400 py-3">{t.common.searching}</p>}
                {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <p className="text-center text-sm text-gray-400 py-3">{t.common.noPlayersFound}</p>
                )}
                {searchResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {searchResults.map(r => {
                      const rColors = levelColors(r.level)
                      return (
                        <button
                          key={r.id}
                          onClick={() => handleAddPlayer(r)}
                          className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg text-left transition-colors"
                        >
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                            {r.avatar_url ? (
                              <img src={r.avatar_url} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-sm font-bold text-gray-600">{(r.name || '?').charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                            <div className="flex items-center gap-1.5">
                              {r.level != null && (
                                <span className="text-[9px] font-bold text-white px-1.5 py-0 rounded-full" style={{ backgroundColor: rColors?.hex || '#9ca3af' }}>
                                  {r.level.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                          <Plus className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Price summary */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Preço por jogador</span>
              <span className="font-bold text-green-700">{pricePerPlayer.toFixed(2)}€</span>
            </div>
            {paymentChoice === 'full_court' ? (
              <div className="flex items-center justify-between border-t border-green-200 pt-2">
                <span className="text-sm font-semibold text-gray-700">{t.common.total} ({t.games.fullCourt})</span>
                <span className="font-bold text-green-700 text-lg">{(pricePerPlayer * 4).toFixed(2)}€</span>
              </div>
            ) : (
              <div className="flex items-center justify-between border-t border-green-200 pt-2">
                <span className="text-sm font-semibold text-gray-700">{t.common.total} ({players.length} {players.length > 1 ? t.common.players : t.common.player})</span>
                <span className="font-bold text-green-700 text-lg">{(pricePerPlayer * players.length).toFixed(2)}€</span>
              </div>
            )}
          </div>

          {/* Payment method selection */}
          {pricePerPlayer > 0 && paymentOptions.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">💳 {t.booking.paymentMethod}</label>
              <div className="space-y-2">
                {paymentOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setPaymentChoice(opt.value)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                      paymentChoice === opt.value
                        ? 'border-lime-500 bg-lime-50 ring-1 ring-lime-500'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-xl">{opt.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${paymentChoice === opt.value ? 'text-lime-700' : 'text-gray-900'}`}>{opt.label}</p>
                      <p className="text-[11px] text-gray-500">{opt.desc}</p>
                    </div>
                    {paymentChoice === opt.value && (
                      <div className="w-5 h-5 rounded-full bg-lime-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Create button */}
          <button
            onClick={handleCreateBooking}
            disabled={creating}
            className={`w-full py-3.5 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50 shadow-sm ${
              paymentChoice !== 'at_club' && pricePerPlayer > 0
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-lime-600 hover:bg-lime-700'
            }`}
          >
            {creating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                A criar...
              </span>
            ) : paymentChoice !== 'at_club' && pricePerPlayer > 0 ? (
              `💳 ${t.booking.createAndPay} ${paymentChoice === 'full_court' ? (pricePerPlayer * 4).toFixed(2) : pricePerPlayer.toFixed(2)}€`
            ) : (
              isPublic ? `🎾 ${t.booking.createPublic}` : `📅 ${t.booking.createPrivate}`
            )}
          </button>
        </div>
      )}

      {/* === STEP 5: Confirmation === */}
      {step === 5 && (
        <div className="text-center py-10 space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {isPublic ? t.booking.gameCreated : t.booking.bookingConfirmed}
            </h2>
            <p className="text-sm text-gray-500">
              {isPublic
                ? t.booking.gameCreatedMessage
                : t.booking.bookingConfirmedMessage}
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl text-left space-y-2 max-w-sm mx-auto">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">{selectedClub?.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">{formatDateLabel(selectedDate)} às {selectedTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">{duration} minutos</span>
            </div>
            {selectedCourt && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700">{selectedCourt.court_name}</span>
              </div>
            )}
            {players.length > 0 && (
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700">{players.map(p => (p.name || '').split(' ')[0]).join(', ')}</span>
              </div>
            )}
          </div>

          <button
            onClick={onBack}
            className="px-8 py-3 bg-lime-600 text-white rounded-xl font-bold text-sm hover:bg-lime-700 transition-colors"
          >
            {t.common.back} {t.menu.home.toLowerCase()}
          </button>
        </div>
      )}
    </div>
  )
}

function GamesScreen({
  player,
  dashboardData,
  onRefresh,
  onBack,
  onOpenPlayerProfile,
  onOpenFindGame,
  onOpenGameResults,
  initialTab,
  isLiteMode = false,
  canFindGame = true,
}: {
  player: PlayerAccount | null
  dashboardData: PlayerDashboardData | null
  onRefresh: () => Promise<void>
  onBack: () => void
  onOpenPlayerProfile: (userId: string, opts?: { accountId?: string | null; nameHint?: string | null }) => void
  onOpenFindGame: () => void
  onOpenGameResults: () => void
  initialTab?: 'upcoming' | 'history'
  isLiteMode?: boolean
  canFindGame?: boolean
}) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>(initialTab || 'upcoming')
  
  // Update tab when initialTab changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab])
  
  const d = dashboardData
  const upcoming = d?.upcomingMatches ?? []
  const recent = d?.recentMatches ?? []
  const list = activeTab === 'upcoming' ? upcoming : recent

  const handlePlayerClick = async (playerName: string) => {
    if (!playerName || isLikelyTeamLabel(playerName)) return
    const { findPlayerAccountByName } = await import('./lib/classes')
    const acc = await findPlayerAccountByName(playerName)
    if (acc?.user_id) {
      onOpenPlayerProfile(acc.user_id, { accountId: acc.id, nameHint: playerName })
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900">{t.games.title}</h1>

      {(isLiteMode || !canFindGame) && (
        <button
          onClick={onOpenGameResults}
          className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl text-sm font-bold hover:from-green-700 hover:to-emerald-700 transition-all shadow-md flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t.common.quickResult}
        </button>
      )}

      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'upcoming' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          {t.games.upcoming}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          {t.games.history}
        </button>
      </div>

      {list.length > 0 ? (
        <div className="space-y-3">
          {list.map((match) => (
            <div key={match.id} className="w-full">
              {match.is_open_game && match.open_game_id && (match.status === 'completed' || (match.score1 != null && match.score2 != null)) ? (
                // For completed open games with results, use GameCardPlaytomic (same as tournaments)
                <GameCardPlaytomic 
                  match={match} 
                  fullWidth 
                  currentPlayerAvatar={player?.avatar_url} 
                  currentPlayerName={player?.name}
                  onPlayerClick={handlePlayerClick}
                />
              ) : match.is_open_game && match.open_game_id ? (
                // For upcoming open games, use OpenGameCard (with action buttons)
                <OpenGameCard
                  gameId={match.open_game_id}
                  match={match}
                  userId={player?.user_id}
                  playerAccountId={player?.id}
                  onRefresh={onRefresh}
                  fullWidth
                />
              ) : (
                // Tournament matches
                <GameCardPlaytomic 
                  match={match} 
                  fullWidth 
                  currentPlayerAvatar={player?.avatar_url} 
                  currentPlayerName={player?.name}
                  onPlayerClick={handlePlayerClick}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <span className="text-4xl mb-2 block">🎾</span>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Sem jogos</h3>
          <p className="text-gray-500 text-sm mb-4">
            {canFindGame ? 'Cria um jogo ou inscreve-te num torneio para começar' : 'Inscreve-te num torneio ou regista um resultado para começar'}
          </p>
          {canFindGame && (
          <button onClick={onOpenFindGame} className="px-6 py-3 btn-primary">Criar Jogo</button>
          )}
        </div>
      )}
    </div>
  )
}

/** Extrai nomes de jogadores de um match (excluindo o jogador atual). */
function getOtherPlayersFromMatch(match: { player1_name?: string; player2_name?: string; player3_name?: string; player4_name?: string; team1_name?: string; team2_name?: string; my_side?: 1 | 2 }, currentName?: string): string[] {
  return getPartnerNamesFromMatch(match, currentName)
}

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
  const totalMatches = (profile.wins ?? 0) + (profile.losses ?? 0)
  const winRate = totalMatches > 0 ? Math.round(((profile.wins ?? 0) / totalMatches) * 100) : 0

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
          <p className="text-xl font-bold text-green-600">{profile.wins ?? 0}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Vitórias</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg mb-0.5">📈</p>
          <p className="text-xl font-bold text-gray-900">{winRate}%</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Taxa</p>
        </div>
        <div className="card p-3 text-center cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => onOpenFollowsList(targetUserId)}>
          <p className="text-lg mb-0.5">👥</p>
          <p className="text-xl font-bold text-red-600">{profile.followingCount}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">A seguir</p>
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
  }, [player?.id])

  const levelChartData = useMemo(() => {
    const currentLevel = player?.level ?? 3.0
    const TARGET = 5

    // Primary source: levelHistory (real data from DB)
    if (levelHistory.length > 0) {
      const sorted = [...levelHistory]
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .slice(-TARGET)

      return sorted.map((h, i) => ({
        index: i,
        level: h.level_after,
        levelBefore: h.level_before,
        delta: h.delta,
        won: h.match_won,
        date: new Date(h.created_at),
        matchType: h.match_type,
      }))
    }

    // Fallback: estimate from recentMatches if no levelHistory exists
    const completedMatches = [...recentMatches]
      .filter(m => m.status === 'completed' && m.is_winner !== undefined)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

    const lastMatches = completedMatches.slice(-TARGET)
    if (lastMatches.length === 0) {
      return [{ index: 0, level: currentLevel, levelBefore: currentLevel, delta: 0, won: null as boolean | null, date: new Date(), matchType: 'tournament' }]
    }

    const totalRated = (player?.wins ?? 0) + (player?.losses ?? 0)
    const K = totalRated < 5 ? 0.50 : totalRated < 10 ? 0.35 : totalRated < 20 ? 0.25 : totalRated < 40 ? 0.15 : totalRated < 60 ? 0.10 : 0.06
    const baseDelta = K * 0.4

    const deltas = lastMatches.map(m => m.is_winner ? baseDelta : -baseDelta)
    let runLvl = currentLevel
    for (let i = deltas.length - 1; i >= 0; i--) runLvl = Math.max(0.5, runLvl - deltas[i])

    return lastMatches.map((m, i) => {
      const before = runLvl
      runLvl = Math.max(0.5, parseFloat((runLvl + deltas[i]).toFixed(2)))
      return {
        index: i,
        level: runLvl,
        levelBefore: parseFloat(before.toFixed(2)),
        delta: parseFloat(deltas[i].toFixed(4)),
        won: m.is_winner ?? null,
        date: new Date(m.start_time),
        matchType: m.is_open_game ? 'open_game' : 'tournament',
      }
    })
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
                  <circle cx={toX(i)} cy={toY(d.level)} r={i === data.length - 1 ? 5 : 3} fill={d.won === true ? '#22c55e' : d.won === false ? '#ef4444' : '#3b82f6'} stroke="white" strokeWidth="1.5" />
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
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Derrota</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Empate</span>
              </div>
            )}

            {levelHistory.length === 0 && recentMatches.length > 0 && (
              <p className="text-[10px] text-gray-400 text-center mt-1 italic">Valores estimados com base nos resultados recentes</p>
            )}
          </div>
        )
      })()}

      {/* Estatísticas - Jogos, Vitórias, Taxa, Seguir, Seguidores */}
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
          <p className="text-lg mb-0.5">📈</p>
          <p className="text-xl font-bold text-gray-900">{winRate}%</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Taxa</p>
        </div>
        <div className="card p-3 text-center cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => userId && onOpenFollowsList(userId)}>
          <p className="text-lg mb-0.5">👥</p>
          <p className="text-xl font-bold text-red-600">{followingCount}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">A seguir</p>
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
  const { t } = useI18n()

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
  // Fórmula: Nível = 0.5 + (score * 5.0 / 36)
  // 0 pts → 0.50 | 18 pts → 3.00 | 30 pts → 4.67 | 36 pts → 5.50
  // Ninguém pode ser > 5.50 via questionário
  const calculateLevel = (): number => {
    if (mode === 'bookOnly') return 1.0

    const totalScore = Object.values(answers).reduce((sum, v) => sum + v, 0)
    const answeredCount = Object.keys(answers).length

    if (answeredCount === 0) return 0.5

    const normalizedScore = answeredCount < 12
      ? (totalScore / answeredCount) * 12
      : totalScore

    const level = 0.5 + (normalizedScore * 5.0 / 36)
    return Math.round(Math.min(5.5, Math.max(0.5, level)) * 100) / 100
  }

  const handleRegister = async () => {
    setError('')
    setSaving(true)

    try {
      // Normalizar telefone
      const normalizedPhone = normalizePhone(regPhone)

      // Validações
      if (!name.trim()) { setError(t.register.nameRequired); setSaving(false); return }
      if (!isValidPhone(regPhone)) { 
        if (regPhone.trim() === '+' || (regPhone.trim().startsWith('+') && regPhone.trim().length < 4)) {
          setError(t.register.addCountryCode);
        } else {
          setError(t.auth.invalidPhone);
        }
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
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input value={regPhone} onChange={e => setRegPhone(e.target.value)} placeholder={t.register.phonePlaceholder} type="tel" className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
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
                if (!isValidPhone(regPhone)) { setError(t.auth.invalidPhone); return }
                if (!email.trim()) { setError(t.register.emailRequired); return }
                if (regPassword.length < 6) { setError(t.register.passwordMin); return }
                if (regPassword !== confirmPwd) { setError(t.register.passwordsMismatch); return }

                const checkPhone = normalizePhone(regPhone)
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
                  <p className="font-medium">{regPhone}</p>
                </div>
                <div>
                  <p className="text-gray-500">{t.register.estimatedLevel}</p>
                  <p className="font-bold text-red-600 text-lg">{calculateLevel().toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-500">{t.register.reliability}</p>
                  <p className="font-medium text-amber-600">10%</p>
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
