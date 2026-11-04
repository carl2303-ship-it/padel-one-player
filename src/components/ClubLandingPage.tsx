import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import {
  Bot,
  Building2,
  Check,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  LayoutDashboard,
  Mail,
  MessageCircle,
  MonitorSmartphone,
  Smartphone,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'

const CONTACT_EMAIL = 'info@sportsevents.app'
const DEMO_HREF = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Agendar Demonstração — Clubes, Resorts & Organizadores')}`

const apps = [
  {
    name: 'Padel One Player',
    tagline: 'A app dos jogadores',
    url: 'https://padel1.app',
    icon: Smartphone,
    features: [
      'Reserva de campos online',
      'Encontrar jogos e jogadores',
      'Torneios e ligas',
      'Comunidade e feed social',
      'Sistema de recompensas',
      'Pagamentos integrados',
    ],
  },
  {
    name: 'Padel One Tour',
    tagline: 'Gestão de torneios para organizadores',
    url: 'https://tour.padel1.app',
    icon: Trophy,
    features: [
      'Americanos, Grupos, Eliminatórias',
      'Categorias e formatos flexíveis',
      'Geração automática de jogos',
      'Classificações e standings',
      'Sistema de ligas multi-torneio',
      'Exportação PDF de resultados',
    ],
  },
  {
    name: 'Padel One Manager',
    tagline: 'Gestão completa do clube',
    url: 'https://manager.padel1.app',
    icon: Building2,
    features: [
      'Gestão de campos e reservas',
      'Gestão de bar e contas',
      'Academia e tipos de aula',
      'Métricas e relatórios',
      'Precário público online',
      'Staff e permissões',
    ],
  },
]

const solutionModules = [
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
    title: 'Torneios & Ligas para Organizadores',
    subtitle: 'Padel1 Tour · Quadros automáticos',
    description:
      'Criação automática de grupos, eliminatórias, distribuição de horários por campo e atualização dinâmica dos resultados — para clubes, resorts e organizadores independentes.',
    visual: 'tournaments' as const,
  },
  {
    icon: Users,
    title: 'Comunidade Ativa de Jogadores',
    subtitle: 'Rede de jogadores registados',
    description:
      'Acesso direto a uma rede de centenas de jogadores registados e ativos para encher campos e eventos em horários de menor ocupação, em qualquer região.',
    visual: 'community' as const,
  },
]

const MODULE_COLORS: Record<string, string> = {
  tournaments: 'from-emerald-400 to-cyan-400',
  manager: 'from-cyan-400 to-blue-400',
  bar: 'from-amber-400 to-orange-400',
  ai_full: 'from-violet-400 to-fuchsia-400',
  ai_light: 'from-purple-400 to-violet-400',
}

const DEFAULT_MODULES = [
  {
    code: 'tournaments',
    name: 'Torneios',
    description: 'Criação e gestão de torneios com tour.padel1.app + app jogador lite',
    price_monthly: 19.99,
    price_annual: 199.99,
    target_types: ['club', 'organizer'],
    requires_modules: [],
    landing_features: [
      'Gestão completa de torneios',
      'Americanos, grupos, eliminatórias',
      'Ligas multi-torneio',
      'Inscrições online com pagamento',
      'App jogador lite para participantes',
    ],
  },
  {
    code: 'manager',
    name: 'Gestão de Clube & Academia',
    description: 'manager.padel1.app para gerir clube e academia + app jogador completa',
    price_monthly: 49.99,
    price_annual: 499.99,
    target_types: ['club'],
    requires_modules: [],
    landing_features: [
      'Gestão de campos e reservas',
      'Academia e aulas',
      'Membros e planos de sócio',
      'Staff e permissões',
      'App jogador completa (padel1.app)',
    ],
  },
  {
    code: 'bar',
    name: 'Bar & Restaurante QR',
    description: 'Gestão de bar/restaurante com menu QR Code para clientes',
    price_monthly: 14.99,
    price_annual: 149.99,
    target_types: ['club'],
    requires_modules: [],
    landing_features: [
      'Gestão de menu e pedidos',
      'Contas e consumos',
      'Menu público com QR Code',
      'Relatórios de bar',
      'Integração com recompensas',
    ],
  },
  {
    code: 'ai_light',
    name: 'Agente IA Light',
    description: 'Respostas automáticas a FAQ e preços. Alerta admin em pedidos de reserva',
    price_monthly: 9.99,
    price_annual: 99.99,
    target_types: ['club', 'organizer'],
    requires_modules: [],
    landing_features: [
      'Respostas automáticas FAQ',
      'Informação de preços',
      'WhatsApp, Instagram, Facebook',
      'Chat no website',
      'Alerta admin para reservas',
    ],
  },
  {
    code: 'ai_full',
    name: 'Agente IA Completo',
    description: 'Reservas automáticas via WhatsApp, Instagram, Facebook e website (requer Manager)',
    price_monthly: 29.99,
    price_annual: 299.99,
    target_types: ['club'],
    requires_modules: ['manager'],
    landing_features: [
      'Reservas automáticas 24/7',
      'WhatsApp, Instagram, Facebook',
      'Chat no website',
      'Consulta de disponibilidade',
      'Confirmação automática',
    ],
  },
]

const DEFAULT_PACKS = [
  {
    code: 'light',
    name: 'Pack Light',
    tagline: 'Mantém a tua app de reservas actual',
    description: 'O plano perfeito para clubes e organizadores que querem ficar com a sua aplicação actual de Gestão de Reservas!',
    price_monthly: 89,
    price_annual: 990,
    compare_price_monthly: 129,
    compare_price_annual: 1548,
    landing_features: [
      'Módulo 1 — Tour + App Player Light',
      'Módulo 3 — Agente IA Light',
      'Módulo 4 — Gestão de Bar com QR Code',
    ],
    is_popular: false,
  },
  {
    code: 'total',
    name: 'Pack Padel One Total',
    tagline: 'Independência digital completa',
    description: 'A solução definitiva de independência digital. Substitui por completo qualquer software concorrente e automatiza a receção a 100% via Inteligência Artificial.',
    price_monthly: 149,
    price_annual: 1590,
    compare_price_monthly: 219,
    compare_price_annual: 2199,
    landing_features: [
      'TODOS OS MÓDULOS (1, 2, 3 e 4)',
      'Manager + App Player completa',
      'Gestão de Bar com QR Code',
      'Agente IA Completo — reserva automática de campos',
    ],
    is_popular: true,
  },
]

interface PlatformPack {
  code: string
  name: string
  tagline: string | null
  description: string | null
  price_monthly: number
  price_annual: number
  compare_price_monthly: number | null
  compare_price_annual: number | null
  landing_features: string[]
  is_popular: boolean
}

interface PlatformModule {
  code: string
  name: string
  description: string | null
  price_monthly: number | null
  price_annual: number | null
  target_types: string[]
  requires_modules: string[]
  landing_features: string[]
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">{children}</p>
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
          {['Grupos A–D criados', 'Horários por campo', 'Eliminatórias publicadas'].map((item, index) => (
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
        <p className="text-xs font-bold text-white">Rede ativa · Global</p>
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
        Centenas de jogadores registados para encher campos e eventos em qualquer região.
      </p>
    </div>
  )
}

export default function ClubLandingPage() {
  const [modules, setModules] = useState<PlatformModule[]>(DEFAULT_MODULES)
  const [packs, setPacks] = useState<PlatformPack[]>(DEFAULT_PACKS as PlatformPack[])
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')

  useEffect(() => {
    const load = async () => {
      const [modsRes, packsRes] = await Promise.all([
        supabase.rpc('get_active_modules_public'),
        supabase.rpc('get_active_packs_public'),
      ])

      if (modsRes.data && modsRes.data.length > 0) {
        setModules(modsRes.data.map((m: PlatformModule) => ({
          ...m,
          price_monthly: m.price_monthly != null ? Number(m.price_monthly) : null,
          price_annual: m.price_annual != null ? Number(m.price_annual) : null,
        })))
      }

      if (packsRes.data && packsRes.data.length > 0) {
        setPacks(packsRes.data.map((p: PlatformPack) => ({
          ...p,
          price_monthly: Number(p.price_monthly),
          price_annual: Number(p.price_annual),
          compare_price_monthly: p.compare_price_monthly != null ? Number(p.compare_price_monthly) : null,
          compare_price_annual: p.compare_price_annual != null ? Number(p.compare_price_annual) : null,
        })))
      }
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100">
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-[#070b12]/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <a href="/clubs" className="flex min-w-0 items-center gap-2">
            <img src="/icon.png" alt="Padel One" className="h-9 w-9 rounded-xl" />
            <span className="truncate text-sm font-bold tracking-tight text-white sm:text-lg">PADEL ONE</span>
            <span className="hidden rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-300 sm:inline">
              B2B
            </span>
          </a>
          <nav className="flex items-center gap-1 sm:gap-2">
            <a href="/" className="px-2 py-2 text-sm font-semibold text-slate-200 transition hover:text-white sm:px-3">
              Sou Jogador
            </a>
            <a
              href={DEMO_HREF}
              className="rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-300 px-3 py-2 text-sm font-bold text-slate-950 transition hover:shadow-lg hover:shadow-emerald-500/20 sm:px-4"
            >
              Contactar
            </a>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -top-24 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute right-0 top-32 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:pb-20 sm:pt-24 md:pb-24 md:pt-28">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1.5">
            <Building2 className="h-4 w-4 text-cyan-300" />
            <span className="text-sm font-medium text-cyan-100">Clubes, Resorts & Organizadores</span>
          </div>
          <h1 className="mx-auto max-w-4xl text-4xl font-black leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
            O universo{' '}
            <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
              Padel One
            </span>
            <br />
            para o teu clube, resort ou organização
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg md:text-xl">
            3 aplicações integradas para digitalizar reservas, torneios, bar, academia e comunidade — em qualquer parte do mundo.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row sm:items-center">
            <a
              href={DEMO_HREF}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-300 px-6 py-4 text-base font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5 sm:text-lg"
            >
              <Mail className="h-5 w-5" />
              Agendar Demonstração →
            </a>
            <a
              href="#solucoes"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/50 px-6 py-4 text-base font-semibold text-white transition hover:border-cyan-300/40 hover:bg-slate-900 sm:text-lg"
            >
              Ver soluções
            </a>
          </div>
        </div>
      </section>

      <section id="solucoes" className="scroll-mt-20 border-t border-slate-800 bg-[#0b1220] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <SectionEyebrow>Soluções</SectionEyebrow>
          <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-4xl">
            Soluções Padel1 Manager & Smart Courts
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400">
            Quatro módulos para eliminar o caos operacional de clubes, resorts e organizadores — e encher os campos com jogadores activos.
          </p>
          <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {solutionModules.map((module) => {
              const Icon = module.icon
              return (
                <article key={module.title} className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 transition hover:border-cyan-400/30">
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
        </div>
      </section>

      <section className="border-t border-slate-800 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <SectionEyebrow>Ecossistema</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">3 Apps, 1 Ecossistema</h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400">
            Cada aplicação resolve uma necessidade específica. Juntas, transformam a gestão do teu clube, resort ou organização.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {apps.map((app) => (
              <article key={app.name} className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-emerald-400/30">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20">
                  <app.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-black text-white">{app.name}</h3>
                <p className="mt-1 text-sm text-slate-400">{app.tagline}</p>
                <ul className="mt-5 space-y-2">
                  {app.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <a
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-cyan-300 transition hover:text-cyan-200"
                >
                  Abrir {app.name.split(' ').pop()}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 bg-[#0b1220] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-10 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/10 px-4 py-1.5">
              <Bot className="h-4 w-4 text-violet-300" />
              <span className="text-sm font-medium text-violet-200">Novo</span>
            </div>
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">AI Agent para o teu clube</h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-400">
              Um assistente inteligente que responde automaticamente a questões dos teus clientes, 24/7. Simplifica a vida do gerente e do organizador.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              {[
                { name: 'WhatsApp', desc: 'Responde automaticamente a mensagens dos clientes' },
                { name: 'Instagram', desc: 'Responde a DMs e comentários no Instagram do clube' },
                { name: 'Facebook', desc: 'Gere mensagens no Messenger do clube' },
                { name: 'Website', desc: 'Chat ao vivo no site do clube' },
              ].map((channel) => (
                <div key={channel.name} className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-400/15 text-violet-300">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{channel.name}</h4>
                    <p className="text-xs text-slate-400">{channel.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-3xl border border-violet-400/20 bg-slate-900/50 p-6 sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400 to-fuchsia-400 text-slate-950">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Padel One AI</h3>
                  <p className="text-sm text-slate-400">O teu assistente virtual</p>
                </div>
              </div>
              <ul className="space-y-3">
                {[
                  'Responde a perguntas sobre horários e disponibilidade',
                  'Informa sobre preços, aulas e torneios',
                  'Ajuda jogadores a fazer reservas',
                  'Disponível 24 horas por dia, 7 dias por semana',
                  'Aprende com os dados do teu clube',
                  'Reduz o trabalho manual do gerente em 80%',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-300">
                    <Zap className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <SectionEyebrow>Preços</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Módulos à la carte</h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400">
            Compra apenas o que precisas. Cada módulo pode ser ativado individualmente para o teu clube, resort ou organização.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {modules.map((mod) => (
              <article key={mod.code} className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50">
                <div className={`h-1.5 bg-gradient-to-r ${MODULE_COLORS[mod.code] || 'from-slate-500 to-slate-600'}`} />
                <div className="p-6">
                  <h3 className="text-xl font-bold text-white">{mod.name}</h3>
                  <p className="mt-2 min-h-[40px] text-sm text-slate-400">{mod.description}</p>
                  <div className="mt-4">
                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-black text-white">{mod.price_monthly}€</span>
                      <span className="mb-1 text-sm text-slate-500">/mês</span>
                    </div>
                    {mod.price_annual != null && (
                      <p className="mt-1 text-xs text-slate-500">ou {mod.price_annual}€/ano</p>
                    )}
                  </div>
                  {mod.requires_modules?.length > 0 && (
                    <p className="mt-3 text-xs text-amber-300">Requer: {mod.requires_modules.join(', ')}</p>
                  )}
                  <ul className="mt-5 space-y-2">
                    {(mod.landing_features || []).map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Interesse no módulo ${mod.name}`)}`}
                    className="mt-6 block rounded-xl bg-slate-800 py-3 text-center text-sm font-bold text-white transition hover:bg-slate-700"
                  >
                    Contactar
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 bg-[#0b1220] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <SectionEyebrow>Packs</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Packs — poupa vs módulos individuais</h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-400">
              Preferes um pacote completo? Os packs Light e Total incluem vários módulos a preço especial.
            </p>
            <div className="mt-8 inline-flex items-center rounded-xl border border-slate-700 bg-slate-900/70 p-1">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
                  billingCycle === 'monthly' ? 'bg-emerald-400 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Mensal
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
                  billingCycle === 'annual' ? 'bg-emerald-400 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Anual
              </button>
            </div>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
            {packs.map((pack) => {
              const price = billingCycle === 'monthly' ? pack.price_monthly : pack.price_annual
              const compare = billingCycle === 'monthly' ? pack.compare_price_monthly : pack.compare_price_annual
              const period = billingCycle === 'monthly' ? '/mês' : '/ano'
              const savings = compare && compare > price ? Math.round((1 - price / compare) * 100) : null

              return (
                <article
                  key={pack.code}
                  className={`relative overflow-hidden rounded-3xl border bg-slate-900/50 ${
                    pack.is_popular ? 'border-emerald-400/50 shadow-[0_0_40px_rgba(16,185,129,0.12)]' : 'border-slate-800'
                  }`}
                >
                  {pack.is_popular && (
                    <div className="bg-gradient-to-r from-emerald-400 to-cyan-300 py-1.5 text-center text-xs font-bold text-slate-950">
                      Mais Completo
                    </div>
                  )}
                  <div className="p-7 sm:p-8">
                    <h3 className="text-2xl font-black text-white">{pack.name}</h3>
                    {pack.tagline && <p className="mt-1 text-sm font-medium text-cyan-300">{pack.tagline}</p>}
                    <p className="mt-3 text-sm leading-relaxed text-slate-400">{pack.description}</p>
                    <div className="mt-6">
                      {compare != null && (
                        <p className="mb-1 text-sm text-slate-500 line-through">
                          {compare.toFixed(2).replace('.00', '')}€{period}
                          <span className="ml-2 text-xs no-underline">(módulos individuais)</span>
                        </p>
                      )}
                      <div className="flex items-end gap-1">
                        <span className="text-5xl font-black text-white">{price.toFixed(2).replace('.00', '')}€</span>
                        <span className="mb-2 text-sm text-slate-500">{period}</span>
                      </div>
                      {savings != null && billingCycle === 'monthly' && (
                        <p className="mt-1 text-xs font-semibold text-emerald-300">Poupa {savings}% vs módulos individuais</p>
                      )}
                    </div>
                    <ul className="mt-6 space-y-3">
                      {(pack.landing_features || []).map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <a
                      href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Interesse no ${pack.name}`)}`}
                      className={`mt-8 block rounded-xl py-4 text-center text-sm font-bold transition ${
                        pack.is_popular
                          ? 'bg-gradient-to-r from-emerald-400 to-cyan-300 text-slate-950 hover:shadow-lg hover:shadow-emerald-500/20'
                          : 'bg-slate-800 text-white hover:bg-slate-700'
                      }`}
                    >
                      Contactar — {pack.name}
                    </a>
                  </div>
                </article>
              )
            })}
          </div>
          <p className="mt-8 text-center text-sm text-slate-500">Preços sem IVA. Pagamento mensal ou anual via Stripe.</p>
        </div>
      </section>

      <section className="border-t border-slate-800 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-black text-white">Pronto para digitalizar o teu clube, resort ou organização?</h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
                  Escreve para{' '}
                  <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-cyan-300 underline-offset-2 hover:underline">
                    {CONTACT_EMAIL}
                  </a>
                  {' '}e marcamos uma demonstração do Padel One.
                </p>
              </div>
              <a
                href={DEMO_HREF}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-center text-base font-bold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-50 sm:w-auto"
              >
                Agendar Demonstração →
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
                O ecossistema completo para clubes, resorts e organizadores de padel. 3 aplicações, 1 plataforma integrada — em todo o mundo.
              </p>
            </div>
            <div className="flex flex-col gap-8 sm:flex-row">
              <div>
                <h4 className="mb-3 text-sm font-semibold text-white">Apps</h4>
                <ul className="space-y-2 text-sm">
                  <li><a href="https://padel1.app" target="_blank" rel="noopener noreferrer" className="transition hover:text-white">Player</a></li>
                  <li><a href="https://tour.padel1.app" target="_blank" rel="noopener noreferrer" className="transition hover:text-white">Tour</a></li>
                  <li><a href="https://manager.padel1.app" target="_blank" rel="noopener noreferrer" className="transition hover:text-white">Manager</a></li>
                </ul>
              </div>
              <div>
                <h4 className="mb-3 text-sm font-semibold text-white">Links</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a href="https://padel1.app/help/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 transition hover:text-white">
                      <HelpCircle className="h-3.5 w-3.5" /> Centro de Ajuda
                    </a>
                  </li>
                  <li>
                    <a href="/" className="transition hover:text-white">Sou Jogador</a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="mb-3 text-sm font-semibold text-white">Contacto</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex items-center gap-1 transition hover:text-white">
                      <Mail className="h-3.5 w-3.5" /> {CONTACT_EMAIL}
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Padel One. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  )
}
