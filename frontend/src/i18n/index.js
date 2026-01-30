import { createI18n } from 'vue-i18n';

const localeModules = import.meta.glob('./locales/*.json', { eager: true });

const messages = Object.fromEntries(
  Object.entries(localeModules).map(([path, mod]) => {
    const match = path.match(/\.\/locales\/(.*)\.json$/);
    if (!match) return [path, mod?.default ?? mod];
    return [match[1], mod?.default ?? mod];
  })
);

const preferredLocaleOrder = ['en', 'es', 'fr', 'de', 'it', 'ro', 'zh', 'hi', 'pl', 'sv', 'ru'];

export const supportedLocaleOptions = [
  ...preferredLocaleOrder.filter((code) => Object.prototype.hasOwnProperty.call(messages, code)),
  ...Object.keys(messages)
    .filter((code) => !preferredLocaleOrder.includes(code))
    .sort(),
].map((code) => ({ code }));

export const supportedLocales = supportedLocaleOptions.map(({ code }) => code);

function detectLocale(supportedLocales) {
  try {
    const saved = localStorage.getItem('locale');
    if (saved && supportedLocales.includes(saved)) return saved;
  } catch (_) {}

  const prefs =
    typeof navigator !== 'undefined' &&
    Array.isArray(navigator.languages) &&
    navigator.languages.length
      ? navigator.languages
      : [typeof navigator !== 'undefined' ? navigator.language : 'en'];

  const normalized = prefs
    .filter(Boolean)
    .map((l) => l.toLowerCase())
    .filter(Boolean);

  for (const p of normalized) {
    const base = p.split('-')[0];
    if (supportedLocales.includes(p)) return p;
    if (supportedLocales.includes(base)) return base;
  }

  return 'en';
}

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: detectLocale(supportedLocales),
  fallbackLocale: 'en',
  messages,
});

export default i18n;
