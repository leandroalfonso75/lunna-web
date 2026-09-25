import type { AuthResponse, Company, MeResponse, MlAccount, User } from '../types/api'

export interface AuthClientDeps {
  /** Instância `$api` (ver lib/apiClient.ts) — já sabe a base URL. */
  api: (path: string, options?: Record<string, unknown>) => Promise<any>
  /** Escreve/apaga o JWT bruto no cookie `lunna_token`. */
  setToken: (token: string | null) => void
  /** Persiste a sessão (Pinia `useSessionStore`). */
  setSession: (user: User, company: Company, mlAccounts: MlAccount[]) => void
  /** Limpa a sessão. */
  clearSession: () => void
  /** Navegação client-side (`navigateTo`). Opcional para o factory seguir testável sem Nuxt. */
  navigate?: (path: string) => unknown
}

export interface SignupPayload {
  companyName: string
  name: string
  email: string
  password: string
}

/**
 * Fábrica pura dos fluxos de autenticação (login/cadastro/logout/`/me`).
 * Livre de composables do Nuxt para dar para testar em Vitest puro —
 * `composables/useAuth.ts` conecta isto ao cookie real e à store de sessão.
 */
export function createAuthClient(deps: AuthClientDeps) {
  const { api, setToken, setSession, clearSession, navigate } = deps

  const go = (path: string) => navigate?.(path)

  async function login(email: string, password: string) {
    const data: AuthResponse = await api('/auth/sign_in', {
      method: 'POST',
      body: { email, password }
    })
    setToken(data.token)
    setSession(data.user, data.company, data.ml_accounts)
    await go('/')
    return data
  }

  async function signup(payload: SignupPayload) {
    const data: AuthResponse = await api('/auth/sign_up', {
      method: 'POST',
      body: {
        company_name: payload.companyName,
        name: payload.name,
        email: payload.email,
        password: payload.password
      }
    })
    setToken(data.token)
    setSession(data.user, data.company, data.ml_accounts)
    await go('/')
    return data
  }

  async function logout() {
    try {
      await api('/auth/sign_out', { method: 'DELETE' })
    } catch {
      // A sessão local é encerrada de qualquer forma, mesmo se a chamada falhar.
    }
    setToken(null)
    clearSession()
    await go('/login')
  }

  async function me() {
    const data: MeResponse = await api('/api/me')
    setSession(data.user, data.company, data.ml_accounts)
    return data
  }

  return { login, signup, logout, me }
}
