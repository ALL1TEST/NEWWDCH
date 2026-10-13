// ============================================================
// Automation Language Configuration
// Provides a comprehensive, standardized list of supported languages
// with stable language codes, display labels, native names, and SERP parameters.
// ============================================================

export interface LanguageOption {
  code: string;
  name: string;
  nativeName?: string;
  serpCode: string; // 2-letter or standard code for search APIs (hl param)
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en-US', name: 'English (US)', serpCode: 'en' },
  { code: 'en-GB', name: 'English (UK)', serpCode: 'en' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', serpCode: 'ar' },
  { code: 'fr', name: 'French', nativeName: 'Français', serpCode: 'fr' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', serpCode: 'es' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', serpCode: 'de' },
  { code: 'pt-PT', name: 'Portuguese', nativeName: 'Português', serpCode: 'pt' },
  { code: 'pt-BR', name: 'Brazilian Portuguese', nativeName: 'Português (Brasil)', serpCode: 'pt' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', serpCode: 'it' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', serpCode: 'nl' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', serpCode: 'pl' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', serpCode: 'tr' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', serpCode: 'ru' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', serpCode: 'uk' },
  { code: 'zh-Hans', name: 'Chinese (Simplified)', nativeName: '简体中文', serpCode: 'zh-cn' },
  { code: 'zh-Hant', name: 'Chinese (Traditional)', nativeName: '繁體中文', serpCode: 'zh-tw' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', serpCode: 'ja' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', serpCode: 'ko' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', serpCode: 'hi' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', serpCode: 'bn' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', serpCode: 'ur' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', serpCode: 'id' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', serpCode: 'ms' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', serpCode: 'vi' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', serpCode: 'th' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', serpCode: 'sv' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', serpCode: 'no' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', serpCode: 'da' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', serpCode: 'fi' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', serpCode: 'el' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', serpCode: 'he' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', serpCode: 'ro' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', serpCode: 'cs' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', serpCode: 'hu' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', serpCode: 'sw' },
];

/**
 * Resolve a language code or legacy display name to a verified LanguageOption.
 * Defaults cleanly to English (US).
 */
export function resolveLanguage(input?: string | null): LanguageOption {
  if (!input) return SUPPORTED_LANGUAGES[0];

  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  // 1. Direct match by stable code (case-insensitive)
  const byCode = SUPPORTED_LANGUAGES.find((l) => l.code.toLowerCase() === lower);
  if (byCode) return byCode;

  // 2. Direct match by display name
  const byName = SUPPORTED_LANGUAGES.find((l) => l.name.toLowerCase() === lower);
  if (byName) return byName;

  // 3. Partial / prefix match
  const byPrefix = SUPPORTED_LANGUAGES.find((l) => {
    const codePrefix = l.code.split('-')[0].toLowerCase();
    return codePrefix === lower || l.name.toLowerCase().startsWith(lower);
  });
  if (byPrefix) return byPrefix;

  // 4. Fallback to English (US)
  return SUPPORTED_LANGUAGES[0];
}

/**
 * Returns strict editorial prompt instruction ensuring the language is adhered to.
 */
export function formatLanguagePromptInstruction(lang: LanguageOption): string {
  const nativePart = lang.nativeName ? ` (${lang.nativeName})` : '';
  return `LANGUAGE SPECIFICATION:
The output MUST be written completely and fluently in ${lang.name}${nativePart} (Code: ${lang.code}).
Ensure all article titles, headings, body text, FAQs, takeaways, and SEO metadata are composed naturally in ${lang.name} without awkward literal machine translations.`;
}

/**
 * Validates a country code if provided (allows empty for global/international targeting).
 * Valid non-empty codes are 2-letter ISO 3166-1 alpha-2 codes (e.g. US, GB, DE).
 */
export function isValidCountryCode(code?: string): boolean {
  if (!code || code.trim() === '') return true;
  return /^[A-Za-z]{2}$/.test(code.trim());
}
