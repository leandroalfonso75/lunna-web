import { computed, ref, type Ref } from 'vue'

/**
 * Novo layout (27/11/2026, amostra para o usuário avaliar): "novo" usa a casca nova (`layouts/novo.vue`) e as telas
 * redesenhadas; "classico" volta ao layout de antes com um clique. A escolha fica num cookie (lido no servidor e no
 * navegador: a página já nasce no layout certo, sem piscar).
 */
export type LayoutPref = 'novo' | 'classico'

const YEAR = 60 * 60 * 24 * 365

/**
 * Fora do Nuxt (testes de componente com Vitest puro) não há `useCookie`: vale o layout atual ("classico"), para os
 * testes das telas antigas continuarem valendo; quem testa o novo layout define `useCookie` com `vi.stubGlobal`.
 */
function cookie<T>(name: string, fallback: T): Ref<T> {
  if (typeof useCookie !== 'function') return ref(fallback) as Ref<T>
  return useCookie<T>(name, { default: () => (name === 'lunna_layout' ? ('novo' as T) : fallback), maxAge: YEAR, sameSite: 'lax' }) as Ref<T>
}

export function useLayoutPref() {
  const prefCookie = cookie<LayoutPref>('lunna_layout', 'classico')
  const menuCookie = cookie<'aberto' | 'recolhido'>('lunna_menu', 'aberto')

  const pref = computed<LayoutPref>(() => (prefCookie.value === 'classico' ? 'classico' : 'novo'))
  const collapsed = computed(() => menuCookie.value === 'recolhido')

  function setPref(value: LayoutPref) { prefCookie.value = value }
  function toggleCollapsed() { menuCookie.value = collapsed.value ? 'aberto' : 'recolhido' }

  return { pref, setPref, collapsed, toggleCollapsed, isNew: () => pref.value === 'novo' }
}
