import { useSessionStore } from '../stores/session'

/**
 * Persiste a conta do Mercado Livre selecionada no cookie `lunna_account`.
 * Plugin (e não a store) porque aqui o contexto do Nuxt existe: lê o cookie
 * no SSR e no cliente, e grava de volta só no cliente, quando a seleção muda.
 */
export default defineNuxtPlugin(() => {
  const cookie = useCookie<string | null>('lunna_account', { default: () => null, sameSite: 'lax' })
  const session = useSessionStore()
  session.preferredAccountId = cookie.value

  if (import.meta.client) {
    watch(() => session.selectedAccountId, (id) => {
      cookie.value = id
      if (id) session.preferredAccountId = id
    })
  }
})
