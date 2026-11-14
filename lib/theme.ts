/**
 * Color theme chosen by the user. Saved per device (localStorage), so the phone and the computer can
 * differ. "system" follows the phone/OS light or dark setting, as the app did before this option.
 *
 * The page colors come from the CSS tokens in app/globals.css, switched by the data-theme attribute
 * on <html>. `themeScript` sets that attribute in <head> before the first paint (no flash of the
 * wrong theme) and keeps it in sync when the OS setting or another tab changes it.
 */

export type ThemePreference = 'system' | 'light' | 'neutral' | 'dark'
export type ResolvedTheme = Exclude<ThemePreference, 'system'>

export const THEME_STORAGE_KEY = 'finanzas-theme'
/** Fired on window after the preference changes in this tab ('storage' only fires in other tabs). */
export const THEME_CHANGE_EVENT = 'finanzas-theme-change'

export const THEME_OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: 'system', label: 'Automático', hint: 'Según tu teléfono' },
  { value: 'light', label: 'Claro', hint: 'Fondo blanco' },
  { value: 'neutral', label: 'Neutro', hint: 'Grises suaves, menos brillo' },
  { value: 'dark', label: 'Oscuro', hint: 'Fondo casi negro' },
]

/** Browser/status bar color of each theme: the --surface token, so it blends with the header. */
const BAR_COLORS: Record<ResolvedTheme, string> = {
  light: '#ffffff',
  neutral: '#e4e4e1',
  dark: '#151821',
}

function isPreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'neutral' || value === 'dark'
}

export function readThemePreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    return isPreference(saved) ? saved : 'system'
  } catch {
    return 'system'
  }
}

declare global {
  interface Window {
    __applyFinanzasTheme?: () => void
  }
}

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, preference)
    window.__applyFinanzasTheme?.()
  } catch {
    // Storage blocked: the choice still applies to this page until it is reloaded.
    document.documentElement.setAttribute(
      'data-theme',
      preference === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : preference
    )
  }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
}

/**
 * Inline <head> script (see app/layout.tsx). Plain ES5 so it runs before any bundle; it reads the
 * same key and colors as the functions above and exposes `__applyFinanzasTheme` for them.
 */
export const themeScript = `(function () {
  var KEY = ${JSON.stringify(THEME_STORAGE_KEY)};
  var BAR = ${JSON.stringify(BAR_COLORS)};
  var dark = window.matchMedia('(prefers-color-scheme: dark)');
  function apply() {
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    var theme = BAR.hasOwnProperty(saved) ? saved : (dark.matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
    meta.content = BAR[theme];
  }
  apply();
  window.__applyFinanzasTheme = apply;
  if (dark.addEventListener) dark.addEventListener('change', apply);
  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(); });
})();`
