import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import de from './locales/de.json'
import zh from './locales/zh.json'
import hi from './locales/hi.json'
import pl from './locales/pl.json'
import sv from './locales/sv.json'

export const supportedLocaleOptions = [
  { code: 'en', labelKey: 'i18n.english' },
  { code: 'es', labelKey: 'i18n.spanish' },
  { code: 'fr', labelKey: 'i18n.french' },
  { code: 'de', labelKey: 'i18n.german' },
  { code: 'zh', labelKey: 'i18n.chinese' },
  { code: 'hi', labelKey: 'i18n.hindi' },
  { code: 'pl', labelKey: 'i18n.polish' },
  { code: 'sv', labelKey: 'i18n.swedish' },
]

export const supportedLocales = supportedLocaleOptions.map(({ code }) => code)

function detectLocale() {
  try {
    const saved = localStorage.getItem('locale')
    if (saved && supportedLocales.includes(saved)) return saved
  } catch (_) {}
  const nav = (typeof navigator !== 'undefined' && (navigator.language || navigator.userLanguage)) || 'en'
  const normalized = nav.toLowerCase()
  const match = supportedLocales.find((code) => normalized.startsWith(code))
  return match || 'en'
}

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages: { en, es, fr, de, zh, hi, pl, sv },
})

export default i18n
