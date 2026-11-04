import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import {
  Bell,
  ChevronRight,
  Download,
  Globe,
  HelpCircle,
  LayoutDashboard,
  Mail,
  MonitorSmartphone,
  Smartphone,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import { useI18n } from '../lib/i18nContext'

/** Entrada real na PWA: o ecrã de login já usado pelo header («Entrar»). */
const PLAYER_APP_HREF = '/login'
/** Canal de contacto já usado na página de clubes. */
const CLUB_DEMO_HREF = `mailto:info@sportsevents.app?subject=${encodeURIComponent('Agendar Demonstração para o Clube')}`

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const metrics = [
  { value: '800+', label: 'Jogadores' },
  { value: '200+', label: 'Quadros de Torneio' },
  { value: '2+', label: 'Anos de Comunidade' },
]

const trustBadges = [
  { emoji: '📱', label: 'Instalação instantânea PWA (iOS & Android)' },
  { emoji: '📊', label: 'Algoritmo Elo Dinâmico' },
  { emoji: '🏆', label: 'Gestão Autónoma de Ligas e Torneios' },
]

function SectionEyebrow({ children, tone = 'emerald' }: { children: ReactNode; tone?: 'emerald' | 'cyan' }) {
  const color = tone === 'cyan' ? 'text-cyan-300' : 'text-emerald-300'
  return <p className={`text-sm font-semibold uppercase tracking-[0.18em] ${color}`}>{children}</p>
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto w-[min(100%,280px)]">
      <div className="absolute -inset-6 rounded-[3rem] bg-gradient-to-br from-emerald-400/20 via-transparent to-cyan-400/20 blur-2xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-[2.4rem] border border-slate-700 bg-slate-950 shadow-[0_30px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/10">
        <div className="absolute inset-x-0 top-0 z-10 flex justify-center pt-2.5" aria-hidden="true">
          <div className="h-6 w-28 rounded-full bg-black/90" />
        </div>
        <div className="aspect-[9/19.5] bg-gradient-to-b from-slate-900 to-slate-950 px-3 pb-4 pt-10">
          {children}
        </div>
        <div className="absolute bottom-2 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-white/25" aria-hidden="true" />
      </div>
    </div>
  )
}

function HeroAppPreview() {
  return (
    <PhoneFrame>
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Olá,</p>
            <p className="text-sm font-bold text-white">Carlota</p>
          </div>
          <div className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-400/30">
            Elo 4.2 · M4
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Jogos', value: '48' },
            { label: 'Vitórias', value: '31' },
            { label: '%', value: '65%' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-slate-800 bg-slate-900/70 p-2 text-center">
              <p className="text-sm font-black text-emerald-300">{stat.value}</p>
              <p className="text-[9px] text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold text-white">Próximo jogo</p>
            <span className="rounded-md bg-cyan-400/15 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300">Hoje 18:30</span>
          </div>
          <p className="text-[10px] text-slate-400">Albufeira Padel · Campo 2</p>
          <div className="mt-2 flex -space-x-2">
            {['A', 'B', 'C', '?'].map((letter, index) => (
              <div
                key={letter}
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-950 text-[10px] font-bold ${
                  index === 3 ? 'bg-emerald-400 text-slate-950' : 'bg-slate-700 text-white'
                }`}
              >
                {letter}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto grid grid-cols-4 gap-1 rounded-2xl border border-slate-800 bg-black/40 p-2">
          {['Home', 'Jogos', 'Compete', 'Perfil'].map((item, index) => (
            <div key={item} className={`rounded-xl px-1 py-1.5 text-center text-[9px] ${index === 0 ? 'bg-emerald-400/15 text-emerald-300' : 'text-slate-500'}`}>
              {item}
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  )
}

function EloProfileMock() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-300 text-sm font-black text-slate-950">
          RM
        </div>
        <div>
          <p className="text-sm font-bold text-white">Rui Mendes</p>
          <p className="text-xs text-slate-400">Albufeira · Fiabilidade 92%</p>
        </div>
        <span className="ml-auto rounded-lg bg-emerald-400/15 px-2.5 py-1 text-xs font-black text-emerald-300 ring-1 ring-emerald-400/30">
          M4
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Nível Elo</p>
          <p className="text-3xl font-black text-white">4.20</p>
          <p className="text-xs font-semibold text-emerald-300">+0.12 últimos 5 jogos</p>
        </div>
        <svg viewBox="0 0 140 56" className="h-14 w-36 overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id="eloLine" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
          <path d="M4 42 L28 36 L52 40 L76 24 L100 18 L136 8" fill="none" stroke="url(#eloLine)" strokeWidth="3" strokeLinecap="round" />
          <circle cx="136" cy="8" r="4" fill="#22d3ee" />
        </svg>
      </div>
      <div className="mt-4 flex gap-2">
        {['M5', 'M4', 'M3'].map((badge, index) => (
          <span
            key={badge}
            className={`rounded-md px-2 py-1 text-[10px] font-bold ${
              index === 1 ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {badge}
          </span>
        ))}
      </div>
    </div>
  )
}

function PushNotificationMock() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
      <div className="rounded-2xl border border-emerald-400/20 bg-slate-900/90 p-3 shadow-[0_0_30px_rgba(16,185,129,0.12)]">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400 text-slate-950">
            <Bell className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white">Padel One</p>
            <p className="text-[10px] text-slate-500">agora · Push</p>
          </div>
        </div>
        <p className="text-sm font-semibold leading-snug text-slate-100">
          Falta 1 jogador de nível M4 para hoje às 18h30. Queres entrar?
        </p>
        <div className="mt-3 flex gap-2">
          <span className="rounded-lg bg-emerald-400 px-3 py-1.5 text-[11px] font-bold text-slate-950">Entrar</span>
          <span className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-300">Mais tarde</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
          <p className="font-semibold text-white">Matchmaking</p>
          <p className="mt-1 text-slate-400">Nível idêntico no Algarve</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
          <p className="font-semibold text-white">Sem WhatsApp</p>
          <p className="mt-1 text-slate-400">Alertas na app / PWA</p>
        </div>
      </div>
    </div>
  )
}

function TournamentBoardMock() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold text-white">Americano M4 · Quadro</p>
        <span className="rounded-md bg-cyan-400/15 px-2 py-0.5 text-[10px] font-bold text-cyan-300">Ao vivo</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          {['Semi A', 'Semi B'].map((label, index) => (
            <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/80 p-2">
              <p className="text-[9px] uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-[11px] font-semibold text-white">{index === 0 ? 'Dupla 1 vs 4' : 'Dupla 2 vs 3'}</p>
            </div>
          ))}
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-2">
            <p className="text-[9px] uppercase tracking-wide text-emerald-300">Final</p>
            <p className="mt-1 text-[11px] font-semibold text-white">Vencedores</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-2">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Classificação</p>
          {[
            ['1.', 'Team Nova', '18'],
            ['2.', 'Algarve Duo', '15'],
            ['3.', 'Court Kings', '12'],
          ].map(([pos, name, pts]) => (
            <div key={name} className="mb-1.5 flex items-center justify-between text-[11px] last:mb-0">
              <span className="text-slate-300"><span className="font-bold text-emerald-300">{pos}</span> {name}</span>
              <span className="font-bold text-white">{pts}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ClubModuleVisual({ variant }: { variant: 'manager' | 'courts' | 'tournaments' | 'community' }) {
  if (variant === 'manager') {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
        <div className="mb-3 flex items-center gap-2">
          <LayoutDashboard className="h-4 w-4 text-cyan-300" />
          <p className="text-xs font-bold text-white">Painel de reservas</p>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {['09', '10', '11', '12', '13', '14', '15', '16'].map((hour, index) => (
            <div
              key={hour}
              className={`rounded-md px-1 py-2 text-center text-[10px] font-semibold ${
                index === 2 || index === 5
                  ? 'bg-emerald-400 text-slate-950'
                  : index === 3
                    ? 'bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/30'
                    : 'bg-slate-900 text-slate-400'
              }`}
            >
              {hour}h
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-slate-400">Receção + reservas online no mesmo ecrã.</p>
      </div>
    )
  }

  if (variant === 'courts') {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
        <div className="rounded-xl border border-cyan-400/20 bg-gradient-to-br from-slate-900 to-slate-950 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wide text-cyan-300">Campo 3 · Live</p>
            <MonitorSmartphone className="h-4 w-4 text-cyan-300" />
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-[10px] text-slate-400">Equipa A</p>
              <p className="text-3xl font-black text-white">6</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400">Equipa B</p>
              <p className="text-3xl font-black text-emerald-300">4</p>
            </div>
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-500">Placar digital + botão de pontuação</p>
        </div>
      </div>
    )
  }

  if (variant === 'tournaments') {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
        <p className="mb-2 text-xs font-bold text-white">Geração automática</p>
        <div className="space-y-2">
          {[
            'Grupos A–D criados',
            'Horários por campo',
            'Eliminatórias publicadas',
          ].map((item, index) => (
            <div key={item} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/15 text-[10px] font-black text-emerald-300">
                {index + 1}
              </span>
              <span className="text-[11px] text-slate-200">{item}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Users className="h-4 w-4 text-emerald-300" />
        <p className="text-xs font-bold text-white">Rede ativa · Algarve</p>
      </div>
      <div className="flex -space-x-2">
        {['JM', 'AL', 'CR', 'TS', 'MK', '+'].map((initials, index) => (
          <div
            key={initials}
            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-950 text-[10px] font-bold ${
              index === 5 ? 'bg-cyan-400 text-slate-950' : 'bg-slate-700 text-white'
            }`}
          >
            {initials}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        Centenas de jogadores registados para encher campos em horários de menor ocupação.
      </p>
    </div>
  )
}

const playerSteps = [
  {
    step: 'Passo 1',
    title: 'Avaliação & Elo Inicial',
    description:
      'O sistema atribui o teu nível real com base nos resultados dos jogos. Começas com uma avaliação e o Elo ajusta-se automaticamente — com badge de categoria (M5 / M4 / M3) sempre à vista.',
    visual: <EloProfileMock />,
  },
  {
    step: 'Passo 2',
    title: 'Encontrar Jogo & Matchmaking Automático',
    description:
      'Procura parceiros e adversários de nível idêntico na região do Algarve sem grupos de WhatsApp. Quando falta um jogador, a PWA envia um alerta instantâneo para o telemóvel.',
    visual: <PushNotificationMock />,
  },
  {
    step: 'Passo 3',
    title: 'Inscrições em Torneios & Rankings em Tempo Real',
    description:
      'Consulta calendários de torneios, quadros de jogos, horários e classificações atualizadas na hora — tudo na mesma app.',
    visual: <TournamentBoardMock />,
  },
]

const clubModules = [
  {
    icon: LayoutDashboard,
    title: 'Padel1 Manager',
    subtitle: 'Gestão Total de Campos & Reservas',
    description:
      'Fim dos mapas em papel e das mensagens no WhatsApp. Painel de controlo completo para receção e reservas online automatizadas.',
    visual: 'manager' as const,
  },
  {
    icon: MonitorSmartphone,
    title: 'Smart Courts & Placares Digitais',
    subtitle: 'Hardware + Software',
    description:
      'Integração com ecrãs no clube, placares digitais de campo e botões de pontuação para transmissão e experiência profissional dos atletas.',
    visual: 'courts' as const,
  },
  {
    icon: Trophy,
    title: 'Organização Autónoma de Torneios e Ligas',
    subtitle: 'Quadros e horários automáticos',
    description:
      'Criação automática de grupos de fase de grupos, quadros eliminatórios, distribuição de horários por campo e atualização dinâmica dos resultados.',
    visual: 'tournaments' as const,
  },
  {
    icon: Users,
    title: 'Comunidade Ativa do Algarve',
    subtitle: 'Rede de jogadores registados',
    description:
      'Acesso direto a uma rede de centenas de jogadores registados e ativos na região para encher campos em horários de menor ocupação.',
    visual: 'community' as const,
  },
]

export default function PlayerLandingPage({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  const { t, language, setLanguage, languageFlags } = useI18n()
  const l = t.landing as Record<string, string>

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [showLangPicker, setShowLangPicker] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      const dismissed = sessionStorage.getItem('pwa_install_dismissed')
      if (!dismissed) {
        setTimeout(() => setShowInstallBanner(true), 2000)
      }
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowInstallBanner(false)
    }
    setDeferredPrompt(null)
  }

  const dismissInstall = () => {
    setShowInstallBanner(false)
    sessionStorage.setItem('pwa_install_dismissed', '1')
  }

  const openPlayerApp = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    onLogin()
  }

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100">
      {showInstallBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-[60] animate-slide-up">
          <div className="mx-auto max-w-lg p-4">
            <div className="rounded-2xl border border-white/10 bg-[#101826] p-5 shadow-2xl">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400">
                  <Download className="h-6 w-6 text-slate-950" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white">{l.installTitle}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">{l.installDesc}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={handleInstall}
                      className="rounded-xl bg-emerald-400 px-5 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-300"
                    >
                      {l.installButton}
                    </button>
                    <button
                      type="button"
                      onClick={dismissInstall}
                      className="px-4 py-2 text-sm font-medium text-slate-400 transition hover:text-white"
                    >
                      {l.installLater}
                    </button>
                  </div>
                </div>
                <button type="button" onClick={dismissInstall} className="text-slate-500 hover:text-white" aria-label={l.installLater}>
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 border-b border-slate-800 bg-[#070b12]/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <a href="/" className="flex min-w-0 items-center gap-2">
            <img src="/icon.png" alt="Padel One" className="h-9 w-9 rounded-xl" />
            <span className="truncate text-sm font-bold tracking-tight text-white sm:text-lg">PADEL ONE</span>
          </a>
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Principal">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLangPicker(!showLangPicker)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white sm:px-3"
                aria-expanded={showLangPicker}
                aria-label={t.login.chooseLanguage}
              >
                <Globe className="h-4 w-4" />
                <span>{languageFlags[language]}</span>
              </button>
              {showLangPicker && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[120px] rounded-xl border border-slate-800 bg-slate-900 py-1 shadow-lg">
                  {(['pt', 'en', 'es', 'fr'] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => { setLanguage(lang); setShowLangPicker(false) }}
                      className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-white/5 ${language === lang ? 'font-bold text-emerald-300' : 'text-slate-200'}`}
                    >
                      <span>{languageFlags[lang]}</span>
                      <span>{lang.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onLogin}
              className="px-2 py-2 text-sm font-semibold text-slate-200 transition hover:text-white sm:px-3"
            >
              {l.footerLogin}
            </button>
            <button
              type="button"
              onClick={onRegister}
              className="rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-300 px-3 py-2 text-sm font-bold text-slate-950 transition hover:shadow-lg hover:shadow-emerald-500/20 sm:px-4"
            >
              {l.footerCreateAccount}
            </button>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -top-24 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="absolute right-0 top-32 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
        </div>
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-16 sm:pb-20 sm:pt-24 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-10 lg:pb-28 lg:pt-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
              <span className="text-sm font-medium text-emerald-200">Padel One · Algarve</span>
            </div>
            <h1 className="max-w-4xl text-4xl font-black leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
              <span className="block">A Nova Era do Padel no Algarve:</span>
              <span className="mt-2 block bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
                Sem WhatsApp, Sem Complicações.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg md:text-xl">
              A plataforma inteligente que liga jogadores pelo nível Elo real e automatiza a gestão de campos e torneios nos melhores clubes.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href={PLAYER_APP_HREF}
                onClick={openPlayerApp}
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-300 px-6 py-4 text-center text-base font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5 hover:shadow-emerald-400/30 sm:text-lg"
              >
                Entrar na App / Jogar Agora 🎾
              </a>
              <a
                href="#clubes"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/50 px-6 py-4 text-center text-base font-semibold text-white transition hover:border-cyan-300/40 hover:bg-slate-900 sm:text-lg"
              >
                Soluções para Clubes & Resorts 🏢
              </a>
            </div>
          </div>

          <div className="relative">
            <HeroAppPreview />
          </div>
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pb-14">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {trustBadges.map((badge) => (
              <div
                key={badge.label}
                className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3"
              >
                <span className="text-lg" aria-hidden="true">{badge.emoji}</span>
                <p className="text-sm font-medium leading-snug text-slate-200">{badge.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-label="Métricas" className="border-y border-slate-800 bg-slate-900/40">
        <div className="mx-auto grid max-w-6xl grid-cols-1 sm:grid-cols-3 sm:divide-x sm:divide-slate-800">
          {metrics.map((item) => (
            <div key={item.label} className="px-4 py-8 text-center sm:py-10">
              <p className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">{item.value}</span>
                {' '}
                <span className="text-xl font-semibold text-slate-200 sm:text-2xl">{item.label}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="jogadores" className="scroll-mt-20 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <SectionEyebrow>Jogadores</SectionEyebrow>
          <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-4xl">
            Como Funciona Para os Jogadores
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400">
            Da avaliação inicial ao ranking em tempo real — o percurso completo na PWA, sem complicações.
          </p>

          <div className="mt-12 space-y-6">
            {playerSteps.map((item, index) => (
              <article
                key={item.title}
                className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <div className={`grid items-center gap-0 lg:grid-cols-2 ${index % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''}`}>
                  <div className="border-b border-slate-800 p-6 sm:p-8 lg:border-b-0 lg:border-r">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-300">
                      {item.step}
                    </div>
                    <h3 className="text-2xl font-black text-white">{item.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">{item.description}</p>
                  </div>
                  <div className="bg-slate-950/40 p-6 sm:p-8">
                    {item.visual}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="clubes" className="scroll-mt-20 border-t border-slate-800 bg-[#0b1220] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <SectionEyebrow tone="cyan">Clubes & Resorts</SectionEyebrow>
          <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-4xl">
            Soluções Padel1 Manager & Smart Courts
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400">
            Quatro módulos para eliminar o caos operacional e encher os campos com a comunidade do Algarve.
          </p>

          <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {clubModules.map((module) => {
              const Icon = module.icon
              return (
                <article
                  key={module.title}
                  className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 transition hover:border-cyan-400/30"
                >
                  <div className="border-l-2 border-cyan-400/70 p-6 sm:p-7">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-400/20">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300/80">{module.subtitle}</p>
                    <h3 className="mt-2 text-xl font-black text-white">{module.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-400">{module.description}</p>
                    <div className="mt-5">
                      <ClubModuleVisual variant={module.visual} />
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          <div className="mt-12 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-black text-white">Pronto para digitalizar o teu clube?</h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
                  Escreve para{' '}
                  <a href="mailto:info@sportsevents.app" className="font-medium text-cyan-300 underline-offset-2 hover:underline">
                    info@sportsevents.app
                  </a>
                  {' '}e marcamos uma demonstração do Padel One para o teu clube.
                </p>
              </div>
              <a
                href={CLUB_DEMO_HREF}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-center text-base font-bold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-50 sm:w-auto"
              >
                Agendar Demonstração para o Seu Clube →
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800 bg-[#05080e] py-12 text-slate-400">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-10 flex flex-col items-start justify-between gap-8 md:flex-row">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <img src="/icon.png" alt="Padel One" className="h-8 w-8 rounded-lg" />
                <span className="text-lg font-bold text-white">PADEL ONE</span>
              </div>
              <p className="max-w-xs text-sm leading-relaxed">
                A plataforma inteligente que liga jogadores pelo nível Elo real e automatiza a gestão de campos e torneios nos melhores clubes.
              </p>
            </div>
            <div className="flex flex-col gap-8 sm:flex-row">
              <div>
                <h4 className="mb-3 text-sm font-semibold text-white">{l.footerLinks}</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a href="https://padel1.app/help/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 transition hover:text-white">
                      <HelpCircle className="h-3.5 w-3.5" /> {l.footerHelpCenter}
                    </a>
                  </li>
                  <li>
                    <button type="button" onClick={onLogin} className="transition hover:text-white">{l.footerLogin}</button>
                  </li>
                  <li>
                    <button type="button" onClick={onRegister} className="transition hover:text-white">{l.footerCreateAccount}</button>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="mb-3 text-sm font-semibold text-white">{l.footerContact}</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a href="mailto:info@sportsevents.app" className="inline-flex items-center gap-1 transition hover:text-white">
                      <Mail className="h-3.5 w-3.5" /> info@sportsevents.app
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="mb-3 text-sm font-semibold text-white">{l.footerForClubs}</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a href="/clubs" className="inline-flex items-center gap-1 transition hover:text-white">
                      <ChevronRight className="h-3.5 w-3.5" /> {l.footerClubsLink}
                    </a>
                  </li>
                  <li>
                    <a href="#clubes" className="inline-flex items-center gap-1 transition hover:text-white">
                      <ChevronRight className="h-3.5 w-3.5" /> Soluções para Clubes & Resorts
                    </a>
                  </li>
                  <li>
                    <a href="#jogadores" className="inline-flex items-center gap-1 transition hover:text-white">
                      <Smartphone className="h-3.5 w-3.5" /> Como funciona para jogadores
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Padel One. {l.footerRights}
          </div>
        </div>
      </footer>
    </div>
  )
}
