import { createAuthClient } from '../lib/authClient'
import { useSessionStore } from '../stores/session'

/**
 * Composable de autenticação exposto ao app (login/cadastro/logout/`/me`).
 * A lógica em si vive em `lib/authClient.ts` (testável sem Nuxt); aqui só
 * conectamos o `$api`, o cookie `lunna_token` (via `$token`, provido por
 * `plugins/api.ts`) e a store de sessão.
 */
export function useAuth() {
  const { $api, $token } = useNuxtApp()
  const session = useSessionStore()

  return createAuthClient({
    api: $api,
    setToken: (value) => {
      $token.value = value
    },
    setSession: (user, company, mlAccounts) => session.setSession(user, company, mlAccounts),
    clearSession: () => session.clear(),
    navigate: (path) => navigateTo(path)
  })
}
