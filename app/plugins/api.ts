import { createApiClient } from '../lib/apiClient'
import { useSessionStore } from '../stores/session'

/**
 * `$api` — cliente HTTP central do painel. Usa a base configurada em
 * `NUXT_PUBLIC_API_URL`, envia o JWT salvo no cookie `lunna_token` como
 * `Authorization: Bearer <jwt>`. Em qualquer 401 (fora das rotas de auth),
 * encerra a sessão local e manda para `/login`.
 *
 * `$token` expõe o MESMO ref que `getToken` acima lê — `useCookie('lunna_token', ...)`
 * chamado de novo em outro composable criaria um ref independente que só se
 * sincroniza de forma assíncrona; `useAuth.ts` usa este `$token`, não um
 * `useCookie()` próprio.
 */
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const token = useCookie<string | null>('lunna_token', {
    default: () => null,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  })

  const api = createApiClient({
    baseURL: config.public.apiUrl,

    getToken: () => token.value,

    onUnauthorized: () => {
      token.value = null
      // Este callback do ofetch roda também no SSR, fora do contexto de
      // middleware de rota — `navigateTo()` sem `await`/`return` daí dentro
      // é rejeitado pelo Nuxt no servidor. O redirect de um 401 no SSR já é
      // feito, corretamente, pelo `catch` de `auth.global.ts`; este handler
      // só precisa cuidar do lado cliente.
      if (!import.meta.client) return
      useSessionStore().clear()
      navigateTo('/login?motivo=sessao_expirada')
    }
  })

  return {
    provide: { api, token }
  }
})
