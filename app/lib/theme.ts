/**
 * Núcleo puro do tema claro/escuro/sistema — sem Vue, sem Nuxt, sem
 * `window`/`document`. `composables/useTheme.ts` é a casca fina que liga
 * isto ao DOM/localStorage/`matchMedia`; o script anti-flash (`app.vue`)
 * usa `themeAntiFlashScript()` para não duplicar a regra numa segunda
 * string escrita à mão.
 */

export const THEME_STORAGE_KEY = 'lunna:tema'

export const THEME_MODES = ['claro', 'escuro', 'sistema'] as const

export type ThemeMode = (typeof THEME_MODES)[number]
/** Padrão quando nada foi salvo — "sistema" só quando o usuário escolhe. */
export const DEFAULT_THEME_MODE: ThemeMode = 'claro'

/** O que fica gravado depois de resolver "sistema" — só os dois de verdade. */
export type ResolvedTheme = 'claro' | 'escuro'

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value)
}

/**
 * "sistema" segue o `prefers-color-scheme` do momento; claro (padrão)/escuro
 * são diretos, sem olhar o sistema.
 */
export function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (mode === 'sistema') return systemPrefersDark ? 'escuro' : 'claro'
  return mode
}

/** Valor do atributo `data-theme` do `<html>` para cada tema resolvido — `tokens.css` só define regras para `dark` (claro é o `:root` sem atributo). */
export function themeDataAttr(resolved: ResolvedTheme): 'light' | 'dark' {
  return resolved === 'escuro' ? 'dark' : 'light'
}

/**
 * Script anti-flash: texto puro (quem executa isto é o browser direto de
 * dentro de um `<script>` no `<head>`, antes do bundler e antes da primeira
 * pintura), injetado via `useHead` em `app.vue`. Sem ele a página nasce
 * clara e pisca para escura no primeiro tick (ou vice-versa) quando o tema
 * salvo diverge do `prefers-color-scheme` do sistema.
 *
 * Mesma regra de `resolveTheme`, reescrita à mão em JS sem import (só o
 * *valor* da constante entra na string, via template literal). `try/catch`
 * porque `localStorage` pode estourar em modo privado/quota cheia.
 */
export function themeAntiFlashScript(): string {
  return (
    '(function(){try{' +
    `var v=window.localStorage.getItem('${THEME_STORAGE_KEY}');` +
    "var dark=v==='escuro'||(v==='sistema'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);" +
    "document.documentElement.setAttribute('data-theme',dark?'dark':'light');" +
    '}catch(e){}})();'
  )
}
