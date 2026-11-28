// Phone numbers the way forms take them. Many forms split a number into a
// country code (a list or a flag picker) and the number itself: Workday,
// Greenhouse's newer boards, LinkedIn, Oracle. The number box then wants
// the national number alone, and the country code comes from the number,
// not from where the person lives.
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';
import { norm, US_NAMES } from './places';

export interface Phone {
  /** Digits of the national number, without the country code ("4695550101"). */
  national: string;
  /** The country calling code without "+" ("1", "254"). */
  calling: string;
  /** The number's country (ISO, "US"), when the number says. */
  region: string;
  /** The whole number for a single box ("+1 469 555 0101"). */
  international: string;
  ext: string;
}

/** The ISO code of a country name the details hold ("United States", "Kenya"), or undefined. */
function regionOf(country: string): CountryCode | undefined {
  const c = norm(country);
  if (!c) return undefined;
  if (US_NAMES.includes(c)) return 'US';
  try {
    const names = new Intl.DisplayNames(['en'], { type: 'region' });
    for (let a = 65; a <= 90; a++) {
      for (let b = 65; b <= 90; b++) {
        const code = String.fromCharCode(a, b);
        const name = names.of(code);
        if (name && name !== code && norm(name) === c) return code as CountryCode;
      }
    }
  } catch {
    // no region names in this browser
  }
  return undefined;
}

/**
 * The saved phone read as a number: from its own "+" code, else as a
 * number of the user's country. Null when it does not read as one.
 */
export function parsePhone(raw: string, country = ''): Phone | null {
  const text = raw.trim();
  if ((text.match(/\d/g) ?? []).length < 6) return null;
  const n = parsePhoneNumberFromString(text, text.startsWith('+') ? undefined : regionOf(country) ?? 'US');
  if (!n) return null;
  return {
    national: String(n.nationalNumber),
    calling: String(n.countryCallingCode),
    region: n.country ?? '',
    international: n.formatInternational(),
    ext: n.ext ?? '',
  };
}

/** The country's name in English for a region code ("US" is "United States"), or ''. */
export function countryName(region: string): string {
  if (!region) return '';
  if (region === 'US') return 'United States';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(region) ?? '';
  } catch {
    return '';
  }
}

/** Something next to a phone box that picks its country code: a list, a flag button, "+1". */
const CODE_WIDGET = 'select, [role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="true"], button, .iti__flag-container, .iti__selected-flag';

/** Whether the phone box shares its block with a country-code picker (Greenhouse's flag list, intl-tel-input). */
export function hasCodePicker(el: HTMLElement): boolean {
  let n: HTMLElement | null = el.parentElement;
  for (let depth = 0; n && depth < 3; depth++, n = n.parentElement) {
    const pickers = [...n.querySelectorAll<HTMLElement>(CODE_WIDGET)].filter((p) => p !== el && !p.contains(el));
    if (pickers.some((p) => /\+\s?\d{1,4}\b|country|dial|calling code|flag/i.test(`${p.textContent ?? ''} ${p.getAttribute('aria-label') ?? ''} ${p.className}`))) return true;
    if (n.querySelectorAll('input, textarea').length > 3) break; // the whole form, not the phone's block
  }
  return false;
}
