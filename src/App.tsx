import { useState, useEffect } from 'react'
import { supabase, PlayerAccount } from './lib/supabase'
import {
  fetchPlayerDashboardData,
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
  UserMinus,
  ChevronLeft
} from 'lucide-react'
import {
  followUser,
  unfollowUser,
  getFollowingIds,
  getFollowingCount,
  getFollowersCount,
  getSuggestedPlayers,
  getFeedPosts,
  createPost,
  deletePost,
  getMyGroups,
  createGroup,
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
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
  type CommunityGroup,
  type GroupMember,
} from './lib/communityData'
import { fetchAllClubs, fetchClubById, fetchUpcomingTournaments, fetchEnrolledByCategory, getTournamentRegistrationUrl, type ClubDetail, type UpcomingTournamentFromTour, type EnrolledByCategory } from './lib/clubAndTournaments'

type Screen = 'home' | 'games' | 'profile-view' | 'profile-edit' | 'club' | 'compete' | 'community' | 'player-profile' | 'follows-list'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [player, setPlayer] = useState<PlayerAccount | null>(null)
  const [currentScreen, setCurrentScreen] = useState<Screen>('home')
  const [selectedPlayerUserId, setSelectedPlayerUserId] = useState<string | null>(null)
  const [followsListUserId, setFollowsListUserId] = useState<string | null>(null) // For FollowsListScreen
  const [isLoading, setIsLoading] = useState(true)
  
  // Auth states
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  const [isAuthLoading, setIsAuthLoading] = useState(false)

  // Dashboard data (mesma fonte que Padel One Tour – dados nos dois lados)
  const [dashboardData, setDashboardData] = useState<PlayerDashboardData | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    setIsLoading(true)
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.user) {
      const { data: playerAccount } = await supabase
        .from('player_accounts')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (playerAccount) {
        setPlayer(playerAccount as any)
        setIsAuthenticated(true)
        const data = await fetchPlayerDashboardData(session.user.id)
        setDashboardData(data)
        setIsLoading(false)
        return
      }
    }

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
        if (data.user_id) {
          const dash = await fetchPlayerDashboardData(data.user_id)
          setDashboardData(dash)
        }
      }
    }
    setIsLoading(false)
  }

  const refreshDashboard = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const data = await fetchPlayerDashboardData(session.user.id)
      setDashboardData(data)
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
      console.error('[PROFILE] Erro ao guardar perfil:', error)
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
      if (!normalizedPhone.startsWith('+')) {
        normalizedPhone = '+351' + normalizedPhone
      }

      console.log('[LOGIN] Procurando telefone via Edge Function:', normalizedPhone)

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
      console.log('[LOGIN] Resposta da Edge Function:', emailData)

      if (!response.ok || !emailData?.success || !emailData?.email) {
        if (emailData?.error === 'Player account not found') {
          setAuthError('Telefone não encontrado')
        } else if (emailData?.error === 'Player account has no email') {
          setAuthError('Conta sem email associado. Contacta o organizador.')
        } else {
          setAuthError(emailData?.error || 'Erro ao verificar telefone')
        }
        setIsAuthLoading(false)
        return
      }

      const emailToUse = emailData.email
      console.log('[LOGIN] Email obtido:', emailToUse)

      // Fazer login com Supabase Auth
      const { error: authError, data: authData } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: password,
      })

      if (authError) {
        console.log('[LOGIN] Erro de auth:', authError)
        if (authError.message.includes('Invalid login')) {
          setAuthError('Password incorreta')
        } else {
          setAuthError('Erro ao fazer login: ' + authError.message)
        }
        setIsAuthLoading(false)
        return
      }

      console.log('[LOGIN] Login com sucesso! User:', authData?.user?.id)

      // Buscar player_account agora que estamos autenticados
      if (authData?.user) {
        const { data: account } = await supabase
          .from('player_accounts')
          .select('*')
          .eq('user_id', authData.user.id)
          .maybeSingle()
        
        playerAccount = account
        console.log('[LOGIN] Player account:', playerAccount)
      }

      localStorage.setItem('padel_one_player_phone', normalizedPhone)

      if (playerAccount) {
        setPlayer(playerAccount as any)
        if (authData?.user) {
          const data = await fetchPlayerDashboardData(authData.user.id)
          setDashboardData(data)
        }
      }
      setIsAuthenticated(true)
    } catch (err) {
      console.error('Login error:', err)
      setAuthError('Erro ao fazer login')
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">A carregar...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
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
    />
  }

  const displayName = dashboardData?.playerName || player?.name?.split(' ')[0] || 'Jogador'

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
              <p className="text-xs text-gray-500">Olá,</p>
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
              <h2 className="font-bold text-gray-900">Menu</h2>
              <button onClick={() => setMenuOpen(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="p-2 overflow-y-auto max-h-[calc(100vh-60px)]">
              <button onClick={() => { setCurrentScreen('profile-edit'); setMenuOpen(false) }} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left">
                <Settings className="w-5 h-5 text-gray-500" />
                <span className="font-medium text-gray-900">Definições do perfil</span>
              </button>
              <button onClick={() => setMenuOpen(false)} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left">
                <Globe className="w-5 h-5 text-gray-500" />
                <span className="font-medium text-gray-900">Escolha de idioma</span>
              </button>
              <button onClick={() => setMenuOpen(false)} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left">
                <KeyRound className="w-5 h-5 text-gray-500" />
                <span className="font-medium text-gray-900">Mudar a password</span>
              </button>
              <button onClick={() => setMenuOpen(false)} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left">
                <Bell className="w-5 h-5 text-gray-500" />
                <span className="font-medium text-gray-900">Ativar notificações</span>
              </button>
              <div className="border-t my-2" />
              <button onClick={() => setMenuOpen(false)} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left">
                <HelpCircle className="w-5 h-5 text-gray-500" />
                <span className="font-medium text-gray-900">Ajuda</span>
              </button>
              <button onClick={() => setMenuOpen(false)} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left">
                <GraduationCap className="w-5 h-5 text-gray-500" />
                <span className="font-medium text-gray-900">Como funciona a Padel One</span>
              </button>
              <button onClick={() => setMenuOpen(false)} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left">
                <Shield className="w-5 h-5 text-gray-500" />
                <span className="font-medium text-gray-900">Privacidade</span>
              </button>
              <button onClick={() => setMenuOpen(false)} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left">
                <CreditCard className="w-5 h-5 text-gray-500" />
                <span className="font-medium text-gray-900">Os seus Pagamentos</span>
              </button>
              <div className="border-t my-2" />
              <button onClick={() => { handleLogout(); setMenuOpen(false) }} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-50 text-left text-red-600">
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Terminar Sessão</span>
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="px-4 py-4">
        {currentScreen === 'home' && (
          <HomeScreen
            player={player}
            dashboardData={dashboardData}
            userId={player?.user_id ?? null}
            onRefresh={refreshDashboard}
            onOpenClub={() => setCurrentScreen('club')}
            onOpenCompete={() => setCurrentScreen('compete')}
            onOpenGames={() => setCurrentScreen('games')}
            onOpenFollowsList={(uid: string) => { setFollowsListUserId(uid); setCurrentScreen('follows-list') }}
          />
        )}
        {currentScreen === 'games' && (
          <GamesScreen
            player={player}
            dashboardData={dashboardData}
            onRefresh={refreshDashboard}
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
            dashboardData={dashboardData}
            favoriteClubId={player?.favorite_club_id ?? null}
            userId={player?.user_id ?? null}
            playerAccountId={player?.id ?? null}
            onBack={() => setCurrentScreen('home')}
          />
        )}
        {currentScreen === 'profile-view' && (
          <ProfileViewScreen
            player={player}
            dashboardData={dashboardData}
            userId={player?.user_id ?? null}
            onOpenGames={() => setCurrentScreen('games')}
            onOpenFollowsList={(uid: string) => { setFollowsListUserId(uid); setCurrentScreen('follows-list') }}
          />
        )}
        {currentScreen === 'profile-edit' && (
          <ProfileEditScreen
            player={player}
            onSaveFavoriteClub={handleSaveFavoriteClub}
            onSaveProfile={handleSaveProfile}
          />
        )}
        {currentScreen === 'community' && player?.user_id && (
          <CommunityScreen userId={player.user_id} playerAccountId={player.id} onOpenPlayerProfile={(uid: string) => { setSelectedPlayerUserId(uid); setCurrentScreen('player-profile') }} />
        )}
        {currentScreen === 'player-profile' && selectedPlayerUserId && player?.user_id && (
          <OtherPlayerProfileScreen
            targetUserId={selectedPlayerUserId}
            myUserId={player.user_id}
            onBack={() => setCurrentScreen('community')}
            onOpenFollowsList={(uid: string) => { setFollowsListUserId(uid); setCurrentScreen('follows-list') }}
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
            label="Início" 
            active={currentScreen === 'home'} 
            onClick={() => setCurrentScreen('home')} 
          />
          <NavItem 
            icon={Users} 
            label="Comunidade" 
            active={currentScreen === 'community'} 
            onClick={() => setCurrentScreen('community')} 
          />
          <NavItem 
            icon={User} 
            label="Perfil" 
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

function LoginScreen({ phone, setPhone, password, setPassword, showPassword, setShowPassword, error, isLoading, onLogin }: {
  phone: string
  setPhone: (v: string) => void
  password: string
  setPassword: (v: string) => void
  showPassword: boolean
  setShowPassword: (v: boolean) => void
  error: string
  isLoading: boolean
  onLogin: () => void
}) {

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
            PADEL <span className="text-red-600">ONE</span>
          </h1>
          <p className="text-gray-500">A tua app de Padel</p>
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
              Campo {match.court || '-'}
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

function PlayerCircle({ name, bgClass, textClass, avatarUrl, currentPlayerName }: {
  name: string
  bgClass: string
  textClass: string
  avatarUrl?: string | null
  currentPlayerName?: string
}) {
  const showAvatar = avatarUrl && isCurrentPlayer(name, currentPlayerName)
  return (
    <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-sm flex-shrink-0 overflow-hidden ${!showAvatar ? bgClass : ''}`} title={name}>
      {showAvatar ? (
        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className={textClass}>{initialFor(name)}</span>
      )}
    </div>
  )
}

/** Card ao estilo Playtomic: layout vertical – equipa 1 em cima, resultado no meio, equipa 2 em baixo; nomes abaixo de cada bolinha; troféu ao lado do resultado da equipa vencedora */
function GameCardPlaytomic({ match, fullWidth, currentPlayerAvatar, currentPlayerName }: { match: PlayerMatchForCard; fullWidth?: boolean; currentPlayerAvatar?: string | null; currentPlayerName?: string }) {
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

  return (
    <div className={`rounded-2xl bg-white border border-gray-100 shadow-md overflow-hidden ${fullWidth ? 'w-full' : 'flex-shrink-0 w-[280px] sm:w-[300px]'}`}>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-medium text-gray-500">
            {match.start_time ? formatDateWithTime(match.start_time) : '-'}
          </span>
          {isTournament && (
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
              <div className="flex flex-col items-center min-h-[52px]">
                <PlayerCircle name={p1} bgClass="bg-orange-400" textClass="text-xl font-bold text-white" avatarUrl={currentPlayerAvatar} currentPlayerName={currentPlayerName} />
                <span className="text-[10px] text-gray-600 truncate max-w-[60px] mt-0.5 text-center line-clamp-2 min-h-[24px]" title={p1}>{p1}</span>
              </div>
              <div className="flex flex-col items-center min-h-[52px]">
                <PlayerCircle name={p2} bgClass="bg-orange-400" textClass="text-xl font-bold text-white" avatarUrl={currentPlayerAvatar} currentPlayerName={currentPlayerName} />
                <span className="text-[10px] text-gray-600 truncate max-w-[60px] mt-0.5 text-center line-clamp-2 min-h-[24px]" title={p2}>{p2}</span>
              </div>
            </div>
            {match.status === 'completed' && (hasSets || match.score1 != null) && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {team1Won && (
                  <span className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center text-sm flex-shrink-0" title="Equipa vencedora">🏆</span>
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
              <div className="flex flex-col items-center min-h-[52px]">
                <PlayerCircle name={p3} bgClass="bg-sky-200" textClass="text-xl font-bold text-sky-800" avatarUrl={currentPlayerAvatar} currentPlayerName={currentPlayerName} />
                <span className="text-[10px] text-gray-600 truncate max-w-[60px] mt-0.5 text-center line-clamp-2 min-h-[24px]" title={p3}>{p3}</span>
              </div>
              <div className="flex flex-col items-center min-h-[52px]">
                <PlayerCircle name={p4} bgClass="bg-sky-200" textClass="text-xl font-bold text-sky-800" avatarUrl={currentPlayerAvatar} currentPlayerName={currentPlayerName} />
                <span className="text-[10px] text-gray-600 truncate max-w-[60px] mt-0.5 text-center line-clamp-2 min-h-[24px]" title={p4}>{p4}</span>
              </div>
            </div>
            {match.status === 'completed' && (hasSets || match.score1 != null) && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {team2Won && (
                  <span className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center text-sm flex-shrink-0" title="Equipa vencedora">🏆</span>
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
              {match.court ? ` · C.${match.court}` : ''}
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
            {tournament.status === 'active' || tournament.status === 'in_progress' ? 'Em curso' : tournament.status}
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

function HomeScreen({
  player,
  dashboardData,
  userId,
  onRefresh,
  onOpenClub,
  onOpenCompete,
  onOpenGames,
  onOpenFollowsList,
}: {
  player: PlayerAccount | null
  dashboardData: PlayerDashboardData | null
  userId: string | null
  onRefresh: () => Promise<void>
  onOpenClub: () => void
  onOpenCompete: () => void
  onOpenGames: () => void
  onOpenFollowsList: (userId: string) => void
}) {
  void onRefresh
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

  const d = dashboardData
  const name = d?.playerName || player?.name?.split(' ')[0] || 'Jogador'
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
  const rewardPoints = d?.leagueStandings?.[0]?.points ?? points
  const bio = player?.bio || ''
  const truncatedBio = bio.length > 160 ? bio.substring(0, 160) + '...' : bio

  // Determinar nível de reward
  const getRewardTier = (points: number) => {
    if (points <= 100) return { name: 'Silver', emoji: '🥈', bgColor: 'bg-gradient-to-br from-gray-100 to-gray-200', textColor: 'text-gray-700' }
    if (points <= 400) return { name: 'Gold', emoji: '🥇', bgColor: 'bg-gradient-to-br from-yellow-50 to-amber-100', textColor: 'text-amber-700' }
    return { name: 'Platinum', emoji: '💎', bgColor: 'bg-gradient-to-br from-purple-50 to-purple-100', textColor: 'text-purple-700' }
  }

  const rewardTier = getRewardTier(rewardPoints)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Quick Actions */}
      <div className="grid grid-cols-5 gap-3">
        <ActionButton icon={Calendar} label="Reservar" color="lime" />
        <ActionButton icon={Building2} label="Clube Favorito" color="blue" onClick={onOpenClub} />
        <ActionButton icon={Trophy} label="Competir" color="amber" onClick={onOpenCompete} />
        <ActionButton icon={Gamepad2} label="Encontrar Jogo" color="purple" emoji="🎾" />
        <ActionButton icon={GraduationCap} label="Aprender" color="emerald" />
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
            <h2 className="font-bold text-xl text-gray-900">{player?.name || name || 'Jogador'}</h2>
            {truncatedBio && (
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">{truncatedBio}</p>
            )}
          </div>
        </div>
      </div>

      {/* Nível + Fiabilidade + Categoria */}
      <div className="rounded-xl shadow-sm overflow-hidden p-6 bg-gradient-to-br from-red-50 to-red-100">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-5xl font-bold text-red-600">Nível {player?.level?.toFixed(1) || '3.0'}</p>
            <p className="text-sm text-gray-600 mt-2 flex items-center gap-1.5">
              <span>📊</span> Fiabilidade {player?.level_reliability_percent?.toFixed(0) ?? '85'}%
            </p>
          </div>
          {player?.player_category && (
            <div className="px-4 py-2 bg-blue-500 rounded-lg shadow-sm self-start">
              <span className="text-sm font-bold text-white">{player.player_category}</span>
            </div>
          )}
        </div>
      </div>

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
      <div className={`rounded-xl shadow-sm overflow-hidden p-5 ${rewardTier.bgColor}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm font-medium mb-1 flex items-center gap-1.5 ${rewardTier.textColor}`}>
              <span className="text-lg">{rewardTier.emoji}</span> Pontos Reward · {rewardTier.name}
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
      </div>

      {/* Próximos Jogos – lista horizontal ao estilo Playtomic */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>📅</span> Próximos Jogos
          </h2>
          <button onClick={onOpenGames} className="text-red-600 text-sm font-medium flex items-center gap-1">
            Ver todos <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {upcomingMatches.length > 0 ? (
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth games-horizontal-scroll">
            <div className="flex gap-4" style={{ width: 'max-content' }}>
              {upcomingMatches.map((match) => (
                <div key={match.id} className="snap-center">
                  <GameCardPlaytomic match={match} currentPlayerAvatar={player?.avatar_url} currentPlayerName={player?.name} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card p-6 text-center">
            <span className="text-4xl mb-2 block">🎾</span>
            <p className="text-gray-700 font-medium">Sem jogos agendados</p>
            <p className="text-sm text-gray-500 mt-1">Inscreve-te num torneio e entra na ação 🚀</p>
          </div>
        )}
      </div>

      {/* Os Meus Torneios */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>🏆</span> Os Meus Torneios
          </h2>
          <button onClick={onOpenCompete} className="text-red-600 text-sm font-medium flex items-center gap-1">
            Ver todos <ChevronRight className="w-4 h-4" />
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
              <p className="text-sm text-gray-500 mt-1">Entra na Padel One Tour e compete 🔥</p>
            </div>
          )}
        </div>
      </div>

      {/* Resultados Recentes – lista horizontal ao estilo Playtomic */}
      {d && d.recentMatches.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>📊</span> Resultados Recentes
            </h2>
            <button onClick={onOpenGames} className="text-red-600 text-sm font-medium flex items-center gap-1">
              Ver todos <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth games-horizontal-scroll">
            <div className="flex gap-4" style={{ width: 'max-content' }}>
              {d.recentMatches.map((match) => (
                <div key={match.id} className="snap-center">
                  <GameCardPlaytomic match={match} currentPlayerAvatar={player?.avatar_url} currentPlayerName={player?.name} />
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
                          {m.is_winner !== undefined && <span className={`block text-xs mt-1 ${m.is_winner ? 'text-green-600' : 'text-red-600'}`}>{m.is_winner ? 'Vitória' : 'Derrota'}</span>}
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
function CommunityScreen({ userId, playerAccountId, onOpenPlayerProfile }: { userId: string; playerAccountId: string; onOpenPlayerProfile: (userId: string) => void }) {
  const [activeTab, setActiveTab] = useState<'feed' | 'grupos'>('feed')

  // Feed state
  const [suggestions, setSuggestions] = useState<CommunityPlayer[]>([])
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set())

  // New post modal
  const [showNewPost, setShowNewPost] = useState(false)
  const [newPostText, setNewPostText] = useState('')
  const [newPostImage, setNewPostImage] = useState<File | null>(null)
  const [newPostVideo, setNewPostVideo] = useState<File | null>(null)
  const [postingLoading, setPostingLoading] = useState(false)

  // Groups state
  const [groups, setGroups] = useState<CommunityGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')
  const [newGroupImage, setNewGroupImage] = useState<File | null>(null)
  const [creatingGroup, setCreatingGroup] = useState(false)

  // Group detail
  const [selectedGroup, setSelectedGroup] = useState<CommunityGroup | null>(null)
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([])
  const [groupMembersLoading, setGroupMembersLoading] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const [memberSearchResults, setMemberSearchResults] = useState<CommunityPlayer[]>([])
  const [memberSearching, setMemberSearching] = useState(false)

  // Global player search
  const [playerSearchQuery, setPlayerSearchQuery] = useState('')
  const [playerSearchResults, setPlayerSearchResults] = useState<CommunityPlayer[]>([])
  const [playerSearching, setPlayerSearching] = useState(false)
  const [showPlayerSearch, setShowPlayerSearch] = useState(false)

  // Load feed data
  useEffect(() => {
    if (activeTab === 'feed') loadFeed()
  }, [activeTab, userId])

  // Load groups data
  useEffect(() => {
    if (activeTab === 'grupos') loadGroups()
  }, [activeTab, userId])

  async function loadFeed() {
    setFeedLoading(true)
    try {
      const [suggestedData, feedData] = await Promise.all([
        getSuggestedPlayers(userId),
        getFeedPosts(userId),
      ])
      setSuggestions(suggestedData)
      setPosts(feedData)
      // Build following set
      const ids = await getFollowingIds(userId)
      setFollowingSet(new Set(ids))
    } catch (err) {
      console.error('[Community] Load feed error:', err)
    }
    setFeedLoading(false)
  }

  async function loadGroups() {
    setGroupsLoading(true)
    try {
      const data = await getMyGroups(userId)
      setGroups(data)
    } catch (err) {
      console.error('[Community] Load groups error:', err)
    }
    setGroupsLoading(false)
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

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return
    setCreatingGroup(true)
    const groupId = await createGroup(newGroupName, newGroupDesc, userId, newGroupImage || undefined)
    if (groupId) {
      setNewGroupName('')
      setNewGroupDesc('')
      setNewGroupImage(null)
      setShowCreateGroup(false)
      await loadGroups()
    }
    setCreatingGroup(false)
  }

  async function handleOpenGroup(group: CommunityGroup) {
    setSelectedGroup(group)
    setGroupMembersLoading(true)
    const members = await getGroupMembers(group.id)
    setGroupMembers(members)
    setGroupMembersLoading(false)
  }

  async function handleSearchMembers() {
    if (memberSearchQuery.trim().length < 2) return
    setMemberSearching(true)
    const existingIds = groupMembers.map(m => m.user_id)
    const results = await searchPlayers(memberSearchQuery, existingIds)
    setMemberSearchResults(results)
    setMemberSearching(false)
  }

  async function handleAddMember(player: CommunityPlayer) {
    if (!selectedGroup) return
    const ok = await addGroupMember(selectedGroup.id, player.user_id)
    if (ok) {
      setMemberSearchResults(prev => prev.filter(p => p.user_id !== player.user_id))
      // Refresh members
      const members = await getGroupMembers(selectedGroup.id)
      setGroupMembers(members)
    }
  }

  async function handleRemoveMember(memberUserId: string) {
    if (!selectedGroup) return
    const ok = await removeGroupMember(selectedGroup.id, memberUserId)
    if (ok) {
      setGroupMembers(prev => prev.filter(m => m.user_id !== memberUserId))
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
      console.log('[Community] Searching for:', playerSearchQuery.trim())
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

  // ---- Group Detail Modal ----
  if (selectedGroup) {
    return (
      <div className="animate-fade-in pb-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => { setSelectedGroup(null); setShowAddMember(false); setMemberSearchQuery(''); setMemberSearchResults([]) }} className="p-1">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">{selectedGroup.name}</h2>
            {selectedGroup.description && <p className="text-sm text-gray-500">{selectedGroup.description}</p>}
          </div>
        </div>

        {/* Group image */}
        {selectedGroup.image_url && (
          <div className="rounded-xl overflow-hidden mb-4 h-40">
            <img src={selectedGroup.image_url} alt={selectedGroup.name} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Members */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Membros ({groupMembers.length})</h3>
          {selectedGroup.is_admin && (
            <button onClick={() => setShowAddMember(!showAddMember)} className="flex items-center gap-1 text-sm text-red-600 font-medium">
              <UserPlus className="w-4 h-4" />
              Adicionar
            </button>
          )}
        </div>

        {/* Add member search */}
        {showAddMember && (
          <div className="bg-gray-50 rounded-xl p-3 mb-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={memberSearchQuery}
                onChange={e => setMemberSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearchMembers()}
                placeholder="Pesquisar jogador..."
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button onClick={handleSearchMembers} disabled={memberSearching} className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm">
                {memberSearching ? '...' : <Search className="w-4 h-4" />}
              </button>
            </div>
            {memberSearchResults.length > 0 && (
              <div className="mt-2 space-y-2">
                {memberSearchResults.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-white rounded-lg p-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                        {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" /> : getInitials(p.name)}
                      </div>
                      <span className="text-sm font-medium">{p.name}</span>
                    </div>
                    <button onClick={() => handleAddMember(p)} className="text-xs text-white bg-orange-500 px-2 py-1 rounded-lg hover:bg-orange-600">Adicionar</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {groupMembersLoading ? (
          <div className="text-center py-8 text-gray-400">A carregar membros...</div>
        ) : (
          <div className="space-y-2">
            {groupMembers.map(m => {
              const mColors = categoryColors(m.player_category)
              return (
              <div key={m.id} className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => onOpenPlayerProfile(m.user_id)}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                    {m.avatar_url ? <img src={m.avatar_url} className="w-full h-full object-cover" /> : getInitials(m.name)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                    <div className="flex items-center gap-2">
                      {m.role === 'admin' && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Admin</span>}
                      {m.player_category && <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${mColors.bg} ${mColors.text}`}>{m.player_category}</span>}
                      {(m.player_category || m.level) && <span className="text-xs text-gray-500">Nv {categoryToLevel(m.player_category) ?? m.level}</span>}
                    </div>
                  </div>
                </div>
                {selectedGroup.is_admin && m.user_id !== userId && (
                  <button onClick={(e) => { e.stopPropagation(); handleRemoveMember(m.user_id) }} className="text-gray-400 hover:text-red-500">
                    <UserMinus className="w-4 h-4" />
                  </button>
                )}
              </div>
              )
            })}
          </div>
        )}
      </div>
    )
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
            placeholder="Pesquisar jogadores..."
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

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
        <button
          onClick={() => setActiveTab('feed')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'feed' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
        >
          Feed
        </button>
        <button
          onClick={() => setActiveTab('grupos')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'grupos' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
        >
          Grupos
        </button>
      </div>

      {/* ==================== TAB FEED ==================== */}
      {activeTab === 'feed' && (
        <div>
          {feedLoading ? (
            <div className="text-center py-12 text-gray-400">A carregar...</div>
          ) : (
            <>
              {/* Sugestões de jogadores */}
              {suggestions.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 px-1">Jogadores sugeridos</h3>
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

              {/* Feed de posts */}
              {posts.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">O teu feed está vazio</p>
                  <p className="text-sm text-gray-400 mt-1">Segue jogadores para ver as suas publicações aqui.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {posts.map(post => (
                    <div key={post.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
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
                  ))}
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
      )}

      {/* ==================== TAB GRUPOS ==================== */}
      {activeTab === 'grupos' && (
        <div>
          {groupsLoading ? (
            <div className="text-center py-12 text-gray-400">A carregar...</div>
          ) : (
            <>
              {/* Create group button */}
              <button
                onClick={() => setShowCreateGroup(true)}
                className="w-full mb-4 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:text-red-600 hover:border-red-300 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Criar Grupo
              </button>

              {groups.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">Sem grupos</p>
                  <p className="text-sm text-gray-400 mt-1">Cria um grupo para organizar os teus jogos.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {groups.map(group => (
                    <button
                      key={group.id}
                      onClick={() => handleOpenGroup(group)}
                      className="w-full text-left bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
                    >
                      {group.image_url ? (
                        <div className="h-28 relative">
                          <img src={group.image_url} alt={group.name} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <p className="text-white font-bold text-sm">{group.name}</p>
                            <p className="text-white/70 text-xs">{group.member_count} membros</p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white font-bold text-lg">
                            {group.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{group.name}</p>
                            <p className="text-xs text-gray-500">{group.member_count} membros</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Create Group Modal */}
          {showCreateGroup && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center animate-fade-in">
              <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Criar Grupo</h3>
                  <button onClick={() => { setShowCreateGroup(false); setNewGroupName(''); setNewGroupDesc(''); setNewGroupImage(null) }}>
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder="Nome do grupo"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 mb-3"
                />
                <textarea
                  value={newGroupDesc}
                  onChange={e => setNewGroupDesc(e.target.value)}
                  placeholder="Descrição (opcional)"
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-3"
                />
                <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer hover:text-red-600 mb-4">
                  <Image className="w-5 h-5" />
                  <span>{newGroupImage ? newGroupImage.name : 'Adicionar imagem de capa'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) setNewGroupImage(e.target.files[0]) }} />
                </label>
                {newGroupImage && (
                  <div className="mb-3 relative">
                    <img src={URL.createObjectURL(newGroupImage)} className="w-full h-32 object-cover rounded-lg" />
                    <button onClick={() => setNewGroupImage(null)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"><X className="w-3 h-3" /></button>
                  </div>
                )}
                <button
                  onClick={handleCreateGroup}
                  disabled={creatingGroup || !newGroupName.trim()}
                  className="w-full py-2.5 bg-red-600 text-white rounded-xl font-semibold disabled:opacity-40 hover:bg-red-700 transition-colors"
                >
                  {creatingGroup ? 'A criar...' : 'Criar Grupo'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- Clube Favorito (detalhes do clube escolhido no perfil) ----------
function ClubScreen({ favoriteClubId, onBack }: { favoriteClubId: string | null; onBack: () => void }) {
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
          <ArrowLeft className="w-5 h-5" /> Voltar
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
          <ArrowLeft className="w-5 h-5" /> Voltar
        </button>
        <div className="card p-8 text-center">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Ainda não escolheste o teu clube.</p>
          <p className="text-sm text-gray-400 mt-1">Vai ao Perfil e escolhe o teu clube favorito na lista de clubes Padel One.</p>
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
  onBack,
}: {
  dashboardData: PlayerDashboardData | null
  favoriteClubId: string | null
  userId: string | null
  playerAccountId: string | null
  onBack: () => void
}) {
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

  const d = dashboardData
  const name = d?.playerName ?? ''

  // Use ligas do dashboardData se existirem, senão usa as buscadas diretamente
  const leagueStandings = (d?.leagueStandings?.length ?? 0) > 0 ? d!.leagueStandings : leaguesDirect
  
  // Log para debug - ver quais ligas estão a ser mostradas
  useEffect(() => {
    if (activeTab === 'leagues') {
      console.log('[Leagues Display] Showing', leagueStandings.length, 'leagues')
      console.log('[Leagues Display] d.leagueStandings:', d?.leagueStandings)
      console.log('[Leagues Display] leaguesDirect:', leaguesDirect)
      console.log('[Leagues Display] Final leagueStandings:', leagueStandings)
    }
  }, [activeTab, leagueStandings, d?.leagueStandings, leaguesDirect])

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

  // Buscar ligas quando abre o tab Ligas (via Edge Function - bypass RLS)
  useEffect(() => {
    if (activeTab !== 'leagues') return
    if ((d?.leagueStandings?.length ?? 0) > 0 || leaguesFetched) return
    if (!playerAccountId) return
    let active = true
    setLeaguesLoading(true)
    ;(async () => {
      try {
        console.log('[Leagues] Fetching leagues for player_account_id:', playerAccountId)
        
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
          console.log('[Leagues] Got', data?.leagues?.length ?? 0, 'leagues')
          console.log('[Leagues] Full data:', data?.leagues)
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

  // Usar pastTournamentDetails do dashboardData se disponíveis
  useEffect(() => {
    if (d?.pastTournamentDetails && Object.keys(d.pastTournamentDetails).length > 0 && Object.keys(pastTournamentDetails).length === 0) {
      console.log('[COMPETE-HISTORY] Loading from dashboardData, count:', Object.keys(d.pastTournamentDetails).length)
      setPastTournamentDetails(d.pastTournamentDetails)
      setHistoryFetched(true)
    }
  }, [d?.pastTournamentDetails])

  // Carregar detalhes dos torneios passados quando abre o tab history
  useEffect(() => {
    console.log('[COMPETE-HISTORY] Effect triggered, activeTab:', activeTab, 'pastTournaments:', d?.pastTournaments?.length, 'userId:', userId, 'historyFetched:', historyFetched, 'pastTournamentDetails keys:', Object.keys(pastTournamentDetails).length)
    if (activeTab !== 'history') return
    if (!d?.pastTournaments?.length) {
      console.log('[COMPETE-HISTORY] No past tournaments')
      return
    }
    if (!userId) {
      console.log('[COMPETE-HISTORY] No userId')
      return
    }
    // FORÇAR RE-FETCH se não temos detalhes
    const hasDetails = Object.keys(pastTournamentDetails).length > 0
    if (historyFetched && hasDetails) {
      console.log('[COMPETE-HISTORY] Already fetched and has details, skipping')
      return
    }
    let active = true
    console.log('[History] Fetching', d.pastTournaments.length, 'tournaments, userId:', userId)
    setPastTournamentLoading(true)
    setHistoryFetched(false) // Reset para permitir re-fetch
    ;(async () => {
      try {
        const { fetchTournamentStandingsAndMatches } = await import('./lib/playerDashboardData')
        const results: Record<string, { standings: any[]; myMatches: any[]; playerPosition?: number; tournamentName: string }> = {}
        for (const t of (d.pastTournaments ?? [])) {
          if (!active) break
          try {
            console.log('[History] Fetching tournament:', t.name, t.id)
            const data = await fetchTournamentStandingsAndMatches(t.id, userId!)
            results[t.id] = { standings: data.standings, myMatches: data.myMatches, playerPosition: data.playerPosition, tournamentName: data.tournamentName }
            console.log(`[History] ${t.name}: ${data.standings.length} standings, ${data.myMatches.length} matches`)
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
    const cached = pastTournamentDetails[tournamentId]
    if (cached) {
      setViewingTournament({ id: tournamentId, name: tournamentName })
      setTournamentDetail({ standings: cached.standings, myMatches: cached.myMatches, name: cached.tournamentName })
      setDetailTab('standings')
      return
    }
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

  return (
    <div className="space-y-4 animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-5 h-5" /> Voltar
      </button>
      <h1 className="text-xl font-bold text-gray-900">Competir</h1>
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 min-w-0 py-2 px-3 rounded-lg text-sm font-medium whitespace-nowrap ${activeTab === 'upcoming' ? 'bg-red-600 text-white' : 'text-gray-600'}`}
        >
          Próximos
        </button>
        <button
          onClick={() => setActiveTab('leagues')}
          className={`flex-1 min-w-0 py-2 px-3 rounded-lg text-sm font-medium whitespace-nowrap ${activeTab === 'leagues' ? 'bg-red-600 text-white' : 'text-gray-600'}`}
        >
          Ligas
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 min-w-0 py-2 px-3 rounded-lg text-sm font-medium whitespace-nowrap ${activeTab === 'history' ? 'bg-red-600 text-white' : 'text-gray-600'}`}
        >
          Histórico
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
              <div key={t.id} className="card overflow-hidden p-0 flex">
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
                    <div className="text-sm text-gray-600 mt-2 line-clamp-3 flex-1 [&_p]:my-0 [&_p]:last:mb-0" dangerouslySetInnerHTML={{ __html: t.description }} />
                  )}
                  {isEnrolled ? (
                    <button
                      type="button"
                      onClick={() => viewEnrolled(t.id, t.name)}
                      className="mt-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition-colors w-fit"
                    >
                      <Users className="w-4 h-4" />
                      Ver inscritos por categoria
                    </button>
                  ) : (
                    <a
                      href={getTournamentRegistrationUrl(t.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition-colors w-fit"
                    >
                      Link de inscrição
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            )
            return (enrolledList.length > 0 || openList.length > 0) ? (
              <div className="space-y-6">
                {enrolledList.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      Torneios onde já estás inscrito
                    </h2>
                    <div className="space-y-4">
                      {enrolledList.map((t) => (
                        <TournamentCard key={t.id} t={t} isEnrolled={true} />
                      ))}
                    </div>
                  </div>
                )}
                {openList.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Torneios abertos à inscrição
                    </h2>
                    <div className="space-y-4">
                      {openList.map((t) => (
                        <TournamentCard key={t.id} t={t} isEnrolled={false} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="card p-8 text-center text-gray-500">
                Nenhum torneio próximo do clube. Consulta a Padel One Tour para mais torneios.
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
              <p className="text-sm text-gray-400 mt-1">Inscreve-te em torneios associados a ligas na Padel One Tour.</p>
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
              {d.pastTournaments.map((t) => {
                const details = pastTournamentDetails[t.id]
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
                          <span className="text-xs text-gray-400 animate-pulse flex-shrink-0">A carregar...</span>
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
                              return (
                              <div key={m.id} className="flex justify-between items-center text-sm py-2 px-3 bg-gray-50 rounded-lg">
                                <span className="text-gray-700 truncate flex-1 mr-2">
                                  {m.team1_name} vs {m.team2_name}
                                </span>
                                <span className="font-semibold text-gray-900 flex-shrink-0">
                                  {scoreDisplay}
                                </span>
                                {m.is_winner !== undefined && (
                                  <span className={`ml-2 text-xs font-medium flex-shrink-0 ${m.is_winner ? 'text-green-600' : 'text-red-600'}`}>
                                    {m.is_winner ? 'V' : 'D'}
                                  </span>
                                )}
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
                                <th className="py-1.5 px-1 text-left font-medium w-6">#</th>
                                <th className="py-1.5 px-1 text-left font-medium">Nome</th>
                                <th className="py-1.5 px-1 text-center font-medium w-6">V</th>
                                <th className="py-1.5 px-1 text-center font-medium w-6">E</th>
                                <th className="py-1.5 px-1 text-center font-medium w-6">D</th>
                                <th className="py-1.5 px-1 text-center font-medium w-8">+/-</th>
                                <th className="py-1.5 px-1 text-center font-semibold w-7">Pts</th>
                              </tr>
                            </thead>
                            <tbody>
                              {details.standings.map((row, i) => {
                                const diff = (row.points_for ?? 0) - (row.points_against ?? 0)
                                const hasPlayers = row.player1_name || row.player2_name
                                return (
                                  <tr key={row.id} className={`border-b border-gray-50 ${details.playerPosition === i + 1 ? 'bg-red-50 font-semibold' : ''}`}>
                                    <td className="py-1.5 px-1">{i + 1}</td>
                                    <td className="py-1.5 px-1">
                                      <div className="font-medium truncate max-w-[120px]">{row.name}</div>
                                      {hasPlayers && (
                                        <div className="text-xs text-gray-500 truncate max-w-[120px]">
                                          {[row.player1_name, row.player2_name].filter(Boolean).join(' / ')}
                                        </div>
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
                          <td className="px-2 py-2 truncate max-w-[180px]">
                            <span className={row.is_current_player ? 'font-bold text-gray-900 text-base' : 'font-medium'}>{row.entity_name}</span>
                            {row.is_current_player && <span className="ml-1 text-xs bg-red-600 text-white px-1.5 py-0.5 rounded font-semibold">Tu</span>}
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
                          {m.is_winner !== undefined && <span className={`block text-xs mt-1 ${m.is_winner ? 'text-green-600' : 'text-red-600'}`}>{m.is_winner ? 'Vitória' : 'Derrota'}</span>}
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

function GamesScreen({
  player,
  dashboardData,
  onRefresh,
}: {
  player: PlayerAccount | null
  dashboardData: PlayerDashboardData | null
  onRefresh: () => Promise<void>
}) {
  void onRefresh
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming')
  const d = dashboardData
  const upcoming = d?.upcomingMatches ?? []
  const recent = d?.recentMatches ?? []
  const list = activeTab === 'upcoming' ? upcoming : recent

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900">Jogos</h1>

      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'upcoming' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          Próximos
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          Histórico
        </button>
      </div>

      {list.length > 0 ? (
        <div className="space-y-3">
          {list.map((match) => (
            <div key={match.id} className="w-full">
              <GameCardPlaytomic match={match} fullWidth currentPlayerAvatar={player?.avatar_url} currentPlayerName={player?.name} />
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
}: {
  targetUserId: string
  myUserId: string
  onBack: () => void
  onOpenFollowsList: (userId: string) => void
}) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)

  useEffect(() => {
    setLoading(true)
    getPlayerProfile(targetUserId, myUserId).then((p) => {
      setProfile(p)
      setIsFollowing(p?.isFollowedByMe ?? false)
      setLoading(false)
    })
  }, [targetUserId, myUserId])

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

  const getHandLabel = (h?: string) => ({ right: 'Direita', left: 'Esquerda', ambidextrous: 'Ambidestro' }[h || ''] || '—')
  const getPositionLabel = (p?: string) => ({ right: 'Direita', left: 'Esquerda', both: 'Ambas' }[p || ''] || '—')
  const getGameTypeLabel = (g?: string) => ({ competitive: 'Competitivo', friendly: 'Amigável', both: 'Ambos' }[g || ''] || '—')
  const getTimeLabel = (t?: string) => ({ morning: 'Manhã', afternoon: 'Tarde', evening: 'Noite', all_day: 'Dia todo' }[t || ''] || '—')

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
      <div className="rounded-xl shadow-sm overflow-hidden p-6 bg-gradient-to-br from-red-50 to-red-100">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-5xl font-bold text-red-600">Nível {profile.level?.toFixed(1) || '3.0'}</p>
            <p className="text-sm text-gray-600 mt-2 flex items-center gap-1.5">
              <span>📊</span> Fiabilidade {profile.level_reliability_percent?.toFixed(0) ?? '85'}%
            </p>
          </div>
          <div className="flex flex-col gap-2 self-start">
            {profile.player_category && (
              <div className={`px-4 py-2 rounded-lg shadow-sm ${colors.bg}`}>
                <span className={`text-sm font-bold ${colors.text}`}>{profile.player_category}</span>
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
                    currentPlayerName={profile.name}
                    currentPlayerAvatar={profile.avatar_url}
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
          Jogadores com quem mais joga
        </h2>
        {profile.topPlayers.length > 0 ? (
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth">
            <div className="flex gap-3" style={{ width: 'max-content' }}>
              {profile.topPlayers.map(({ name, count }) => {
                const { firstName, lastName } = splitName(name)
                return (
                <div key={name} className="snap-center flex-shrink-0 w-[100px] card p-3 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center mx-auto mb-2">
                    <span className="text-white font-bold text-sm">{getInitials(name)}</span>
                  </div>
                  <p className="font-semibold text-gray-900 text-xs leading-tight">{firstName}</p>
                  {lastName && <p className="font-semibold text-gray-900 text-xs leading-tight">{lastName}</p>}
                  <p className="text-[10px] text-gray-500 mt-1">{count} jogos</p>
                </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="card p-4 text-center">
            <p className="text-sm text-gray-500">Sem dados de parceiros de jogo</p>
          </div>
        )}
      </div>

      {/* Clube favorito */}
      {profile.favoriteClub && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-red-600" />
            Clube favorito
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
}: {
  player: PlayerAccount | null
  dashboardData: PlayerDashboardData | null
  userId: string | null
  onOpenGames: () => void
  onOpenFollowsList: (userId: string) => void
}) {
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
  const getTimeLabel = (t?: string) => ({ morning: 'Manhã', afternoon: 'Tarde', evening: 'Noite', all_day: 'Dia todo' }[t || ''] || '—')

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
      <div className="rounded-xl shadow-sm overflow-hidden p-6 bg-gradient-to-br from-red-50 to-red-100">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-5xl font-bold text-red-600">Nível {player?.level?.toFixed(1) || '3.0'}</p>
            <p className="text-sm text-gray-600 mt-2 flex items-center gap-1.5">
              <span>📊</span> Fiabilidade {player?.level_reliability_percent?.toFixed(0) ?? '85'}%
            </p>
          </div>
          <div className="flex flex-col gap-2 self-start">
            {player?.player_category && (
              <div className="px-4 py-2 bg-blue-500 rounded-lg shadow-sm">
                <span className="text-sm font-bold text-white">{player.player_category}</span>
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

      {/* 5 Últimos Jogos - Resultados Recentes (igual à Home) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>📊</span> Resultados Recentes
          </h2>
          {recentMatches.length > 0 && (
            <button onClick={onOpenGames} className="text-red-600 text-sm font-medium flex items-center gap-1">
              Ver todos <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
        {recentMatches.length > 0 ? (
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth games-horizontal-scroll">
            <div className="flex gap-4" style={{ width: 'max-content' }}>
              {recentMatches.map((match) => (
                <div key={match.id} className="snap-center">
                  <GameCardPlaytomic match={match} currentPlayerAvatar={player?.avatar_url} currentPlayerName={player?.name} />
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
          Jogadores com quem mais joga
        </h2>
        {topPlayers.length > 0 ? (
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth">
            <div className="flex gap-3" style={{ width: 'max-content' }}>
              {topPlayers.map(({ name, count }) => {
                const { firstName, lastName } = splitName(name)
                return (
                <div key={name} className="snap-center flex-shrink-0 w-[100px] card p-3 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center mx-auto mb-2">
                    <span className="text-white font-bold text-sm">{getInitials(name)}</span>
                  </div>
                  <p className="font-semibold text-gray-900 text-xs leading-tight">{firstName}</p>
                  {lastName && <p className="font-semibold text-gray-900 text-xs leading-tight">{lastName}</p>}
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
          Clubes onde joga {player?.name?.split(' ')[0] || 'o jogador'}
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
      setSaveMsg('A imagem deve ter no máximo 1MB')
      setTimeout(() => setSaveMsg(''), 3000)
      return
    }

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      setSaveMsg('O ficheiro deve ser uma imagem')
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
      setSaveMsg('Foto atualizada!')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (err) {
      console.error('[AVATAR] Upload error:', err)
      setSaveMsg('Erro ao carregar foto')
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
    if (!editName.trim()) missing.push('Nome')
    if (!editEmail.trim()) missing.push('Email')
    if (!editGender) missing.push('Género')
    if (!editBirthDate) missing.push('Data de Nascimento')
    if (!editLocation.trim()) missing.push('Localização')
    if (!editHand) missing.push('Mão Preferida')
    if (!editPosition) missing.push('Posição em Campo')
    if (!editGameType) missing.push('Tipo de Jogo Preferido')
    if (!editPreferredTime) missing.push('Horário de Jogo Preferido')

    if (missing.length > 0) {
      setSaveMsg(`Preenche os campos obrigatórios: ${missing.join(', ')}`)
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
      setSaveMsg('Perfil guardado!')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch {
      setSaveMsg('Erro ao guardar')
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
        <h2 className="text-xl font-bold text-gray-900 mt-3">{player?.name || 'Jogador'}</h2>
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
        <div className={`text-center text-sm font-medium py-2 px-4 rounded-lg ${saveMsg.includes('Erro') || saveMsg.includes('obrigatórios') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
          {saveMsg}
        </div>
      )}

      {/* Profile Edit Section - Sempre aberto */}
      <div className="card p-4 space-y-4">
            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome <span className="text-red-600">*</span></label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                placeholder="O teu nome"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                placeholder="email@exemplo.com"
              />
            </div>

            {/* Género */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Género <span className="text-red-600">*</span></label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'male', label: 'Masculino' },
                  { value: 'female', label: 'Feminino' },
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento <span className="text-red-600">*</span></label>
              <input
                type="date"
                value={editBirthDate}
                onChange={(e) => setEditBirthDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
              />
            </div>

            {/* Localização */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Localização <span className="text-red-600">*</span></label>
              <input
                type="text"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                placeholder="Cidade ou região"
              />
            </div>

            {/* Mão Preferida */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mão Preferida <span className="text-red-600">*</span></label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'right', label: 'Direita' },
                  { value: 'left', label: 'Esquerda' },
                  { value: 'ambidextrous', label: 'Ambidestro' },
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Posição em Campo <span className="text-red-600">*</span></label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'right', label: 'Direita' },
                  { value: 'left', label: 'Esquerda' },
                  { value: 'both', label: 'Ambas' },
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Jogo Preferido <span className="text-red-600">*</span></label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'competitive', label: 'Competitivo' },
                  { value: 'friendly', label: 'Amigável' },
                  { value: 'both', label: 'Ambos' },
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Horário de Jogo Preferido <span className="text-red-600">*</span></label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 'morning', label: 'Manhã' },
                  { value: 'afternoon', label: 'Tarde' },
                  { value: 'evening', label: 'Noite' },
                  { value: 'all_day', label: 'Dia todo' },
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Sobre mim</label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
                placeholder="Uma breve descrição sobre ti..."
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
                  Guardar Perfil
                </>
              )}
            </button>
      </div>

      {/* Clube Favorito – lista de clubes Padel One */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-gray-900">Clube Favorito</h3>
          </div>
          <p className="text-sm text-gray-500 mt-1">Escolhe o teu clube na lista de clubes geridos pela Padel One.</p>
        </div>
        <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
          {loadingClubs ? (
            <div className="p-4 text-center text-gray-500">A carregar clubes...</div>
          ) : clubs.length === 0 ? (
            <div className="p-4 text-center text-gray-500">Nenhum clube disponível.</div>
          ) : (
            <>
              <button
                onClick={() => onSaveFavoriteClub(null)}
                className={`w-full p-4 flex items-center justify-between text-left ${!favoriteClubId ? 'bg-red-50' : 'hover:bg-gray-50'}`}
              >
                <span className="text-gray-600">Nenhum</span>
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

      {/* Admin: Rating Engine */}
      <RatingAdminPanel />
    </div>
  )
}

// ---------- Admin: Rating Engine Panel ----------
function RatingAdminPanel() {
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<{ processed: number; skipped: number; errors: number; total: number } | null>(null)

  const handleProcess2026 = async () => {
    if (processing) return
    setProcessing(true)
    setProgress('A carregar motor de rating...')
    setResult(null)

    try {
      const { processAllUnratedMatches } = await import('./lib/ratingEngine')
      setProgress('A processar jogos de 2026...')

      const res = await processAllUnratedMatches(
        '2026-01-01',
        (_current, _total, info) => setProgress(info)
      )

      setResult(res)
      setProgress(`Concluído! ${res.processed} jogos processados.`)
    } catch (err: any) {
      setProgress(`Erro: ${err.message}`)
      console.error('[RatingAdmin]', err)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="card p-5 border-2 border-dashed border-gray-300">
      <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-red-600" />
        Motor de Rating (Admin)
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        Processa jogos de torneios completados em 2026 e atualiza os níveis dos jogadores com o algoritmo ELO adaptado para Padel.
      </p>

      <button
        onClick={handleProcess2026}
        disabled={processing}
        className={`w-full py-3 rounded-lg font-semibold text-sm transition-colors ${
          processing
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
            : 'bg-red-600 text-white hover:bg-red-700'
        }`}
      >
        {processing ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            A processar...
          </span>
        ) : (
          'Atualizar Níveis (Jogos 2026)'
        )}
      </button>

      {progress && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600 font-mono">{progress}</p>
        </div>
      )}

      {result && (
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          <div className="p-2 bg-green-50 rounded-lg">
            <p className="text-lg font-bold text-green-600">{result.processed}</p>
            <p className="text-[10px] text-gray-500">Processados</p>
          </div>
          <div className="p-2 bg-yellow-50 rounded-lg">
            <p className="text-lg font-bold text-yellow-600">{result.skipped}</p>
            <p className="text-[10px] text-gray-500">Saltados</p>
          </div>
          <div className="p-2 bg-red-50 rounded-lg">
            <p className="text-lg font-bold text-red-600">{result.errors}</p>
            <p className="text-[10px] text-gray-500">Erros</p>
          </div>
          <div className="p-2 bg-gray-50 rounded-lg">
            <p className="text-lg font-bold text-gray-900">{result.total}</p>
            <p className="text-[10px] text-gray-500">Total</p>
          </div>
        </div>
      )}
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
