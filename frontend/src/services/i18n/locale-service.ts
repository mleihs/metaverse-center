import { configureLocalization } from '@lit/localize';
import { sourceLocale, targetLocales } from '../../locales/generated/locale-codes.js';

// Load locale modules via static imports so Vite can resolve .js → .ts
function loadLocale(locale: string) {
  switch (locale) {
    case 'de':
      return import('../../locales/generated/de.js');
    default:
      return Promise.reject(new Error(`Unknown locale: ${locale}`));
  }
}

const { getLocale, setLocale: litSetLocale } = configureLocalization({
  sourceLocale,
  targetLocales,
  loadLocale,
});

const LOCALE_STORAGE_KEY = 'velg-locale';

class LocaleService {
  get currentLocale(): string {
    return getLocale();
  }

  get availableLocales(): string[] {
    return [sourceLocale, ...targetLocales];
  }

  async setLocale(locale: string): Promise<void> {
    if (locale === getLocale()) return;
    await litSetLocale(locale);
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }

  getInitialLocale(): string {
    // 1. User preference (localStorage)
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved && this.availableLocales.includes(saved)) return saved;

    // 2. Browser language
    const browserLang = navigator.language.split('-')[0];
    if (this.availableLocales.includes(browserLang)) return browserLang;

    // 3. Default
    return sourceLocale;
  }

  async initLocale(): Promise<void> {
    const locale = this.getInitialLocale();
    if (locale !== sourceLocale) {
      try {
        await this.setLocale(locale);
      } catch {
        // Fallback to source locale if loading fails
        console.warn(`Failed to load locale "${locale}", falling back to "${sourceLocale}"`);
      }
    }
  }
}

export const localeService = new LocaleService();
