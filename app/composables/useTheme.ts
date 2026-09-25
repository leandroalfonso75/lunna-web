import { computed, ref } from 'vue'
import { DEFAULT_THEME_MODE, isThemeMode, resolveTheme, THEME_STORAGE_KEY, themeDataAttr, type ThemeMode } from '../lib/theme'

/**
 * Estado do tema claro/escuro/sistema. Module-scope (singleton), mesmo
 * padrão de `useToast.ts`: o seletor aparece em mais de um lugar ao mesmo
 * tempo (cabeçalho, gaveta, Configurações) e todos precisam ler e mudar o
 * MESMO tema, sem Pinia — este arquivo já é chamado de fora do Nuxt em
 * teste, então não pode depender de `useNuxtApp()`.
 *
 * A inicialização (ler o `localStorage`, checar o `matchMedia` do sistema)
 * roda uma vez só, na primeira importação do módulo.
 */

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return DEFAULT_THEME_MODE
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (isThemeMode(stored)) return stored
  } catch {
    // localStorage indisponível (modo privado, quota cheia) — cai no padrão.
  }
  return DEFAULT_THEME_MODE
}

function readSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyToDocument(mode: ThemeMode, systemPrefersDark: boolean) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', themeDataAttr(resolveTheme(mode, systemPrefersDark)))
}

const mode = ref<ThemeMode>(readStoredMode())
const systemPrefersDark = ref(readSystemPrefersDark())
const resolved = computed(() => resolveTheme(mode.value, systemPrefersDark.value))

// Só UM listener de `matchMedia` para o processo inteiro (client).
let systemListenerAttached = false

function attachSystemListener() {
  if (systemListenerAttached) return
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
  systemListenerAttached = true

  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', (event) => {
    systemPrefersDark.value = event.matches
    applyToDocument(mode.value, systemPrefersDark.value)
  })
}

function setTheme(next: ThemeMode) {
  mode.value = next
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Sem persistência (modo privado/quota) — o tema ainda vale nesta sessão.
    }
  }
  applyToDocument(mode.value, systemPrefersDark.value)
}

export function useTheme() {
  attachSystemListener()
  // O script anti-flash (`app.vue`) já aplicou o atributo antes da primeira
  // pintura no load inicial; isto cobre o resto da sessão (navegação SPA e,
  // em teste, a própria montagem do composable).
  applyToDocument(mode.value, systemPrefersDark.value)
  return { mode, resolved, setTheme }
}
