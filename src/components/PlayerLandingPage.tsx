import { useEffect, useState, type MouseEvent } from 'react'
import {
  Activity,
  BarChart3,
  Bell,
  ChevronRight,
  Download,
  Globe,
  HelpCircle,
  Mail,
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

const playerFeatures = [
  {
    icon: Activity,
    title: 'Algoritmo Elo Dinâmico',
    description: 'jogos equilibrados com jogadores do nível real.',
  },
  {
    icon: Bell,
    title: 'PWA & Notificações Instantâneas',
    description: 'alertas no telemóvel quando falta 1 jogador.',
  },
  {
    icon: BarChart3,
    title: 'Rankings & Histórico',
    description: 'estatísticas detalhadas de cada partida.',
  },
]

const clubFeatures = [
  {
    icon: Smartphone,
    title: 'Padel1 Manager & Smart Courts',
    description: 'placares em campo, automação de reservas, fim do caos no WhatsApp.',
  },
  {
    icon: Trophy,
    title: 'Gestão de Torneios & Ligas',
    description: 'geração automática de quadros, horários e classificações.',
  },
  {
    icon: Users,
    title: 'Captação de Atletas',
    description: 'acesso direto à rede de jogadores ativos da região.',
  },
]

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Activity
  title: string
  description: string
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] transition duration-300 hover:border-emerald-400/40 hover:bg-white/[0.06]">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400/20 to-cyan-400/15 text-emerald-300 ring-1 ring-emerald-300/30">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-bold leading-snug text-white">
        {title}
        <span className="font-medium text-slate-400"> — {description}</span>
      </h3>
    </article>
  )
}

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

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070b12]/80 backdrop-blur-lg">
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
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[120px] rounded-xl border border-white/10 bg-[#101826] py-1 shadow-lg">
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
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 sm:pb-20 sm:pt-24 md:pb-28 md:pt-28">
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
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-center text-base font-semibold text-white transition hover:border-cyan-300/40 hover:bg-white/10 sm:text-lg"
            >
              Soluções para Clubes & Resorts 🏢
            </a>
          </div>
        </div>
      </section>

      <section aria-label="Métricas" className="border-y border-white/10 bg-white/[0.03]">
        <div className="mx-auto grid max-w-6xl grid-cols-1 sm:grid-cols-3 sm:divide-x sm:divide-white/10">
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
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Jogadores</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight text-white sm:text-4xl">
            Experiência do jogador
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {playerFeatures.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      <section id="clubes" className="scroll-mt-20 border-t border-white/10 bg-[#0b1220] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Clubes & Resorts</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight text-white sm:text-4xl">
            Soluções para clubes e resorts
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {clubFeatures.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
          <div className="mt-10">
            <a
              href={CLUB_DEMO_HREF}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-center text-base font-bold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-50 sm:w-auto sm:text-lg"
            >
              Agendar Demonstração para o Seu Clube →
            </a>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-400">
              Escreve para{' '}
              <a href="mailto:info@sportsevents.app" className="font-medium text-cyan-300 underline-offset-2 hover:underline">
                info@sportsevents.app
              </a>
              {' '}e marcamos uma demonstração do Padel One para o teu clube.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#05080e] py-12 text-slate-400">
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
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 text-center text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Padel One. {l.footerRights}
          </div>
        </div>
      </footer>
    </div>
  )
}
