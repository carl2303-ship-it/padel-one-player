import { useState, useEffect, useMemo } from 'react'
import { supabase, PlayerAccount } from './lib/supabase'
import { useI18n } from './lib/i18nContext'
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
  Send,
  Trash2,
  ChevronLeft,
  Gift,
  ShoppingBag,
  CheckCircle,
  AlertCircle,
  Star
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
  categoryToLevel,
  categoryColors,
  getInitials,
  type CommunityPlayer,
  type PlayerProfile,
  type CommunityPost,
  type FeedItem,
  type FeedMatchItem,
  getUnifiedFeed,
} from './lib/communityData'
import { fetchAllClubs, fetchClubById, fetchUpcomingTournaments, fetchEnrolledByCategory, fetchTournamentFullDetail, getTournamentRegistrationUrl, type ClubDetail, type UpcomingTournamentFromTour, type EnrolledByCategory, type TournamentFullDetail } from './lib/clubAndTournaments'
import { fetchAvailableClasses, fetchMyClasses, enrollInClass, type Class as ClassData } from './lib/classes'
import { preloadAllPlayerData, getCachedPlayerData } from './lib/playerDataCache'
import { isPushSupported, checkIsSubscribed, subscribeToPush, unsubscribeFromPush } from './lib/pushNotifications'

type Screen = 'home' | 'games' | 'profile-view' | 'profile-edit' | 'club' | 'club-detail' | 'compete' | 'community' | 'player-profile' | 'follows-list' | 'learn' | 'find-game' | 'rewards' | 'booking' | 'payments'

function App() {
  const { t, language, setLanguage, languageNames, languageFlags } = useI18n()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [player, setPlayer] = useState<PlayerAccount | null>(null)
  const [authUserId, setAuthUserId] = useState<string | null>(null) // The real auth.uid() from Supabase
  const [currentScreen, setCurrentScreen] = useState<Screen>('home')
  const [selectedPlayerUserId, setSelectedPlayerUserId] = useState<string | null>(null)
  const [followsListUserId, setFollowsListUserId] = useState<string | null>(null) // For FollowsListScreen
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
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
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

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
        if (data.user_id) {
          // Pass playerAccount to avoid duplicate query (saves ~150ms)
          const [dash] = await Promise.all([
            fetchPlayerDashboardData(data.user_id, {
              id: data.id,
              name: data.name,
              phone_number: data.phone_number,
            }),
            preloadAllPlayerData(), // Carrega cache de jogadores em paralelo
          ])
          setDashboardData(dash)
          // Enrich with Edge Function in background (progressive loading)
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
        // Pass playerAccount to avoid duplicate query (saves ~150ms)
        const [data] = await Promise.all([
          fetchPlayerDashboardData(session.user.id, {
            id: playerAccount.id,
            name: playerAccount.name,
            phone_number: playerAccount.phone_number,
          }),
          preloadAllPlayerData(),
        ])
        setDashboardData(data)
        // Enrich with Edge Function in background (progressive loading)
        enrichDashboardWithEdgeFunction(dash).then(enriched => {
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
      let normalizedPhone = phone.trim().replace(/\s+/g, '')
      
      // Se começar só com + sem indicativo, adiciona +351
      if (normalizedPhone === '+' || (normalizedPhone.startsWith('+') && normalizedPhone.length < 4)) {
        normalizedPhone = '+351' + normalizedPhone.substring(1)
      } else if (!normalizedPhone.startsWith('+')) {
        normalizedPhone = '+351' + normalizedPhone
      }

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
        if (playerAccount.user_id) {
          // Pass playerAccount to avoid duplicate query (saves ~150ms)
          const [data] = await Promise.all([
            fetchPlayerDashboardData(playerAccount.user_id, {
              id: playerAccount.id,
              name: playerAccount.name,
              phone_number: playerAccount.phone_number,
            }),
            preloadAllPlayerData(),
          ])
          setDashboardData(data)
          // Enrich with Edge Function in background (progressive loading)
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
  // Edge function tem SEMPRE prioridade — bypassa RLS, tem nomes correctos
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
    if (showRegister) {
      return <RegisterScreen onBack={() => setShowRegister(false)} onSuccess={async (pa) => {
        setPlayer(pa as any)
        setAuthUserId(pa.user_id || null)
        setIsAuthenticated(true)
        if (pa.user_id) {
          const [data] = await Promise.all([
            fetchPlayerDashboardData(pa.user_id, { id: pa.id, name: pa.name, phone_number: pa.phone_number }),
            preloadAllPlayerData(),
          ])
          setDashboardData(data)
        }
      }} />
    }
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
      onRegister={() => setShowRegister(true)}
    />
  }

  const displayName = effectiveDashboard?.playerName || player?.name?.split(' ')[0] || t.common.player

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-light">
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
            className="absolute top-0 right-0 h-full w-[min(320px,85vw)] bg-white shadow-xl animate-fade-in"
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
            onOpenPlayerProfile={(uid: string) => { setSelectedPlayerUserId(uid); setCurrentScreen('player-profile') }}
            onOpenFindGame={() => setCurrentScreen('find-game')}
            onOpenRewards={() => setCurrentScreen('rewards')}
            onOpenBooking={() => setCurrentScreen('booking')}
          />
        )}
        {currentScreen === 'booking' && (
          <BookingScreen
            player={player}
            userId={player?.user_id ?? null}
            onBack={() => setCurrentScreen('home')}
            onOpenPlayerProfile={(uid: string) => { setSelectedPlayerUserId(uid); setCurrentScreen('player-profile') }}
            onRefresh={refreshDashboard}
          />
        )}
        {currentScreen === 'games' && (
          <GamesScreen
            player={player}
            dashboardData={effectiveDashboard}
            onRefresh={refreshDashboard}
            onBack={() => setCurrentScreen('home')}
            onOpenPlayerProfile={(uid: string) => { setSelectedPlayerUserId(uid); setCurrentScreen('player-profile') }}
            initialTab={gamesInitialTab}
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
            userId={player?.user_id ?? null}
            playerAccountId={player?.id ?? null}
            player={player}
            onBack={() => setCurrentScreen('home')}
          />
        )}
        {currentScreen === 'learn' && (
          <LearnScreen
            userId={player?.user_id ?? null}
            playerAccountId={player?.id ?? null}
            onBack={() => setCurrentScreen('home')}
            onOpenPlayerProfile={(uid: string) => { setSelectedPlayerUserId(uid); setCurrentScreen('player-profile') }}
            onOpenClub={(clubId: string) => { setSelectedClubId(clubId); setCurrentScreen('club-detail') }}
          />
        )}
        {currentScreen === 'find-game' && (
          <FindGameScreen
            player={player}
            userId={authUserId || player?.user_id || null}
            onBack={() => setCurrentScreen('home')}
            onOpenPlayerProfile={(uid: string) => { setSelectedPlayerUserId(uid); setCurrentScreen('player-profile') }}
            onRefresh={refreshDashboard}
          />
        )}
        {currentScreen === 'club-detail' && selectedClubId && (
          <ClubScreen favoriteClubId={selectedClubId} onBack={() => setCurrentScreen('learn')} />
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
            onOpenPlayerProfile={(uid: string) => { setSelectedPlayerUserId(uid); setCurrentScreen('player-profile') }}
          />
        )}
        {currentScreen === 'profile-edit' && (
          <ProfileEditScreen
            player={player}
            onSaveFavoriteClub={handleSaveFavoriteClub}
            onSaveProfile={handleSaveProfile}
          />
        )}
        {currentScreen === 'rewards' && player && (
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
          <CommunityScreen userId={player.user_id} playerAccountId={player.id} playerAvatar={player.avatar_url} playerName={player.name} onOpenPlayerProfile={(uid: string) => { setSelectedPlayerUserId(uid); setCurrentScreen('player-profile') }} />
        )}
        {currentScreen === 'player-profile' && selectedPlayerUserId && player?.user_id && (
          <OtherPlayerProfileScreen
            targetUserId={selectedPlayerUserId}
            myUserId={player.user_id}
            onBack={() => setCurrentScreen('community')}
            onOpenFollowsList={(uid: string) => { setFollowsListUserId(uid); setCurrentScreen('follows-list') }}
            onOpenPlayerProfile={(uid: string) => { setSelectedPlayerUserId(uid); setCurrentScreen('player-profile') }}
          />
        )}
        {currentScreen === 'follows-list' && followsListUserId && player?.user_id && (
          <FollowsListScreen
            targetUserId={followsListUserId}
            myUserId={player.user_id}
            onBack={() => setCurrentScreen('player-profile')}
            onOpenPlayerProfile={(uid: string) => { setSelectedPlayerUserId(uid); setCurrentScreen('player-profile') }}
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
  const { t } = useI18n()

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
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
              placeholder="Número de telemóvel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
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
                Entrar
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>

          <p className="text-center text-gray-500 text-sm">
            Introduz o teu número de telemóvel e password
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
          <FeatureCard icon={Trophy} label="Torneios" />
          <FeatureCard icon={Calendar} label="Reservas" />
          <FeatureCard icon={TrendingUp} label="Rankings" />
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
function parseTeamMembers(teamName: string): string[] {
  if (!teamName?.trim()) return ['?']
  const parts = teamName.split(/\s*\/\s*|\s*&\s*|,/).map((s) => s.trim()).filter(Boolean)
  return parts.length >= 1 ? parts.slice(0, 2) : ['?']
}
function initialFor(name: string): string {
  const t = name.trim()
  if (!t) return '?'
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase().slice(0, 2)
  return t.slice(0, 2).toUpperCase()
}

// Tipos para os dados integrados do Tour (PlayerMatch = formato do dashboardData)
type PlayerMatchForCard = import('./lib/playerDashboardData').PlayerMatch
type TournamentForCard = import('./lib/playerDashboardData').TournamentSummary

function ActionButton({ icon: Icon, label, color, onClick, emoji }: {
  icon: any
  label: string
  color: 'lime' | 'blue' | 'amber' | 'purple' | 'emerald'
  onClick?: () => void
  emoji?: string
}) {
  const colorClasses = {
    lime: 'bg-lime-400',
    blue: 'bg-blue-400',
    amber: 'bg-amber-400',
    purple: 'bg-purple-400',
    emerald: 'bg-emerald-400'
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

/** Garante 2 jogadores por equipa (padel = 4 jogadores). Fallback quando não há player1_name..player4_name. */
function twoPlayersPerTeam(teamName: string): [string, string] {
  const members = parseTeamMembers(teamName)
  const a = members[0] || '?'
  const b = members[1] || '?'
  return [a, b]
}

function isCurrentPlayer(playerName: string, currentName?: string): boolean {
  if (!currentName) return false
  const p = (playerName || '').trim().toLowerCase()
  const c = (currentName || '').trim().toLowerCase()
  if (!p || !c) return false
  if (p === c) return true
  // Match parcial: "Guilherme" vs "Guilherme Silva" ou vice-versa
  return p.startsWith(c) || c.startsWith(p)
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
      className={`w-11 h-11 rounded-full flex items-center justify-center shadow-sm flex-shrink-0 overflow-hidden ${!showAvatar ? bgClass : ''} ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
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
  const p1 = match.player1_name ?? twoPlayersPerTeam(match.team1_name)[0]
  const p2 = match.player2_name ?? twoPlayersPerTeam(match.team1_name)[1]
  const p3 = match.player3_name ?? twoPlayersPerTeam(match.team2_name)[0]
  const p4 = match.player4_name ?? twoPlayersPerTeam(match.team2_name)[1]
  
  const setStrings = [match.set1, match.set2, match.set3].filter(Boolean) as string[]
  const parsedSets = setStrings.map(parseSetScores)
  const hasSets = parsedSets.some(Boolean)
  const isTournament = Boolean(match.tournament_id && match.tournament_name)
  const team1Scores = parsedSets.map((p) => (p ? p[0] : '-'))
  const team2Scores = parsedSets.map((p) => (p ? p[1] : '-'))
  const team1Won = match.status === 'completed' && match.score1 != null && match.score2 != null && match.score1 > match.score2
  const team2Won = match.status === 'completed' && match.score1 != null && match.score2 != null && match.score2 > match.score1
  
  // Função para extrair primeiro nome
  const getFirstName = (fullName: string) => {
    return fullName.split(' ')[0]
  }
  
  // Função para renderizar jogador com nível (dados do cache global — sem queries)
  const renderPlayer = (name: string, bgClass: string, textClass: string) => {
    const firstName = getFirstName(name)
    const cached = getCachedPlayerData(name)
    const level = cached?.level ?? (cached?.player_category ? categoryToLevel(cached.player_category) : undefined)
    const category = cached?.player_category ?? undefined
    const colors = category ? categoryColors(category) : null
    // Usar avatar do cache, senão usar currentPlayerAvatar se for o jogador atual
    const avatarUrl = cached?.avatar_url ?? (isCurrentPlayer(name, currentPlayerName) ? currentPlayerAvatar : null)
    
    return (
      <div className="flex flex-col items-center min-h-[78px]">
        <PlayerCircle 
          name={name} 
          bgClass={bgClass} 
          textClass={textClass} 
          avatarUrl={avatarUrl} 
          currentPlayerName={currentPlayerName}
          onClick={onPlayerClick ? () => onPlayerClick(name) : undefined}
        />
        <span className="text-[10px] text-gray-700 font-medium truncate max-w-[60px] mt-1 text-center" title={name}>
          {firstName}
        </span>
        {level !== undefined && (
          <div 
            className="mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold text-white"
            style={{ backgroundColor: colors?.hex || '#9ca3af' }}
            title={`Nível ${level.toFixed(2)}${category ? ` - ${category}` : ''}`}
          >
            {level.toFixed(2)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`rounded-2xl bg-white border border-gray-100 shadow-md overflow-hidden ${fullWidth ? 'w-full' : 'flex-shrink-0 w-[280px] sm:w-[300px]'}`}>
      <div className="p-4">
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
            <div className="grid grid-cols-2 gap-x-4 gap-y-0 w-[120px] flex-shrink-0 items-start">
              {renderPlayer(p1, 'bg-orange-400', 'text-xl font-bold text-white')}
              {renderPlayer(p2, 'bg-orange-400', 'text-xl font-bold text-white')}
            </div>
            {match.status === 'completed' && (hasSets || match.score1 != null) && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {team1Won && (
                  <span className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center text-sm flex-shrink-0" title={t.games.winnerTeam}>🏆</span>
                )}
                <span className={team1Won ? 'text-2xl font-bold text-gray-900' : 'text-2xl font-medium text-gray-400'}>
                  {hasSets ? team1Scores.join(' ') : match.score1}
                </span>
              </div>
            )}
          </div>

          {/* Linha fina a dividir equipa 1 da equipa 2 */}
          <div className="border-t border-gray-200/60 my-2" />

          {/* Equipa 2 – azul claro (grid igual para alinhar com equipa 1) */}
          <div className="flex items-start justify-between gap-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-0 w-[120px] flex-shrink-0 items-start">
              {renderPlayer(p3, 'bg-sky-200', 'text-xl font-bold text-sky-800')}
              {renderPlayer(p4, 'bg-sky-200', 'text-xl font-bold text-sky-800')}
            </div>
            {match.status === 'completed' && (hasSets || match.score1 != null) && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {team2Won && (
                  <span className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center text-sm flex-shrink-0" title={t.games.winnerTeam}>🏆</span>
                )}
                <span className={team2Won ? 'text-2xl font-bold text-gray-900' : 'text-2xl font-medium text-gray-400'}>
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
  onViewStandings,
}: {
  tournament: TournamentForCard
  onViewStandings?: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="card overflow-hidden">
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
        {onViewStandings && (
          <button onClick={onViewStandings} className="w-full mt-3 py-2 btn-secondary text-sm font-medium">
            Ver classificação
          </button>
        )}
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
  onRefresh 
}: { 
  gameId: string
  match: PlayerMatchForCard
  userId?: string | null
  playerAccountId?: string | null
  onRefresh: () => Promise<void>
}) {
  const { t } = useI18n()
  const [game, setGame] = useState<import('./lib/openGames').OpenGame | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
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
        .single()

      if (data) {
        // Fetch players
        const { data: playersData } = await supabase
          .from('open_game_players')
          .select('*')
          .eq('game_id', gameId)
          .eq('status', 'confirmed')
          .order('position')

        // Fetch player account details
        const userIds = [...new Set((playersData || []).map((p: any) => p.user_id).filter(Boolean))]
        const playerAccountIds = [...new Set((playersData || []).map((p: any) => p.player_account_id).filter(Boolean))]
        let playerAccountsMap: { [key: string]: any } = {}

        if (userIds.length > 0 || playerAccountIds.length > 0) {
          let query = supabase
            .from('player_accounts')
            .select('id, user_id, name, avatar_url, level, player_category')

          if (userIds.length > 0) {
            query = query.in('user_id', userIds)
          } else if (playerAccountIds.length > 0) {
            query = query.in('id', playerAccountIds)
          }

          const { data: accounts } = await query

          if (accounts) {
            accounts.forEach((a: any) => {
              if (a.user_id) playerAccountsMap[a.user_id] = a
              playerAccountsMap[a.id] = a
            })
          }
        }

        // Enrich players data
        const enrichedPlayers = (playersData || []).map((p: any) => {
          const account = playerAccountsMap[p.user_id] || playerAccountsMap[p.player_account_id]
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
  }, [gameId])

  if (loading || !game) {
    return (
      <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm w-[280px]">
        <div className="p-4 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
          <div className="flex gap-3 justify-center mb-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="w-14 h-14 bg-gray-200 rounded-full"></div>
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
    const { data } = await supabase.from('open_games').select('*').eq('id', gameId).single()
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
        let q = supabase.from('player_accounts').select('id, user_id, name, avatar_url, level, player_category')
        if (uIds.length > 0) q = q.in('user_id', uIds)
        else if (paIds.length > 0) q = q.in('id', paIds)
        const { data: accts } = await q
        if (accts) accts.forEach((a: any) => { if (a.user_id) acctMap[a.user_id] = a; acctMap[a.id] = a })
      }
      const enriched = (playersData || []).map((p2: any) => {
        const acct = acctMap[p2.user_id] || acctMap[p2.player_account_id]
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
    setAddingPlayer(true)
    const { addPlayerToOpenGame } = await import('./lib/openGames')
    const result = await addPlayerToOpenGame({ gameId: game.id, playerAccountId: paId })
    setAddingPlayer(false)
    if (result.success) {
      setShowAddPlayer(false)
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
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm w-[280px]">
      <div className="p-4">
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
        <div className="flex items-start gap-2 mb-3">
          {/* Left team */}
          <div className="flex gap-2 flex-1 justify-center">
            {[0, 1].map(i => {
              const p = confirmedPlayers[i]
              if (p) {
                const pColors = p.player_category ? categoryColors(p.player_category) : null
                const isMe = p.user_id === userId || p.player_account_id === playerAccountId
                const canRemove = isCreator && !isMe && !actionLoading
                return (
                  <div key={p.id} className="flex flex-col items-center relative group">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
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
                    <span className="text-[9px] text-gray-700 font-medium mt-1 truncate max-w-[50px] text-center">{(p.name || '').split(' ')[0]}</span>
                    {p.level != null && (
                      <div className="mt-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold text-white" style={{ backgroundColor: pColors?.hex || '#9ca3af' }}>
                        {p.level.toFixed(2)}
                      </div>
                    )}
                  </div>
                )
              } else {
                return (
                  <div 
                    key={`empty-${i}`} 
                    className={`flex flex-col items-center ${isInGame ? 'cursor-pointer' : ''}`}
                    onClick={isInGame ? () => setShowAddPlayer(true) : undefined}
                  >
                    <div className={`w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center transition-colors ${isInGame ? 'border-blue-400 hover:border-blue-500 hover:bg-blue-50' : 'border-gray-300'}`}>
                      <UserPlus className={`w-5 h-5 ${isInGame ? 'text-blue-500' : 'text-gray-400'}`} />
                    </div>
                    <span className={`text-[9px] font-medium mt-1 ${isInGame ? 'text-blue-600' : 'text-gray-400'}`}>{isInGame ? t.common.add : t.common.free}</span>
                  </div>
                )
              }
            })}
          </div>
          
          {/* Divider */}
          <div className="w-px h-16 bg-gray-200 self-center" />
          
          {/* Right team */}
          <div className="flex gap-2 flex-1 justify-center">
            {[2, 3].map(i => {
              const p = confirmedPlayers[i]
              if (p) {
                const pColors = p.player_category ? categoryColors(p.player_category) : null
                const isMe = p.user_id === userId || p.player_account_id === playerAccountId
                const canRemove = isCreator && !isMe && !actionLoading
                return (
                  <div key={p.id} className="flex flex-col items-center relative group">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
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
                    <span className="text-[9px] text-gray-700 font-medium mt-1 truncate max-w-[50px] text-center">{(p.name || '').split(' ')[0]}</span>
                    {p.level != null && (
                      <div className="mt-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold text-white" style={{ backgroundColor: pColors?.hex || '#9ca3af' }}>
                        {p.level.toFixed(2)}
                      </div>
                    )}
                  </div>
                )
              } else {
                return (
                  <div 
                    key={`empty-${i}`} 
                    className={`flex flex-col items-center ${isInGame ? 'cursor-pointer' : ''}`}
                    onClick={isInGame ? () => setShowAddPlayer(true) : undefined}
                  >
                    <div className={`w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center transition-colors ${isInGame ? 'border-blue-400 hover:border-blue-500 hover:bg-blue-50' : 'border-gray-300'}`}>
                      <UserPlus className={`w-5 h-5 ${isInGame ? 'text-blue-500' : 'text-gray-400'}`} />
                    </div>
                    <span className={`text-[9px] font-medium mt-1 ${isInGame ? 'text-blue-600' : 'text-gray-400'}`}>{isInGame ? t.common.add : t.common.free}</span>
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
            <p className="text-xs font-semibold text-gray-700">Adicionar jogador</p>
            <button 
              onClick={() => { setShowAddPlayer(false); setAddPlayerSearch(''); setAddPlayerResults([]) }}
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
                const rColors = r.player_category ? categoryColors(r.player_category) : null
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
                { emoji: '✅', action: 'Confirmar resultado', points: 5, desc: 'Valida o resultado submetido por outro jogador' },
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
}: {
  player: PlayerAccount | null
  dashboardData: PlayerDashboardData | null
  userId: string | null
  onRefresh: () => Promise<void>
  onOpenClub: () => void
  onOpenCompete: () => void
  onOpenLearn: () => void
  onOpenGames: (tab?: 'upcoming' | 'history') => void
  onOpenFollowsList: (userId: string) => void
  onOpenPlayerProfile: (userId: string) => void
  onOpenFindGame: () => void
  onOpenRewards: () => void
  onOpenBooking: () => void
}) {
  const { t } = useI18n()
  const [viewingTournament, setViewingTournament] = useState<{ id: string; name: string } | null>(null)
  const [followingCount, setFollowingCount] = useState(0)
  const [followersCount, setFollowersCount] = useState(0)
  useEffect(() => {
    if (!userId) return
    getFollowingCount(userId).then(setFollowingCount)
    getFollowersCount(userId).then(setFollowersCount)
  }, [userId])
  const [tournamentDetail, setTournamentDetail] = useState<{
    standings: any[]
    myMatches: any[]
    name: string
  } | null>(null)
  const [detailTab, setDetailTab] = useState<'standings' | 'matches'>('standings')

  // Pending results state
  const [pendingResultGames, setPendingResultGames] = useState<(import('./lib/openGames').OpenGame & { _resultStatus?: string | null; _submittedByTeam?: number })[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [pendingResultModal, setPendingResultModal] = useState<{ game: any } | null>(null)
  const [pendingConfirmModal, setPendingConfirmModal] = useState<{ game: any; result: any } | null>(null)
  const [pendingResultScores, setPendingResultScores] = useState({ t1s1: '', t2s1: '', t1s2: '', t2s2: '', t1s3: '', t2s3: '' })
  const [pendingSubmitting, setPendingSubmitting] = useState(false)

  // Fetch pending results
  useEffect(() => {
    if (!userId) return
    let active = true
    ;(async () => {
      setPendingLoading(true)
      try {
        const { fetchPendingResultGames } = await import('./lib/openGames')
        const data = await fetchPendingResultGames(userId, player?.id)
        console.log('[Home] Fetched pending results:', data.length, 'games for userId:', userId, 'playerAccountId:', player?.id)
        if (active) setPendingResultGames(data)
      } catch (err) {
        console.error('[Home] Error fetching pending results:', err)
      }
      if (active) setPendingLoading(false)
    })()
    return () => { active = false }
  }, [userId, player?.id])

  const refreshPendingResults = async () => {
    if (!userId) return
    try {
      const { fetchPendingResultGames } = await import('./lib/openGames')
      const data = await fetchPendingResultGames(userId, player?.id)
      setPendingResultGames(data)
    } catch {}
  }

  const handlePlayerClick = async (playerName: string) => {
    const { findPlayerUserIdByName } = await import('./lib/classes')
    const userId = await findPlayerUserIdByName(playerName)
    if (userId) {
      onOpenPlayerProfile(userId)
    }
  }

  const d = dashboardData
  const name = d?.playerName || player?.name?.split(' ')[0] || t.common.player
  const wins = d?.stats.wins ?? player?.wins ?? 0
  const points = d?.leagueStandings?.[0]?.points ?? player?.points ?? 0
  const upcomingMatches = d?.upcomingMatches ?? []
  const upcomingTournaments = d?.upcomingTournaments ?? []

  const viewTournament = async (tournamentId: string, tournamentName: string) => {
    const { fetchTournamentStandingsAndMatches } = await import('./lib/playerDashboardData')
    const { supabase } = await import('./lib/supabase')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    const { standings, myMatches, tournamentName: tn } = await fetchTournamentStandingsAndMatches(
      tournamentId,
      session.user.id
    )
    setViewingTournament({ id: tournamentId, name: tournamentName })
    setTournamentDetail({ standings, myMatches, name: tn || tournamentName })
    setDetailTab('standings')
  }

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
      {/* Quick Actions */}
      <div className="grid grid-cols-5 gap-3">
        <ActionButton icon={Calendar} label={t.home.book} color="lime" onClick={onOpenBooking} />
        <ActionButton icon={Building2} label={t.home.favoriteClub} color="blue" onClick={onOpenClub} />
        <ActionButton icon={Trophy} label={t.home.compete} color="amber" onClick={onOpenCompete} />
        <ActionButton icon={Gamepad2} label={t.home.findGame} color="purple" emoji="🎾" onClick={onOpenFindGame} />
        <ActionButton icon={GraduationCap} label={t.home.learn} color="emerald" onClick={onOpenLearn} />
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
        const colors = player?.player_category ? categoryColors(player.player_category) : null
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
              {player?.player_category && colors && hasGradient && (
                <div className="px-4 py-2 rounded-lg shadow-sm self-start border-2 bg-white" style={{ borderColor: colors.hex }}>
                  <span className="text-sm font-bold" style={{ color: colors.hex }}>
                    {player.player_category}
                  </span>
                </div>
              )}
            </div>
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

      {/* Pontos Reward + Medalhas */}
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
                onViewStandings={() => viewTournament(tournament.id, tournament.name)}
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

      {/* Resultados Pendentes – jogos que precisam de resultado ou confirmação */}
      {(pendingResultGames.length > 0 || pendingLoading) && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>⏳</span> Resultados Pendentes
            </h2>
            <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {pendingResultGames.length}
            </span>
          </div>
          <div className="space-y-3">
            {pendingResultGames.slice(0, 5).map(game => {
              const confirmedPlayers = game.players.filter(p => p.status === 'confirmed')
              const team1 = confirmedPlayers.filter(p => (p.position || 0) <= 2)
              const team2 = confirmedPlayers.filter(p => (p.position || 0) > 2)
              const resultStatus = (game as any)._resultStatus as string | null
              const isPending = resultStatus === 'pending'
              const myPlayer = confirmedPlayers.find(p => p.user_id === userId || (player?.id && p.player_account_id === player.id))
              const myTeam = myPlayer ? ((myPlayer.position || 0) <= 2 ? 1 : 2) : 0

              return (
                <div key={game.id} className="border border-amber-200 rounded-2xl overflow-hidden bg-amber-50/50 shadow-sm">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-gray-900">
                        {new Date(game.scheduled_at).toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit' })} às {new Date(game.scheduled_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {isPending ? (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">⏳ Aguarda confirmação</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Sem resultado</span>
                      )}
                    </div>
                    
                    {/* Teams compact display */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1 text-center">
                        <div className="flex justify-center gap-1.5">
                          {team1.map(p => (
                            <div key={p.id} className="flex flex-col items-center">
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                                {p.avatar_url ? (
                                  <img src={p.avatar_url} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-xs font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                                )}
                              </div>
                              <span className="text-[9px] text-gray-600 mt-0.5 truncate max-w-[50px]">{(p.name || '').split(' ')[0]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <span className="text-gray-300 text-sm font-bold">VS</span>
                      <div className="flex-1 text-center">
                        <div className="flex justify-center gap-1.5">
                          {team2.map(p => (
                            <div key={p.id} className="flex flex-col items-center">
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                                {p.avatar_url ? (
                                  <img src={p.avatar_url} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-xs font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                                )}
                              </div>
                              <span className="text-[9px] text-gray-600 mt-0.5 truncate max-w-[50px]">{(p.name || '').split(' ')[0]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Club info */}
                    <div className="flex items-center gap-2 mb-3">
                      {game.club_logo_url ? (
                        <img src={game.club_logo_url} alt="" className="w-5 h-5 rounded-lg object-cover" />
                      ) : (
                        <div className="w-5 h-5 rounded-lg bg-gray-200 flex items-center justify-center">
                          <Building2 className="w-3 h-3 text-gray-400" />
                        </div>
                      )}
                      <span className="text-xs text-gray-600">{game.club_name}</span>
                    </div>

                    {/* Actions */}
                    {!isPending ? (
                      <button
                        onClick={() => {
                          setPendingResultModal({ game })
                          setPendingResultScores({ t1s1: '', t2s1: '', t1s2: '', t2s2: '', t1s3: '', t2s3: '' })
                        }}
                        className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
                      >
                        📊 Introduzir resultado
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          const { fetchGameResult } = await import('./lib/openGames')
                          const res = await fetchGameResult(game.id)
                          if (res) {
                            setPendingConfirmModal({ game, result: res })
                          } else {
                            alert('Erro ao carregar resultado')
                          }
                        }}
                        className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                          myTeam && myTeam !== ((game as any)._submittedByTeam || 0)
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {myTeam && myTeam !== ((game as any)._submittedByTeam || 0)
                          ? '✓ Confirmar resultado'
                          : '👁️ Ver resultado'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal: Introduzir Resultado (Homepage) */}
      {pendingResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPendingResultModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-gray-900">📊 Introduzir resultado</h3>
              <button onClick={() => setPendingResultModal(null)} className="p-1">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {(() => {
                const cp = pendingResultModal.game.players.filter((p: any) => p.status === 'confirmed')
                const t1 = cp.filter((p: any) => (p.position || 0) <= 2)
                const t2 = cp.filter((p: any) => (p.position || 0) > 2)
                return (
                  <div className="flex items-center gap-4">
                    <div className="flex-1 text-center">
                      <p className="text-xs font-bold text-blue-600 mb-1">Equipa 1</p>
                      {t1.map((p: any) => <p key={p.id} className="text-xs text-gray-700">{(p.name || '').split(' ')[0]}</p>)}
                    </div>
                    <span className="text-gray-300 font-bold">VS</span>
                    <div className="flex-1 text-center">
                      <p className="text-xs font-bold text-red-600 mb-1">Equipa 2</p>
                      {t2.map((p: any) => <p key={p.id} className="text-xs text-gray-700">{(p.name || '').split(' ')[0]}</p>)}
                    </div>
                  </div>
                )
              })()}
              <div className="space-y-3">
                {['Set 1', 'Set 2', 'Set 3'].map((label, idx) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className={`text-sm font-medium w-12 ${idx === 2 ? 'text-gray-400' : 'text-gray-700'}`}>{label}</span>
                    <input type="number" min="0" max="7" placeholder="E1"
                      value={idx === 0 ? pendingResultScores.t1s1 : idx === 1 ? pendingResultScores.t1s2 : pendingResultScores.t1s3}
                      onChange={e => {
                        const key = idx === 0 ? 't1s1' : idx === 1 ? 't1s2' : 't1s3'
                        setPendingResultScores(prev => ({ ...prev, [key]: e.target.value }))
                      }}
                      className="flex-1 text-center py-2 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-300">-</span>
                    <input type="number" min="0" max="7" placeholder="E2"
                      value={idx === 0 ? pendingResultScores.t2s1 : idx === 1 ? pendingResultScores.t2s2 : pendingResultScores.t2s3}
                      onChange={e => {
                        const key = idx === 0 ? 't2s1' : idx === 1 ? 't2s2' : 't2s3'
                        setPendingResultScores(prev => ({ ...prev, [key]: e.target.value }))
                      }}
                      className="flex-1 text-center py-2 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 text-center">O 3° set é opcional</p>
              <button
                disabled={pendingSubmitting || !pendingResultScores.t1s1 || !pendingResultScores.t2s1 || !pendingResultScores.t1s2 || !pendingResultScores.t2s2}
                onClick={async () => {
                  setPendingSubmitting(true)
                  const { submitGameResult } = await import('./lib/openGames')
                  const res = await submitGameResult({
                    gameId: pendingResultModal.game.id,
                    t1Set1: parseInt(pendingResultScores.t1s1) || 0,
                    t2Set1: parseInt(pendingResultScores.t2s1) || 0,
                    t1Set2: parseInt(pendingResultScores.t1s2) || 0,
                    t2Set2: parseInt(pendingResultScores.t2s2) || 0,
                    t1Set3: parseInt(pendingResultScores.t1s3) || 0,
                    t2Set3: parseInt(pendingResultScores.t2s3) || 0,
                  })
                  if (res.success) {
                    alert('Resultado submetido! A equipa adversária precisa confirmar.')
                    setPendingResultModal(null)
                    refreshPendingResults()
                    onRefresh()
                  } else {
                    alert(res.error || 'Erro ao submeter resultado')
                  }
                  setPendingSubmitting(false)
                }}
                className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {pendingSubmitting ? 'A submeter...' : '✓ Submeter resultado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar/Disputar Resultado (Homepage) */}
      {pendingConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPendingConfirmModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-gray-900">📊 Resultado submetido</h3>
              <button onClick={() => setPendingConfirmModal(null)} className="p-1">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {(() => {
                const cp = pendingConfirmModal.game.players.filter((p: any) => p.status === 'confirmed')
                const t1 = cp.filter((p: any) => (p.position || 0) <= 2)
                const t2 = cp.filter((p: any) => (p.position || 0) > 2)
                const r = pendingConfirmModal.result
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
                        {t1.map((p: any) => <p key={p.id} className="text-xs text-gray-700">{(p.name || '').split(' ')[0]}</p>)}
                      </div>
                      <span className="text-gray-300 font-bold">VS</span>
                      <div className={`flex-1 text-center p-3 rounded-xl ${!team1Won ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                        <p className="text-xs font-bold text-red-600 mb-1">Equipa 2 {!team1Won ? '🏆' : ''}</p>
                        {t2.map((p: any) => <p key={p.id} className="text-xs text-gray-700">{(p.name || '').split(' ')[0]}</p>)}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div><p className="text-[10px] text-gray-500 mb-1">Set 1</p><p className="text-lg font-bold">{r.team1_score_set1} - {r.team2_score_set1}</p></div>
                        <div><p className="text-[10px] text-gray-500 mb-1">Set 2</p><p className="text-lg font-bold">{r.team1_score_set2} - {r.team2_score_set2}</p></div>
                        {(r.team1_score_set3 > 0 || r.team2_score_set3 > 0) && (
                          <div><p className="text-[10px] text-gray-500 mb-1">Set 3</p><p className="text-lg font-bold">{r.team1_score_set3} - {r.team2_score_set3}</p></div>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 text-center mt-2">Submetido pela Equipa {r.submitted_by_team}</p>
                    </div>
                  </>
                )
              })()}
              {(() => {
                const myPlayer = pendingConfirmModal.game.players.find((p: any) => p.user_id === userId || (player?.id && p.player_account_id === player.id))
                const myTeam = myPlayer ? ((myPlayer.position || 0) <= 2 ? 1 : 2) : 0
                const canConfirm = myTeam !== 0 && myTeam !== pendingConfirmModal.result.submitted_by_team
                if (!canConfirm) {
                  return (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                      <p className="text-sm text-amber-700 font-medium">⏳ A aguardar confirmação da equipa adversária</p>
                    </div>
                  )
                }
                return (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 text-center">Confirmas este resultado?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          setPendingSubmitting(true)
                          const { confirmGameResult } = await import('./lib/openGames')
                          const res = await confirmGameResult(pendingConfirmModal.game.id)
                          if (res.success) {
                            alert('Resultado confirmado! Os níveis serão atualizados.')
                            setPendingConfirmModal(null)
                            refreshPendingResults()
                            onRefresh()
                          } else {
                            alert(res.error || 'Erro ao confirmar')
                          }
                          setPendingSubmitting(false)
                        }}
                        disabled={pendingSubmitting}
                        className="flex-1 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
                      >
                        ✓ Confirmar
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm('Queres disputar este resultado?')) return
                          setPendingSubmitting(true)
                          const { disputeGameResult } = await import('./lib/openGames')
                          const res = await disputeGameResult(pendingConfirmModal.game.id)
                          if (res.success) {
                            alert('Resultado disputado. Um novo resultado pode ser submetido.')
                            setPendingConfirmModal(null)
                            refreshPendingResults()
                          } else {
                            alert(res.error || 'Erro ao disputar')
                          }
                          setPendingSubmitting(false)
                        }}
                        disabled={pendingSubmitting}
                        className="flex-1 py-3 bg-red-100 text-red-700 rounded-xl text-sm font-semibold hover:bg-red-200 disabled:opacity-50"
                      >
                        ✗ Disputar
                      </button>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

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

      {/* Modal Torneio – integração Tour */}
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

// ---------- Comunidade ----------
function CommunityScreen({ userId, playerAccountId, playerAvatar, playerName, onOpenPlayerProfile }: { userId: string; playerAccountId: string; playerAvatar?: string | null; playerName?: string; onOpenPlayerProfile: (userId: string) => void }) {
  const { t } = useI18n()
  // Feed state
  const [suggestions, setSuggestions] = useState<CommunityPlayer[]>([])
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set())

  const handlePlayerClick = async (playerNameClicked: string) => {
    const { findPlayerUserIdByName } = await import('./lib/classes')
    const foundUserId = await findPlayerUserIdByName(playerNameClicked)
    if (foundUserId) {
      onOpenPlayerProfile(foundUserId)
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

  // Load feed data
  useEffect(() => {
    loadFeed()
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
      // Also keep posts separate for the new-post refresh
      setPosts(unifiedData.filter(i => i.type === 'post').map(i => i.data as CommunityPost))
      setFollowingSet(new Set(ids))
    } catch (err) {
      console.error('[Community] Load feed error:', err)
    }
    setFeedLoading(false)
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
                  const lvl = categoryToLevel(p.player_category) ?? p.level
                  const colors = categoryColors(p.player_category)
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
                          {p.player_category && <span className="text-xs text-gray-500 font-medium">{p.player_category}</span>}
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
                      const lvl = categoryToLevel(player.player_category) ?? player.level
                      const colors = categoryColors(player.player_category)
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
                        {player.player_category && (
                          <p className="mt-1 text-xs font-semibold text-gray-500">{player.player_category}</p>
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
  userId,
  playerAccountId,
  player,
  onBack,
}: {
  dashboardData: PlayerDashboardData | null
  favoriteClubId: string | null
  userId: string | null
  playerAccountId: string | null
  player: PlayerAccount | null
  onBack: () => void
}) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'upcoming' | 'leagues' | 'history'>('upcoming')
  const [upcomingFromTour, setUpcomingFromTour] = useState<UpcomingTournamentFromTour[]>([])
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
  const [pastTournamentDetails, setPastTournamentDetails] = useState<Record<string, { standings: any[]; myMatches: any[]; playerPosition?: number; tournamentName: string }>>({})
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

  const d = dashboardData
  const name = d?.playerName ?? ''

  // DADOS EFETIVOS: dashboardData (que é effectiveDashboard do App) já inclui edge function data
  // Merge: client-side pastTournamentDetails + dashboardData.pastTournamentDetails (edge function)
  const effectivePastDetails = useMemo(() => {
    return { ...pastTournamentDetails, ...(d?.pastTournamentDetails || {}) }
  }, [pastTournamentDetails, d?.pastTournamentDetails])

  // Use ligas do dashboardData se existirem, senão usa as buscadas diretamente
  const leagueStandings = (d?.leagueStandings?.length ?? 0) > 0 ? d!.leagueStandings : leaguesDirect
  


  useEffect(() => {
    let active = true
    const clubId = favoriteClubId || localStorage.getItem('padel_one_player_favorite_club_id')
    fetchUpcomingTournaments(clubId || undefined).then((list) => {
      if (active) { setUpcomingFromTour(list); setLoadingUpcoming(false) }
    }).catch(() => {
      if (active) setLoadingUpcoming(false)
    })
    return () => { active = false }
  }, [favoriteClubId])

  // Determinar género do jogador baseado no player_category
  const getPlayerGender = (): 'M' | 'F' | null => {
    if (!player?.player_category) return null
    const category = player.player_category.toUpperCase()
    if (category.includes('MASC') || category.includes('M') || category.includes('MASCULINO')) return 'M'
    if (category.includes('FEM') || category.includes('F') || category.includes('FEMININO')) return 'F'
    return null
  }

  // Buscar torneios disponíveis filtrados por género
  useEffect(() => {
    if (activeTab !== 'upcoming') return
    const playerGender = getPlayerGender()
    if (!playerGender) {
      setAvailableTournaments([])
      setLoadingAvailable(false)
      return
    }

    let active = true
    const clubId = favoriteClubId || localStorage.getItem('padel_one_player_favorite_club_id')
    setLoadingAvailable(true)

    ;(async () => {
      try {
        const list = await fetchUpcomingTournaments(clubId || undefined)
        if (!active) return

        // Filtrar apenas ativos e onde jogador NÃO está inscrito
        const enrolledIds = new Set((d?.upcomingTournaments ?? []).map((t) => t.id))
        const activeNotEnrolled = list.filter((t) => t.status === 'active' && !enrolledIds.has(t.id))

        // Filtrar por género: buscar categorias de cada torneio e verificar se tem o género do jogador
        const { supabase } = await import('./lib/supabase')
        const filtered: UpcomingTournamentFromTour[] = []

        for (const tournament of activeNotEnrolled) {
          const { data: categories } = await supabase
            .from('tournament_categories')
            .select('name')
            .eq('tournament_id', tournament.id)

          if (categories && categories.length > 0) {
            // Verificar se alguma categoria contém referência a género
            const hasAnyGenderRef = categories.some(cat => {
              const catName = cat.name.toUpperCase()
              return catName.includes('MASC') || catName.includes('MASCULINO') ||
                     catName.includes('FEM') || catName.includes('FEMININO')
            })

            if (!hasAnyGenderRef) {
              // Nenhuma categoria tem referência a género (ex: +35, +40) → incluir para todos
              filtered.push(tournament)
            } else {
              // Verificar se alguma categoria corresponde ao género do jogador
              const hasMatchingGender = categories.some(cat => {
                const catName = cat.name.toUpperCase()
                if (playerGender === 'M') {
                  return catName.includes('MASC') || catName.includes('MASCULINO')
                } else {
                  return catName.includes('FEM') || catName.includes('FEMININO')
                }
              })
              if (hasMatchingGender) {
                filtered.push(tournament)
              }
            }
          } else {
            // Se não tem categorias, incluir (torneio geral)
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
  }, [activeTab, favoriteClubId, d?.upcomingTournaments, player?.player_category])

  // Buscar ligas quando abre o tab Ligas (via Edge Function - bypass RLS)
  useEffect(() => {
    if (activeTab !== 'leagues') return
    if ((d?.leagueStandings?.length ?? 0) > 0 || leaguesFetched) return
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
  }, [activeTab, d?.leagueStandings?.length, leaguesFetched, playerAccountId])

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

  // Carregar detalhes dos torneios passados via client-side quando abre o tab history
  // NOTA: O render usa effectivePastDetails que SEMPRE prioriza edge function data,
  // portanto mesmo que este fetch corra, os nomes da edge function nunca são sobrescritos
  useEffect(() => {
    if (activeTab !== 'history') return
    if (!d?.pastTournaments?.length) return
    if (!userId) return
    const hasDetails = Object.keys(pastTournamentDetails).length > 0
    if (historyFetched && hasDetails) return
    let active = true
    setPastTournamentLoading(true)
    setHistoryFetched(false)
    ;(async () => {
      try {
        const { fetchTournamentStandingsAndMatches } = await import('./lib/playerDashboardData')
        const results: Record<string, { standings: any[]; myMatches: any[]; playerPosition?: number; tournamentName: string }> = {}
        for (const t of (d.pastTournaments ?? [])) {
          if (!active) break
          try {
            const data = await fetchTournamentStandingsAndMatches(t.id, userId!)
            results[t.id] = { standings: data.standings, myMatches: data.myMatches, playerPosition: data.playerPosition, tournamentName: data.tournamentName }
            if (active) setPastTournamentDetails({ ...results })
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
  }, [activeTab, d?.pastTournaments?.length, historyFetched, userId])

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

  const viewTournament = async (tournamentId: string, tournamentName: string) => {
    // Usar effectivePastDetails (edge function tem prioridade sobre client-side)
    const cached = effectivePastDetails[tournamentId]
    if (cached) {
      setViewingTournament({ id: tournamentId, name: tournamentName })
      setTournamentDetail({ standings: cached.standings, myMatches: cached.myMatches, name: cached.tournamentName })
      setDetailTab('standings')
      return
    }
    // Fallback: fetch client-side (pode ter limitações RLS)
    if (!userId) return
    const { fetchTournamentStandingsAndMatches } = await import('./lib/playerDashboardData')
    const { standings, myMatches, tournamentName: tn } = await fetchTournamentStandingsAndMatches(tournamentId, userId)
    setViewingTournament({ id: tournamentId, name: tournamentName })
    setTournamentDetail({ standings, myMatches, name: tn || tournamentName })
    setDetailTab('standings')
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
    try {
      const detail = await fetchTournamentFullDetail(tournamentId)
      setSelectedTournamentDetail(detail)
    } catch (err) {
      console.error('[CompeteScreen] Error loading tournament detail:', err)
    }
    setSelectedTournamentLoading(false)
  }

  const formatFormatName = (format: string) => {
    const formatMap: Record<string, string> = {
      'round_robin': t.common.tournamentFormatRoundRobin,
      'single_elimination': t.common.tournamentFormatSingleElimination,
      'groups_knockout': t.common.tournamentFormatGroupsKnockout,
      'individual_groups_knockout': t.common.tournamentFormatIndividualGroupsKnockout,
      'super_teams': 'Super Equipas', // TODO: traduzir
    }
    return formatMap[format] || format
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
              <div className="relative rounded-2xl overflow-hidden">
                <img src={td.image_url} alt={td.name} className="w-full h-48 object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h1 className="text-xl font-bold text-white">{td.name}</h1>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-2xl p-6">
                <h1 className="text-xl font-bold text-white">{td.name}</h1>
              </div>
            )}

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${td.status === 'active' ? 'bg-green-100 text-green-700' : td.status === 'completed' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-700'}`}>
                {td.status === 'active' ? '🟢 Aberto' : td.status === 'completed' ? '✅ Concluído' : td.status === 'draft' ? '📝 Rascunho' : td.status}
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
                  <p className="text-xs text-gray-500">Clube</p>
                  <p className="text-sm font-semibold text-gray-900">{td.club_name}</p>
                </div>
              </div>
            )}

            {/* Descrição */}
            {td.description && (
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Descrição</h3>
                <div className="text-sm text-gray-600 [&_p]:my-1 [&_ul]:pl-4 [&_li]:list-disc" dangerouslySetInnerHTML={{ __html: td.description }} />
              </div>
            )}

            {/* Botão de inscrição */}
            {!isEnrolled && td.status === 'active' && (
              <a
                href={getTournamentRegistrationUrl(td.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors"
              >
                Inscrever-me
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            {/* Inscritos por categoria */}
            <div className="card p-4">
              <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-red-600" />
                Inscritos ({td.total_enrolled})
              </h3>
              {td.enrolled.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Ainda sem inscritos.</p>
              ) : (
                <div className="space-y-5">
                  {td.enrolled.map((cat) => (
                    <div key={cat.category_id}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        <h4 className="text-sm font-semibold text-gray-700">{cat.category_name}</h4>
                        <span className="text-xs text-gray-400 ml-auto">{cat.items.length} inscrito{cat.items.length !== 1 ? 's' : ''}</span>
                      </div>
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card p-8 text-center text-gray-500">Torneio não encontrado.</div>
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
            const TournamentCard = ({ t, isEnrolled }: { t: UpcomingTournamentFromTour; isEnrolled: boolean }) => (
              <div
                key={t.id}
                className="card overflow-hidden p-0 flex cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => openTournamentDetail(t.id)}
              >
                <div className="w-24 sm:w-32 flex-shrink-0">
                  {t.image_url ? (
                    <img src={t.image_url} alt={t.name} className="w-full h-full min-h-[140px] object-cover rounded-l-xl" />
                  ) : (
                    <div className="w-full h-full min-h-[140px] bg-gradient-to-br from-red-100 to-amber-100 flex items-center justify-center rounded-l-xl">
                      <Trophy className="w-12 h-12 text-red-400/70" />
                    </div>
                  )}
                </div>
                <div className="flex-1 p-4 sm:p-5 min-w-0 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-gray-900 text-base sm:text-lg line-clamp-2">{t.name}</h3>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isEnrolled && (
                        <span className="px-2 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700">Inscrito</span>
                      )}
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${t.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {t.status === 'active' ? 'Aberto' : t.status}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    {formatDate(t.start_date)}
                  </p>
                  {t.description && (
                    <div className="text-sm text-gray-600 mt-2 line-clamp-2 flex-1 [&_p]:my-0 [&_p]:last:mb-0" dangerouslySetInnerHTML={{ __html: t.description }} />
                  )}
                  <div className="mt-3 text-sm font-medium text-red-600 flex items-center gap-1">
                    Ver detalhes <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            )
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
                  const playerGender = getPlayerGender()
                  if (!playerGender) return null

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
                            <p className="text-gray-700 font-medium">Nenhum torneio disponível para o teu género</p>
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

      {activeTab === 'leagues' && (
        <div className="space-y-4">
          {leaguesLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
            </div>
          ) : leagueStandings.length > 0 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Ligas onde participas</h2>
              {leagueStandings.map((s, idx) => (
                <div key={idx} className="card p-6 flex flex-col items-center justify-center text-center">
                  <h3 className="text-base font-bold text-gray-600">{s.league_name}</h3>
                  <p className="text-2xl mt-3 flex items-center justify-center gap-2">
                    <span className="text-3xl">🏆</span>
                    <span className="font-bold text-red-600 text-3xl">{s.position}º</span>
                    <span className="text-gray-600 text-xl"> de {s.total_participants} · </span>
                    <span className="font-semibold text-gray-900 text-xl">{s.points} pts</span>
                  </p>
                  <button onClick={() => viewLeague(s.league_id, s.league_name)} className="mt-4 text-red-600 text-base font-semibold flex items-center gap-1">
                    Ver classificação <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <Trophy className="w-16 h-16 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">Ainda não participas em nenhuma liga.</p>
              <p className="text-sm text-gray-400 mt-1">{t.common.enrollInTournaments}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          {pastTournamentLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : d?.pastTournaments && d.pastTournaments.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Torneios concluídos</p>
              {d.pastTournaments.filter((t) => {
                // Filtrar apenas concluídos, não cancelados
                const isCompleted = t.status === 'completed' || t.status === 'finished'
                const isCanceled = t.status === 'canceled' || t.status === 'cancelled'
                return isCompleted && !isCanceled
              }).map((t) => {
                const details = effectivePastDetails[t.id]
                const wins = details?.myMatches?.filter((m) => m.is_winner).length ?? 0
                const losses = details?.myMatches?.filter((m) => m.is_winner === false).length ?? 0
                return (
                  <div key={t.id} className="card overflow-hidden p-0">
                    <div className="p-4">
                      {/* Cabeçalho do torneio */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{t.name}</h3>
                          <p className="text-sm text-gray-500 mt-0.5">{formatDate(t.start_date)}</p>
                          {details && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {details.playerPosition != null && (
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
                        {!details && !pastTournamentLoading && (
                          <span className="text-xs text-gray-400 animate-pulse flex-shrink-0">{t.common.loading}</span>
                        )}
                      </div>

                      {/* Todos os resultados do jogador */}
                      {details?.myMatches && details.myMatches.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <p className="text-xs font-medium text-gray-500 mb-2">Os teus resultados</p>
                          <div className="space-y-2">
                            {details.myMatches.map((m) => {
                              const setScores = [m.set1, m.set2, m.set3].filter(Boolean)
                              // Mostrar sempre os jogos de cada set, nunca o resultado 1-0/0-1
                              const scoreDisplay = setScores.length > 0 ? setScores.join(' ') : '-'
                              // Determinar qual equipa ganhou baseado no score
                              const team1Won = m.team1_score !== undefined && m.team2_score !== undefined && m.team1_score > m.team2_score
                              return (
                              <div key={m.id} className="flex justify-between items-start text-sm py-2 px-3 bg-gray-50 rounded-lg">
                                <div className="flex-1 mr-2 min-w-0">
                                  {/* Equipa 1 */}
                                  <div className={`text-gray-700 ${team1Won ? 'font-semibold' : ''}`}>
                                    {m.team1_name}
                                  </div>
                                  {/* Equipa 2 */}
                                  <div className={`text-gray-700 mt-1 ${!team1Won && m.team1_score !== undefined && m.team2_score !== undefined ? 'font-semibold' : ''}`}>
                                    {m.team2_name}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                  <span className="font-semibold text-gray-900">
                                    {scoreDisplay}
                                  </span>
                                  {m.is_winner !== undefined && (
                                    <span className={`text-xs font-medium ${m.is_winner ? 'text-green-600' : 'text-red-600'}`}>
                                      {m.is_winner ? 'V' : 'D'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )})}
                          </div>
                        </div>
                      )}

                      {/* Classificação completa */}
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
                              {details.standings.map((row, i) => {
                                const diff = (row.points_for ?? 0) - (row.points_against ?? 0)
                                const hasPlayers = row.player1_name || row.player2_name
                                return (
                                  <tr key={row.id} className={`border-b border-gray-50 ${details.playerPosition === i + 1 ? 'bg-red-50 font-semibold' : ''}`}>
                                    <td className="py-1.5 px-2">{i + 1}</td>
                                    <td className="py-1.5 px-2 min-w-0">
                                      <div className="font-medium break-words">{row.name}</div>
                                      {row.player1_name && (
                                        <div className="text-xs text-gray-500 break-words">{row.player1_name}</div>
                                      )}
                                      {row.player2_name && (
                                        <div className="text-xs text-gray-500 break-words">{row.player2_name}</div>
                                      )}
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
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <Trophy className="w-16 h-16 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">Ainda não tens torneios concluídos.</p>
              <p className="text-sm text-gray-400 mt-1">Os torneios em que participares aparecerão aqui.</p>
            </div>
          )}

          {/* Resultados de Jogos Abertos - Cards individuais no histórico */}
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
                
                // Get avatars (with fallback to player names initials)
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
                      {/* Header: Data, Hora e Clube */}
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
                      
                      {/* Teams with avatars */}
                      <div className="space-y-3">
                        {/* Team 1 */}
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
                        
                        {/* Team 2 */}
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
                      
                      {/* Sets scores */}
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
      )}

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
}: {
  player: PlayerAccount | null
  userId: string | null
  onBack: () => void
  onOpenPlayerProfile: (userId: string) => void
  onRefresh?: () => Promise<void>
}) {
  const { t } = useI18n()
  const [activeSection, setActiveSection] = useState<'existing' | 'request' | 'create' | 'results'>('existing')
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
  const [createGameType, setCreateGameType] = useState<'competitive' | 'friendly'>('friendly')
  const [createGender, setCreateGender] = useState<'all' | 'male' | 'female' | 'mixed'>('all')
  const [createDuration, setCreateDuration] = useState<number>(90)
  const [creating, setCreating] = useState(false)

  // Add player modal
  const [addPlayerModal, setAddPlayerModal] = useState<{ gameId: string } | null>(null)
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
    const levelColors = categoryColors(player?.player_category)
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
                  const pColors = p.player_category ? categoryColors(p.player_category) : null
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
                            setAddPlayerModal({ gameId: game.id })
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
                  const pColors = p.player_category ? categoryColors(p.player_category) : null
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
                            setAddPlayerModal({ gameId: game.id })
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
                        const ppColors = pp.player_category ? categoryColors(pp.player_category) : null
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
                                {pp.player_category && <span className="text-[9px] text-gray-500">{pp.player_category}</span>}
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
        <h1 className="text-2xl font-bold text-gray-900">{t.games.title}</h1>
      </div>

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
            if (pastGames.length === 0 && userId) {
              setLoadingPastGames(true)
              const { fetchGamesAwaitingResult } = await import('./lib/openGames')
              const data = await fetchGamesAwaitingResult(userId, player?.id)
              setPastGames(data)
              setLoadingPastGames(false)
            }
          }}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
            activeSection === 'results' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          📊 {t.common.resultsTab}
        </button>
      </div>

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
                                  {slot.courts[0].court_type === 'indoor' ? '🏠 Indoor' : slot.courts[0].court_type === 'outdoor' ? '☀️ Outdoor' : '🏗️ Coberto'}
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
            <p className="text-xs text-gray-500">Introduza resultados de jogos terminados ou confirme resultados submetidos</p>
          </div>
          
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
                const hasResult = resultStatus === 'pending' || resultStatus === 'confirmed'
                const isPending = resultStatus === 'pending'
                const isConfirmed = resultStatus === 'confirmed'
                
                // Determine which team I'm on
                const myPlayer = confirmedPlayers.find(p => p.user_id === userId || (player?.id && p.player_account_id === player.id))
                const myTeam = myPlayer ? ((myPlayer.position || 0) <= 2 ? 1 : 2) : 0

                return (
                  <div key={game.id} className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-bold text-gray-900">
                          {new Date(game.scheduled_at).toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit' })} às {new Date(game.scheduled_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {isConfirmed && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">✓ {t.games.confirmed}</span>
                        )}
                        {isPending && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">⏳ Aguarda confirmação</span>
                        )}
                        {!hasResult && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Sem resultado</span>
                        )}
                      </div>
                      
                      {/* Teams display */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex-1 text-center">
                          <p className="text-xs font-semibold text-gray-500 mb-1">Equipa 1</p>
                          <div className="flex justify-center gap-1.5">
                            {team1.map(p => (
                              <div key={p.id} className="flex flex-col items-center">
                                <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                                  {p.avatar_url ? (
                                    <img src={p.avatar_url} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-sm font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                                  )}
                                </div>
                                <span className="text-[9px] text-gray-600 mt-0.5 truncate max-w-[50px]">{(p.name || '').split(' ')[0]}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <span className="text-gray-300 text-lg font-bold">VS</span>
                        <div className="flex-1 text-center">
                          <p className="text-xs font-semibold text-gray-500 mb-1">Equipa 2</p>
                          <div className="flex justify-center gap-1.5">
                            {team2.map(p => (
                              <div key={p.id} className="flex flex-col items-center">
                                <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                                  {p.avatar_url ? (
                                    <img src={p.avatar_url} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-sm font-bold text-gray-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                                  )}
                                </div>
                                <span className="text-[9px] text-gray-600 mt-0.5 truncate max-w-[50px]">{(p.name || '').split(' ')[0]}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      
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
                      {isPending && (
                        <div className="space-y-2">
                          {/* Show who submitted and what the score is */}
                          <button
                            onClick={async () => {
                              const { fetchGameResult } = await import('./lib/openGames')
                              const res = await fetchGameResult(game.id)
                              if (res) {
                                setConfirmModal({ game, result: res })
                              } else {
                                alert('Erro ao carregar resultado')
                              }
                            }}
                            className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                              myTeam && myTeam !== ((game as any)._submittedByTeam || 0)
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            👁️ Ver resultado e confirmar/disputar
                          </button>
                        </div>
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
              {/* Teams */}
              {(() => {
                const cp = resultModal.game.players.filter(p => p.status === 'confirmed')
                const t1 = cp.filter(p => (p.position || 0) <= 2)
                const t2 = cp.filter(p => (p.position || 0) > 2)
                return (
                  <div className="flex items-center gap-4">
                    <div className="flex-1 text-center">
                      <p className="text-xs font-bold text-blue-600 mb-1">Equipa 1</p>
                      {t1.map(p => <p key={p.id} className="text-xs text-gray-700">{(p.name || '').split(' ')[0]}</p>)}
                    </div>
                    <span className="text-gray-300 font-bold">VS</span>
                    <div className="flex-1 text-center">
                      <p className="text-xs font-bold text-red-600 mb-1">Equipa 2</p>
                      {t2.map(p => <p key={p.id} className="text-xs text-gray-700">{(p.name || '').split(' ')[0]}</p>)}
                    </div>
                  </div>
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
                    alert('Resultado submetido! A equipa adversária precisa confirmar.')
                    setResultModal(null)
                    // Award points for submitting
                    try {
                      const { awardGameRewardPoints: _aw } = await import('./lib/openGames')
                    } catch {}
                    // Refresh past games
                    if (userId) {
                      const { fetchGamesAwaitingResult } = await import('./lib/openGames')
                      const data = await fetchGamesAwaitingResult(userId, player?.id)
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

      {/* === MODAL: Confirmar/Disputar Resultado === */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-gray-900">📊 Resultado submetido</h3>
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
                const canConfirm = myTeam !== 0 && myTeam !== confirmModal.result.submitted_by_team
                
                if (!canConfirm) {
                  return (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                      <p className="text-sm text-amber-700 font-medium">⏳ A aguardar confirmação da equipa adversária</p>
                    </div>
                  )
                }
                
                return (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 text-center">Confirmas este resultado?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          setSubmittingResult(true)
                          const { confirmGameResult } = await import('./lib/openGames')
                          const res = await confirmGameResult(confirmModal.game.id)
                          if (res.success) {
                            alert('Resultado confirmado! Os níveis serão atualizados.')
                            setConfirmModal(null)
                            if (userId) {
                              const { fetchGamesAwaitingResult } = await import('./lib/openGames')
                              const data = await fetchGamesAwaitingResult(userId, player?.id)
                              setPastGames(data)
                            }
                          } else {
                            alert(res.error || 'Erro ao confirmar')
                          }
                          setSubmittingResult(false)
                        }}
                        disabled={submittingResult}
                        className="flex-1 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        ✓ Confirmar
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm('Queres disputar este resultado? O resultado será apagado e qualquer jogador pode submeter um novo.')) return
                          setSubmittingResult(true)
                          const { disputeGameResult } = await import('./lib/openGames')
                          const res = await disputeGameResult(confirmModal.game.id)
                          if (res.success) {
                            alert('Resultado disputado. Um novo resultado pode ser submetido.')
                            setConfirmModal(null)
                            if (userId) {
                              const { fetchGamesAwaitingResult } = await import('./lib/openGames')
                              const data = await fetchGamesAwaitingResult(userId, player?.id)
                              setPastGames(data)
                            }
                          } else {
                            alert(res.error || 'Erro ao disputar')
                          }
                          setSubmittingResult(false)
                        }}
                        disabled={submittingResult}
                        className="flex-1 py-3 bg-red-100 text-red-700 rounded-xl text-sm font-semibold hover:bg-red-200 transition-colors disabled:opacity-50"
                      >
                        ✗ Disputar
                      </button>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: Criar Jogo === */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
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
                        {createModal.courts[0].court_type === 'indoor' ? '🏠 Indoor' : createModal.courts[0].court_type === 'outdoor' ? '☀️ Outdoor' : '🏗️ Coberto'}
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

              {/* Game Type */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">Tipo de jogo</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCreateGameType('friendly')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      createGameType === 'friendly' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    🤝 Amigável
                  </button>
                  <button
                    onClick={() => setCreateGameType('competitive')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      createGameType === 'competitive' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    🏆 Competitivo
                  </button>
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
              <h3 className="font-bold text-lg text-gray-900">Adicionar jogador</h3>
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
                const prColors = pr.player_category ? categoryColors(pr.player_category) : null
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
                        {pr.player_category && (
                          <span className="text-[10px] text-gray-500 font-medium">{pr.player_category}</span>
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
  onOpenPlayerProfile: (userId: string) => void
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
      const classes = await fetchAvailableClasses()
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
      const classes = await fetchMyClasses(userId)
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
  onOpenPlayerProfile: (userId: string) => void
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
  const [gameType, setGameType] = useState<'competitive' | 'friendly'>('friendly')
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
      // Don't add players now - organizer can add them later
      const { createOpenGame } = await import('./lib/openGames')

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
        isPrivate: true, // Mark as private
        players: [], // No players added at creation - organizer adds them later
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
    const pColors = p?.player_category ? categoryColors(p.player_category) : null
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

          {/* Game Type */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">🎯 {t.common.gameType}</label>
            <div className="flex gap-2">
              <button
                onClick={() => setGameType('friendly')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  gameType === 'friendly' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🤝 Amigável
              </button>
              <button
                onClick={() => setGameType('competitive')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  gameType === 'competitive' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🏆 Competitivo
              </button>
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
                      const rColors = r.player_category ? categoryColors(r.player_category) : null
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
                              {r.player_category && <span className="text-[10px] text-gray-500">{r.player_category}</span>}
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
  initialTab,
}: {
  player: PlayerAccount | null
  dashboardData: PlayerDashboardData | null
  onRefresh: () => Promise<void>
  onBack: () => void
  onOpenPlayerProfile: (userId: string) => void
  initialTab?: 'upcoming' | 'history'
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
    const { findPlayerUserIdByName } = await import('./lib/classes')
    const userId = await findPlayerUserIdByName(playerName)
    if (userId) {
      onOpenPlayerProfile(userId)
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900">{t.games.title}</h1>

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
          <p className="text-gray-500 text-sm mb-4">Cria um jogo ou inscreve-te num torneio para começar</p>
          <button className="px-6 py-3 btn-primary">Criar Jogo</button>
        </div>
      )}
    </div>
  )
}

/** Extrai nomes de jogadores de um match (excluindo o jogador atual). */
function getOtherPlayersFromMatch(match: { player1_name?: string; player2_name?: string; player3_name?: string; player4_name?: string; team1_name?: string; team2_name?: string }, currentName?: string): string[] {
  const names: string[] = []
  const add = (n: string | undefined) => {
    if (n && n.trim() && !isCurrentPlayer(n, currentName)) names.push(n.trim())
  }
  if (match.player1_name || match.player2_name || match.player3_name || match.player4_name) {
    add(match.player1_name)
    add(match.player2_name)
    add(match.player3_name)
    add(match.player4_name)
  } else {
    const [p1, p2] = parseTeamMembers(match.team1_name || '')
    const [p3, p4] = parseTeamMembers(match.team2_name || '')
    ;[p1, p2, p3, p4].forEach((p) => add(p !== '?' ? p : undefined))
  }
  return names
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
  onOpenPlayerProfile: (userId: string) => void
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
            const colors = categoryColors(p.player_category)
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
                      {p.player_category && <span className="text-xs text-gray-500 font-medium">{p.player_category}</span>}
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
  myUserId,
  onBack,
  onOpenFollowsList,
  onOpenPlayerProfile,
}: {
  targetUserId: string
  myUserId: string
  onBack: () => void
  onOpenFollowsList: (userId: string) => void
  onOpenPlayerProfile: (userId: string) => void
}) {
  const { t } = useI18n()
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)
  const [myAvatar, setMyAvatar] = useState<string | null>(null)
  const [myName, setMyName] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getPlayerProfile(targetUserId, myUserId).then((p) => {
      setProfile(p)
      setIsFollowing(p?.isFollowedByMe ?? false)
      setLoading(false)
    })
  }, [targetUserId, myUserId])
  
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
    const { findPlayerUserIdByName } = await import('./lib/classes')
    const foundUserId = await findPlayerUserIdByName(playerName)
    if (foundUserId) {
      onOpenPlayerProfile(foundUserId)
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

  const colors = categoryColors(profile.player_category)
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
                {profile.player_category && hasGradient && (
                  <div className="px-4 py-2 rounded-lg shadow-sm border-2 bg-white" style={{ borderColor: colors.hex }}>
                    <span className="text-sm font-bold" style={{ color: colors.hex }}>{profile.player_category}</span>
                  </div>
                )}
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
        {profile.topPlayers.length > 0 ? (
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth">
            <div className="flex gap-3" style={{ width: 'max-content' }}>
              {profile.topPlayers.map(({ name, count }) => {
                const { firstName } = splitName(name)
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
                  <p className="font-semibold text-gray-900 text-xs leading-tight">{firstName}</p>
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
  onOpenPlayerProfile: (userId: string) => void
}) {
  const { t } = useI18n()
  const d = dashboardData
  const totalMatches = d?.stats?.totalMatches ?? (player?.wins || 0) + (player?.losses || 0)
  const wins = d?.stats?.wins ?? player?.wins ?? 0
  const winRate = d?.stats?.winRate ?? (totalMatches > 0 ? Math.round(((player?.wins || 0) / totalMatches) * 100) : 0)
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
    const { findPlayerUserIdByName } = await import('./lib/classes')
    const foundUserId = await findPlayerUserIdByName(playerName)
    if (foundUserId) {
      onOpenPlayerProfile(foundUserId)
    }
  }

  // Jogadores com quem mais joga (extrair de todos os jogos recentes)
  const allRecentMatches = d?.recentMatches ?? []
  const playerCountMap = new Map<string, number>()
  allRecentMatches.forEach((match) => {
    getOtherPlayersFromMatch(match, player?.name).forEach((name) => {
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
        const colors = player?.player_category ? categoryColors(player.player_category) : null
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
                {player?.player_category && colors && hasGradient && (
                  <div className="px-4 py-2 rounded-lg shadow-sm border-2 bg-white" style={{ borderColor: colors.hex }}>
                    <span className="text-sm font-bold" style={{ color: colors.hex }}>
                      {player.player_category}
                    </span>
                  </div>
                )}
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
                const { firstName } = splitName(name)
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
                  <p className="font-semibold text-gray-900 text-xs leading-tight">{firstName}</p>
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
                <div key={club.id} className="snap-center flex-shrink-0 w-[140px] card overflow-hidden p-0">
                  <div className="h-20 bg-gray-100 flex items-center justify-center">
                    {club.logo_url ? (
                      <img src={club.logo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-10 h-10 text-gray-400" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-gray-900 text-sm truncate" title={club.name}>{club.name}</p>
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
  onSaveFavoriteClub,
  onSaveProfile,
}: {
  player: PlayerAccount | null
  onLogout: () => void
  onSaveFavoriteClub: (clubId: string | null) => Promise<void>
  onSaveProfile: (updates: Partial<PlayerAccount>) => Promise<void>
}) {
  const { t } = useI18n()
  const [clubs, setClubs] = useState<ClubDetail[]>([])
  const [loadingClubs, setLoadingClubs] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const favoriteClubId = player?.favorite_club_id ?? localStorage.getItem('padel_one_player_favorite_club_id')

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

  useEffect(() => {
    fetchAllClubs().then((list) => {
      setClubs(list)
      setLoadingClubs(false)
    }).catch(() => setLoadingClubs(false))
  }, [])

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
    if (!editGameType) missing.push(t.settings.preferredGameType)
    if (!editPreferredTime) missing.push(t.settings.preferredTime)

    if (missing.length > 0) {
      setSaveMsg(`${t.settings.fillRequiredFields} ${missing.join(', ')}`)
      setTimeout(() => setSaveMsg(''), 5000)
      return
    }

    setSaving(true)
    setSaveMsg('')
    try {
      await onSaveProfile({
        name: editName.trim(),
        email: editEmail.trim(),
        gender: editGender as any,
        birth_date: editBirthDate,
        location: editLocation.trim(),
        preferred_hand: editHand as any,
        court_position: editPosition as any,
        bio: editBio.trim() || undefined,
        game_type: editGameType as any,
        preferred_time: editPreferredTime as any,
      })
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
        
        {/* Category Badge apenas */}
        {player?.player_category && (
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-bold">
              {player.player_category}
            </span>
          </div>
        )}
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
              <input
                type="text"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                placeholder={t.settings.locationPlaceholder}
              />
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

            {/* Tipo de Jogo Preferido */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.preferredGameType} <span className="text-red-600">*</span></label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'competitive', label: t.games.competitive },
                  { value: 'friendly', label: t.games.friendly },
                  { value: 'both', label: t.settings.both },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEditGameType(editGameType === opt.value ? '' : opt.value)}
                    className={`py-2 px-2 rounded-lg text-sm font-medium border transition-colors ${
                      editGameType === opt.value
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-red-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
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

      {/* Clube Favorito – lista de clubes Padel One */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-gray-900">{t.settings.favoriteClub}</h3>
          </div>
          <p className="text-sm text-gray-500 mt-1">{t.settings.favoriteClubDesc}</p>
        </div>
        <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
          {loadingClubs ? (
            <div className="p-4 text-center text-gray-500">{t.settings.loadingClubs}</div>
          ) : clubs.length === 0 ? (
            <div className="p-4 text-center text-gray-500">{t.settings.noClubsAvailable}</div>
          ) : (
            <>
              <button
                onClick={() => onSaveFavoriteClub(null)}
                className={`w-full p-4 flex items-center justify-between text-left ${!favoriteClubId ? 'bg-red-50' : 'hover:bg-gray-50'}`}
              >
                <span className="text-gray-600">{t.settings.none}</span>
                {!favoriteClubId && <span className="text-xs text-red-600 font-medium">✓</span>}
              </button>
              {clubs.map((club) => (
                <button
                  key={club.id}
                  onClick={() => onSaveFavoriteClub(club.id)}
                  className={`w-full p-4 flex items-center gap-3 text-left ${favoriteClubId === club.id ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                >
                  {club.logo_url ? (
                    <img src={club.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <span className="font-medium text-gray-900 flex-1 truncate">{club.name}</span>
                  {favoriteClubId === club.id && <span className="text-xs text-red-600 font-medium">✓</span>}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

    </div>
  )
}

// ---------- Registo (Criar Conta com Questionário de Nível — 12 perguntas) ----------

// Definição das 12 perguntas do questionário (função que recebe traduções)
const getQuizQuestions = (t: typeof translations.pt): { id: string; title: string; options: { value: number; label: string }[] }[] => [
  {
    id: 'q1', title: '1. Com que frequência jogas por semana?',
    options: [
      { value: 0, label: 'Jogo muito pouco ou quase nada' },
      { value: 1, label: 'Jogo 1 vez por semana' },
      { value: 2, label: 'Jogo 2–3 vezes por semana' },
      { value: 3, label: 'Jogo 4 ou mais vezes por semana' },
    ],
  },
  {
    id: 'q2', title: '2. Já participaste em torneios ou ligas?',
    options: [
      { value: 0, label: 'Nunca joguei torneios' },
      { value: 1, label: t.common.participatedOccasionally },
      { value: 2, label: t.common.participateRegularly },
      { value: 3, label: 'Compito a nível regional/nacional' },
    ],
  },
  {
    id: 'q3', title: '3. Treinas técnica além de jogar partidas?',
    options: [
      { value: 0, label: 'Não treino' },
      { value: 1, label: t.common.trainSporadically },
      { value: 2, label: 'Treino 1 vez por semana' },
      { value: 3, label: 'Treino 2 ou mais vezes por semana' },
    ],
  },
  {
    id: 'q4', title: '4. Consistência em rallies de 10+ pancadas',
    options: [
      { value: 0, label: 'Evito trocas longas / erro muito' },
      { value: 1, label: 'Às vezes mantenho rallies' },
      { value: 2, label: 'Mantenho trocas longas com frequência' },
      { value: 3, label: 'Muito consistente mesmo a ritmo elevado' },
    ],
  },
  {
    id: 'q5', title: '5. Usas os vidros com intenção tática?',
    options: [
      { value: 0, label: 'Nunca / não sei usá-los' },
      { value: 1, label: 'Às vezes' },
      { value: 2, label: 'Regularmente' },
      { value: 3, label: 'De forma estratégica e com controlo' },
    ],
  },
  {
    id: 'q6', title: '6. Jogo na rede (voleias, bandeja, finalizações)',
    options: [
      { value: 0, label: 'Evito a rede / erro muito' },
      { value: 1, label: 'Vou à rede mas sem segurança' },
      { value: 2, label: 'Boa volea / bandeja básica' },
      { value: 3, label: 'Domino volea, bandeja/víbora e finalizações' },
    ],
  },
  {
    id: 'q7', title: '7. Serviço',
    options: [
      { value: 0, label: 'Inconsistente / muitos erros' },
      { value: 1, label: 'Aceitável' },
      { value: 2, label: 'Colocado e estável' },
      { value: 3, label: 'Potente e preciso' },
    ],
  },
  {
    id: 'q8', title: '8. Bandeja ou víbora',
    options: [
      { value: 0, label: 'Não sei executar bem' },
      { value: 1, label: 'Básica' },
      { value: 2, label: 'Consistente' },
      { value: 3, label: 'Finalizadora' },
    ],
  },
  {
    id: 'q9', title: '9. Smash / remate',
    options: [
      { value: 0, label: 'Fraco' },
      { value: 1, label: 'Básico' },
      { value: 2, label: 'Potente e direcionado' },
      { value: 3, label: 'Muito potente e decisivo' },
    ],
  },
  {
    id: 'q10', title: '10. Leitura de jogo e antecipação',
    options: [
      { value: 0, label: 'Tenho dificuldade em antecipar' },
      { value: 1, label: 'Às vezes antecipo' },
      { value: 2, label: t.common.goodReading },
      { value: 3, label: 'Excelente antecipação' },
    ],
  },
  {
    id: 'q11', title: '11. Comunicação com o parceiro',
    options: [
      { value: 0, label: 'Má' },
      { value: 1, label: 'A melhorar' },
      { value: 2, label: 'Boa' },
      { value: 3, label: 'Excelente' },
    ],
  },
  {
    id: 'q12', title: '12. Gestão da pressão',
    options: [
      { value: 0, label: 'Afeta-me bastante' },
      { value: 1, label: 'Às vezes' },
      { value: 2, label: 'Normalmente mantenho a calma' },
      { value: 3, label: 'Excelente controlo sob pressão' },
    ],
  },
]

// Agrupar perguntas em páginas de 3 (função que recebe traduções)
const getQuizPages = (t: typeof translations.pt) => {
  const questions = getQuizQuestions(t)
  return [
    { label: 'Experiência & Hábitos', questions: questions.slice(0, 3) },
    { label: 'Técnica Base', questions: questions.slice(3, 6) },
    { label: 'Pancadas', questions: questions.slice(6, 9) },
    { label: 'Estratégia & Mental', questions: questions.slice(9, 12) },
  ]
}

function RegisterScreen({ onBack, onSuccess }: {
  onBack: () => void
  onSuccess: (playerAccount: any) => void
}) {
  const { t } = useI18n()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [quizPage, setQuizPage] = useState(0) // 0-3 for the 4 quiz sub-pages
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Step 1: Dados pessoais
  const [name, setName] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [email, setEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')

  // Step 2: Questionário de nível — 12 respostas (0-3) indexadas por question id
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [selfLevel, setSelfLevel] = useState<number | null>(null) // Se o jogador já sabe o nível

  const setAnswer = (questionId: string, value: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  // Calcular nível baseado nas 12 respostas
  // Score total: 0-36 → nível 1.0-7.0
  const calculateLevel = (): number => {
    if (selfLevel) return selfLevel

    const totalScore = Object.values(answers).reduce((sum, v) => sum + v, 0)
    const answeredCount = Object.keys(answers).length

    // Se não respondeu nada, nível base
    if (answeredCount === 0) return 1.5

    // Normalizar para 12 perguntas (caso não tenha respondido a todas)
    const normalizedScore = answeredCount < 12
      ? (totalScore / answeredCount) * 12
      : totalScore

    // Mapear 0-36 → 1.0-7.0
    const level = 1.0 + (normalizedScore / 36) * 6.0
    // Arredondar para 0.5
    return Math.max(1.0, Math.min(7.0, Math.round(level * 2) / 2))
  }

  // Determinar categoria pelo nível
  const getCategoryFromLevel = (level: number): string => {
    if (level <= 1.5) return 'Iniciação'
    if (level <= 2.5) return '4ª Série'
    if (level <= 3.5) return '3ª Série'
    if (level <= 4.5) return '2ª Série'
    if (level <= 5.5) return '1ª Série'
    return 'Open'
  }

  const handleRegister = async () => {
    setError('')
    setSaving(true)

    try {
      // Normalizar telefone
      let normalizedPhone = regPhone.trim().replace(/\s+/g, '')
      
      // Se começar só com + sem indicativo, adiciona +351
      if (normalizedPhone === '+' || (normalizedPhone.startsWith('+') && normalizedPhone.length < 4)) {
        normalizedPhone = '+351' + normalizedPhone.substring(1)
      } else if (!normalizedPhone.startsWith('+')) {
        normalizedPhone = '+351' + normalizedPhone
      }

      // Validações
      if (!name.trim()) { setError(t.auth.nameRequired); setSaving(false); return }
      if (!normalizedPhone || normalizedPhone.length < 9) { 
        if (regPhone.trim() === '+' || (regPhone.trim().startsWith('+') && regPhone.trim().length < 4)) {
          setError('Por favor, adicione o indicativo do país (ex: +351)');
        } else {
          setError(t.auth.invalidPhone);
        }
        setSaving(false); 
        return 
      }
      if (!email.trim() || !email.includes('@')) { setError(t.auth.invalidEmail); setSaving(false); return }
      if (regPassword.length < 6) { setError(t.auth.passwordMinLength); setSaving(false); return }
      if (regPassword !== confirmPwd) { setError(t.auth.passwordsDontMatch); setSaving(false); return }

      // Verificar se telefone ou email já existem
      const { data: existingPhone } = await supabase
        .from('player_accounts')
        .select('id')
        .eq('phone_number', normalizedPhone)
        .maybeSingle()
      
      if (existingPhone) { setError('Este número de telemóvel já está registado. Faz login.'); setSaving(false); return }

      // 1. Criar conta no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: regPassword,
      })

      if (authError) {
        if (authError.message.includes('already registered')) {
          setError('Este email já está registado. Faz login.')
        } else {
          setError('Erro ao criar conta: ' + authError.message)
        }
        setSaving(false)
        return
      }

      const userId = authData?.user?.id
      if (!userId) { setError('Erro ao criar conta'); setSaving(false); return }

      // 2. Calcular nível
      const level = calculateLevel()
      const category = getCategoryFromLevel(level)

      // 3. Criar player_account
      const { data: pa, error: paError } = await supabase
        .from('player_accounts')
        .insert({
          user_id: userId,
          name: name.trim(),
          phone_number: normalizedPhone,
          email: email.trim(),
          level,
          level_reliability_percent: 10, // Novo jogador = baixa fiabilidade
          player_category: category,
          wins: 0,
          losses: 0,
          rated_matches: 0,
        })
        .select('*')
        .single()

      if (paError) {
        console.error('[Register] Error creating player_account:', paError)
        setError('Erro ao criar perfil: ' + paError.message)
        setSaving(false)
        return
      }

      // 4. Fazer login automático
      await supabase.auth.signInWithPassword({ email: email.trim(), password: regPassword })

      // Sucesso!
      onSuccess(pa)
    } catch (err: any) {
      console.error('[Register] Error:', err)
      setError('Erro inesperado: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const levelDescriptions: { level: number; label: string; desc: string }[] = [
    { level: 1.0, label: '1.0 - Principiante', desc: 'Nunca joguei ou estou a começar.' },
    { level: 1.5, label: '1.5 - Iniciação', desc: 'Consigo manter a bola em jogo.' },
    { level: 2.0, label: '2.0 - Iniciação+', desc: 'Consigo servir e devolver.' },
    { level: 2.5, label: '2.5 - Intermédio baixo', desc: 'Batidas consistentes, vidro.' },
    { level: 3.0, label: '3.0 - Intermédio', desc: 'Jogo consistente, posiciono-me bem.' },
    { level: 3.5, label: '3.5 - Intermédio+', desc: 'Bom controlo, bandejas e vóleis.' },
    { level: 4.0, label: '4.0 - Avançado', desc: 'Todas as pancadas, leitura de jogo.' },
    { level: 4.5, label: '4.5 - Avançado+', desc: 'Domínio técnico, competitivo.' },
    { level: 5.0, label: '5.0 - Expert', desc: 'Nível muito alto, torneios top.' },
    { level: 5.5, label: '5.5 - Expert+', desc: 'Semi-profissional.' },
    { level: 6.0, label: '6.0+ - Profissional', desc: 'Nível profissional.' },
  ]

  // Progresso total: step 1 = 1/6, step 2 pages = 2-5/6, step 3 = 6/6
  const totalSegments = 6
  const currentSegment = step === 1 ? 1 : step === 2 ? 2 + quizPage : 6

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
            else if (step === 3) { setStep(2); setQuizPage(3); setError('') }
            else onBack()
          }} className="p-1 -ml-1"><ArrowLeft className="w-6 h-6 text-gray-700" /></button>
          <h1 className="text-2xl font-bold text-gray-900">Criar Conta</h1>
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

        {/* ========== STEP 1: DADOS PESSOAIS ========== */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Dados Pessoais</h2>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Nome completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input value={name} onChange={e => setName(e.target.value)} placeholder="O teu nome" className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Telemóvel</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input value={regPhone} onChange={e => setRegPhone(e.target.value)} placeholder="912 345 678" type="tel" className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                O indicativo +351 será adicionado automaticamente se não fornecido
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" type="email" className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="Mínimo 6 caracteres" type="password" className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Confirmar password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder={t.auth.repeatPassword} type="password" className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
              </div>
            </div>

            <button 
              onClick={() => {
                setError('')
                if (!name.trim()) { setError('Nome é obrigatório'); return }
                if (!regPhone.trim()) { setError('Telefone é obrigatório'); return }
                if (!email.trim()) { setError('Email é obrigatório'); return }
                if (regPassword.length < 6) { setError('Password deve ter pelo menos 6 caracteres'); return }
                if (regPassword !== confirmPwd) { setError('Passwords não coincidem'); return }
                setStep(2)
                setQuizPage(0)
              }}
              className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
            >
              Seguinte
            </button>
          </div>
        )}

        {/* ========== STEP 2: QUESTIONÁRIO DE NÍVEL (12 perguntas em 4 páginas) ========== */}
        {step === 2 && (
          <div className="space-y-5 animate-fade-in">
            {/* Se quizPage === 0, mostrar opção directa */}
            {quizPage === 0 && (
              <>
                <h2 className="text-lg font-bold text-gray-900">Avaliação de Nível</h2>
                <p className="text-sm text-gray-500 -mt-3">
                  Responde às 12 perguntas para calcularmos o teu nível, ou seleciona diretamente se já o conheces.
                </p>

                {/* Toggle: questionário vs directo */}
                {selfLevel !== null && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-green-800">Nível selecionado: {selfLevel.toFixed(2)}</p>
                      <p className="text-xs text-green-600">{getCategoryFromLevel(selfLevel)}</p>
                    </div>
                    <button onClick={() => setSelfLevel(null)} className="text-xs text-green-700 underline">Alterar</button>
                  </div>
                )}

                {selfLevel === null && (
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-semibold text-red-600 hover:text-red-700 flex items-center gap-1">
                      <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
                      Já sei o meu nível — selecionar diretamente
                    </summary>
                    <div className="mt-3 grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                      {levelDescriptions.map(ld => (
                        <button
                          key={ld.level}
                          onClick={() => setSelfLevel(ld.level)}
                          className="text-left p-2.5 rounded-xl border text-sm transition-colors border-gray-200 hover:border-red-300 hover:bg-red-50/50"
                        >
                          <span className="font-bold text-gray-900 block">{ld.label.split(' - ')[0]}</span>
                          <span className="text-[11px] text-gray-500 leading-tight">{ld.desc}</span>
                        </button>
                      ))}
                    </div>
                  </details>
                )}
              </>
            )}

            {/* Perguntas da página actual (se não selecionou nível directo) */}
            {selfLevel === null && (
              <>
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
                          const letter = String.fromCharCode(65 + oi) // A, B, C, D
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
                  {currentPageAnswered}/{currentPageQuestions.length} respondidas nesta secção
                </p>
              </>
            )}

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
                Voltar
              </button>
              <button 
                onClick={() => {
                  setError('')
                  if (selfLevel !== null) {
                    // Nível directo — saltar questionário, ir para confirmação
                    setStep(3)
                    return
                  }
                  if (!currentPageComplete) {
                    setError('Responde a todas as perguntas desta secção')
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
                {(selfLevel !== null || quizPage === QUIZ_PAGES.length - 1) ? t.common.viewResult : t.common.nextButton}
              </button>
            </div>
          </div>
        )}

        {/* ========== STEP 3: CONFIRMAÇÃO ========== */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-lg font-bold text-gray-900">Confirmar registo</h2>
            
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
                  <p className="text-gray-500">Telefone</p>
                  <p className="font-medium">{regPhone}</p>
                </div>
                <div>
                  <p className="text-gray-500">Nível estimado</p>
                  <p className="font-bold text-red-600 text-lg">{calculateLevel().toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Categoria</p>
                  <p className="font-medium">{getCategoryFromLevel(calculateLevel())}</p>
                </div>
                <div>
                  <p className="text-gray-500">Fiabilidade</p>
                  <p className="font-medium text-amber-600">10%</p>
                </div>
              </div>
            </div>

            {/* Resumo visual do questionário */}
            {selfLevel === null && Object.keys(answers).length > 0 && (
              <div className="card p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Resumo do questionário</p>
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

            <p className="text-xs text-gray-500 text-center">
              O teu nível será ajustado automaticamente com base nos resultados dos teus jogos.
              Os clubes também podem ajustar o teu nível.
            </p>

            <div className="flex gap-3">
              <button onClick={() => { setStep(2); setQuizPage(selfLevel !== null ? 0 : 3); setError('') }} className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50">
                Voltar
              </button>
              <button 
                onClick={handleRegister}
                disabled={saving}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:bg-gray-300"
              >
                {saving ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    A criar...
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
              <p className="text-sm text-gray-600 leading-relaxed">{s.text}</p>
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
