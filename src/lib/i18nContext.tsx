import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { translations, Language, languageNames, languageFlags } from './translations'

type TranslationKey = keyof typeof translations.pt

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: typeof translations.pt
  languageNames: typeof languageNames
  languageFlags: typeof languageFlags
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Load from localStorage or default to Portuguese
    const saved = localStorage.getItem('padel1_language') as Language | null
    if (saved && (saved === 'pt' || saved === 'en' || saved === 'es' || saved === 'fr')) {
      return saved
    }
    return 'pt'
  })

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('padel1_language', lang)
  }

  useEffect(() => {
    localStorage.setItem('padel1_language', language)
  }, [language])

  const t = translations[language]

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, languageNames, languageFlags }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}
