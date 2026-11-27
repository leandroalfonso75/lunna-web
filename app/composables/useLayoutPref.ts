import { computed } from 'vue'

/**
 * Novo layout (27/11/2026, amostra para o usuário avaliar): "novo" usa a casca nova (`layouts/novo.vue`) e as telas
 * redesenhadas; "classico" volta ao layout de antes com um clique. A escolha fica num cookie (lido no servidor e no
 * navegador: a página já nasce no layout certo, sem piscar).
 */
export type LayoutPref = 'novo' | 'classico'

const YEAR = 60 * 60 * 24 * 365

export function useLayoutPref() {
  const prefCookie = useCookie<LayoutPref>('lunna_layout', { default: () => 'novo', maxAge: YEAR, sameSite: 'lax' })
  const menuCookie = useCookie<'aberto' | 'recolhido'>('lunna_menu', { default: () => 'aberto', maxAge: YEAR, sameSite: 'lax' })

  const pref = computed<LayoutPref>(() => (prefCookie.value === 'classico' ? 'classico' : 'novo'))
  const collapsed = computed(() => menuCookie.value === 'recolhido')

  function setPref(value: LayoutPref) { prefCookie.value = value }
  function toggleCollapsed() { menuCookie.value = collapsed.value ? 'aberto' : 'recolhido' }

  return { pref, setPref, collapsed, toggleCollapsed, isNew: () => pref.value === 'novo' }
}
