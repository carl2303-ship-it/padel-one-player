import { useState, useEffect } from 'react'
import {
  Calendar,
  Search,
  Trophy,
  Users,
  GraduationCap,
  Gift,
  TrendingUp,
  ChevronRight,
  HelpCircle,
  Mail,
  ArrowRight,
  Download,
  X,
  Globe,
} from 'lucide-react'
import { useI18n } from '../lib/i18nContext'

export default function PlayerLandingPage({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  const { t, language, setLanguage, languageFlags } = useI18n()
  const l = t.landing as Record<string, string>

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [showLangPicker, setShowLangPicker] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
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
    deferredPrompt.prompt()
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

  const featureIcons = [Calendar, Search, Trophy, Users, GraduationCap, Gift]
  const featureColors = [
    'from-blue-500 to-blue-600',
    'from-emerald-500 to-emerald-600',
    'from-amber-500 to-amber-600',
    'from-purple-500 to-purple-600',
    'from-rose-500 to-rose-600',
    'from-orange-500 to-orange-600',
  ]
  const features = Array.from({ length: 6 }, (_, i) => ({
    icon: featureIcons[i],
    title: l[`feat${i + 1}Title`],
    desc: l[`feat${i + 1}Desc`],
    color: featureColors[i],
  }))

  const steps = [
    { num: '1', title: l.step1Title, desc: l.step1Desc },
    { num: '2', title: l.step2Title, desc: l.step2Desc },
    { num: '3', title: l.step3Title, desc: l.step3Desc },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-[60] animate-slide-up">
          <div className="max-w-lg mx-auto p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                  <Download className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900">{l.installTitle}</h3>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">{l.installDesc}</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleInstall}
                      className="px-5 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition"
                    >
                      {l.installButton}
                    </button>
                    <button
                      onClick={dismissInstall}
                      className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition"
                    >
                      {l.installLater}
                    </button>
                  </div>
                </div>
                <button onClick={dismissInstall} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/icon.png" alt="Padel One" className="w-9 h-9 rounded-xl" />
            <span className="font-bold text-lg text-gray-900">PADEL ONE</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Language picker */}
            <div className="relative">
              <button
                onClick={() => setShowLangPicker(!showLangPicker)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition rounded-lg hover:bg-gray-100"
              >
                <Globe className="w-4 h-4" />
                <span>{languageFlags[language]}</span>
              </button>
              {showLangPicker && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[120px] z-50">
                  {(['pt', 'en', 'es', 'fr'] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => { setLanguage(lang); setShowLangPicker(false) }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${language === lang ? 'font-bold text-red-600' : 'text-gray-700'}`}
                    >
                      <span>{languageFlags[lang]}</span>
                      <span>{lang.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={onLogin}
              className="px-4 py-2 text-sm font-semibold text-gray-700 hover:text-gray-900 transition"
            >
              {l.footerLogin}
            </button>
            <button
              onClick={onRegister}
              className="px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-red-500 to-red-600 rounded-xl hover:shadow-lg hover:shadow-red-200 transition-all"
            >
              {l.footerCreateAccount}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-red-50 via-orange-50 to-amber-50">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-10 w-72 h-72 bg-red-200 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-orange-200 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-28 text-center">
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur rounded-full px-4 py-1.5 mb-6 border border-red-100">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-gray-700">{l.badge}</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-gray-900 leading-tight mb-6">
            {l.heroTitle1}{' '}
            <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
              {l.heroTitle2}
            </span>
            <br />
            {l.heroTitle3}
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            {l.heroDesc}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onRegister}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-bold text-white bg-gradient-to-r from-red-500 to-red-600 rounded-2xl hover:shadow-xl hover:shadow-red-200 transition-all hover:-translate-y-0.5"
            >
              {l.startNow}
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={onLogin}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-semibold text-gray-700 bg-white rounded-2xl border-2 border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all"
            >
              {l.alreadyHaveAccount}
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              {l.featuresTitle}
            </h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">
              {l.featuresSubtitle}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="group p-6 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                  <f.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              {l.howTitle}
            </h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">
              {l.howSubtitle}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.num} className="relative text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg">
                  <span className="text-2xl font-black text-white">{s.num}</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{s.title}</h3>
                <p className="text-gray-500 leading-relaxed">{s.desc}</p>
                {s.num !== '3' && (
                  <ChevronRight className="hidden md:block absolute top-8 -right-4 w-8 h-8 text-gray-300" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ELO System */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 md:p-14 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl" />
            <div className="relative flex flex-col md:flex-row items-center gap-10">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 mb-5">
                  <TrendingUp className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-semibold text-red-300">{l.eloSystem}</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-black mb-4 leading-tight">
                  {l.eloTitle}<br />{l.eloTitle2}
                </h2>
                <p className="text-gray-300 leading-relaxed mb-6">
                  {l.eloDesc}
                </p>
                <div className="flex flex-wrap gap-3">
                  {[l.eloTag1, l.eloTag2, l.eloTag3].map((tag) => (
                    <span key={tag} className="px-3 py-1.5 bg-white/10 rounded-lg text-sm font-medium text-gray-200">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0">
                <div className="w-48 h-48 bg-gradient-to-br from-red-500 to-orange-500 rounded-3xl flex flex-col items-center justify-center shadow-2xl">
                  <span className="text-5xl font-black">4.5</span>
                  <span className="text-sm font-semibold opacity-80 mt-1">{l.eloLevel}</span>
                  <div className="flex items-center gap-1 mt-2 bg-white/20 rounded-full px-3 py-1">
                    <TrendingUp className="w-3 h-3" />
                    <span className="text-xs font-bold">+0.3</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-red-500 to-orange-500">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-6">
            {l.ctaTitle}
          </h2>
          <p className="text-lg text-white/80 max-w-xl mx-auto mb-10">
            {l.ctaDesc}
          </p>
          <button
            onClick={onRegister}
            className="inline-flex items-center gap-2 px-10 py-4 text-lg font-bold text-red-600 bg-white rounded-2xl hover:shadow-xl transition-all hover:-translate-y-0.5"
          >
            {l.ctaButton}
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <img src="/icon.png" alt="Padel One" className="w-8 h-8 rounded-lg" />
                <span className="font-bold text-white text-lg">PADEL ONE</span>
              </div>
              <p className="text-sm max-w-xs leading-relaxed">
                {l.footerDesc}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-8">
              <div>
                <h4 className="font-semibold text-white text-sm mb-3">{l.footerLinks}</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a href="https://padel1.app/help/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition inline-flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5" /> {l.footerHelpCenter}
                    </a>
                  </li>
                  <li>
                    <button onClick={onLogin} className="hover:text-white transition">{l.footerLogin}</button>
                  </li>
                  <li>
                    <button onClick={onRegister} className="hover:text-white transition">{l.footerCreateAccount}</button>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm mb-3">{l.footerContact}</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a href="mailto:info@boostpadel.store" className="hover:text-white transition inline-flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> info@boostpadel.store
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm mb-3">{l.footerForClubs}</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a href="/clubs" className="hover:text-white transition inline-flex items-center gap-1">
                      <ChevronRight className="w-3.5 h-3.5" /> {l.footerClubsLink}
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 text-center text-xs text-gray-500">
            &copy; {new Date().getFullYear()} Padel One. {l.footerRights}
          </div>
        </div>
      </footer>
    </div>
  )
}
