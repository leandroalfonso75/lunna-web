import { ofetch, type FetchOptions } from 'ofetch'

export interface ApiClientOptions {
  /** Base URL da API do Lunna (`NUXT_PUBLIC_API_URL`). */
  baseURL: string
  /** Devolve o JWT atual (lido do cookie `lunna_token`), ou null/undefined quando deslogado. */
  getToken: () => string | null | undefined
  /** Chamado quando a API responde 401 (sessão expirada/inválida). */
  onUnauthorized?: () => void
}

/**
 * Fábrica pura do client `$api` usado no painel inteiro. Livre de qualquer
 * API específica do Nuxt (`useCookie`/`useRuntimeConfig`/`navigateTo`) para
 * dar para testar direto contra um servidor HTTP mockado (ver
 * `plugins/api.test.ts`) — o plugin do Nuxt (`plugins/api.ts`) só conecta
 * isto a cookies/sessão/navegação.
 */
export function createApiClient(options: ApiClientOptions) {
  const { baseURL, getToken, onUnauthorized } = options

  return ofetch.create({
    baseURL,

    onRequest({ options: reqOptions }: { options: FetchOptions }) {
      const token = getToken()
      if (!token) return

      const headers = new Headers(reqOptions.headers as HeadersInit | undefined)
      headers.set('Authorization', `Bearer ${token}`)
      reqOptions.headers = headers
    },

    onResponseError({ request, response }) {
      if (response.status !== 401 || !onUnauthorized) return

      // Sign-in/sign-up tratam os próprios 401 inline (credenciais
      // inválidas) — não podem disparar o redirect global de "sessão
      // expirada" para /login.
      const path = typeof request === 'string' ? request : request.url
      if (path.endsWith('/auth/sign_in') || path.endsWith('/auth/sign_up')) return

      onUnauthorized()
    }
  })
}
