import type { Company, CompanyUpdatePayload, MlAccount, SyncRun, User, UserRole } from '../types/api'

type ApiFn = (path: string, options?: Record<string, unknown>) => Promise<any>

export interface UserCreatePayload {
  name: string
  email: string
  password: string
  role: UserRole
}

export interface UserUpdatePayload {
  name?: string
  role?: UserRole
  password?: string
}

export interface ConnectMlAccountResponse {
  code: string
  ml_account: MlAccount
}

/**
 * Fábrica pura das chamadas de Configurações (empresa, usuários, contas do
 * Mercado Livre, sincronização). Livre de composables do Nuxt para dar para
 * testar direto contra `$api` (ver settingsClient.test.ts) —
 * `composables/useSettings.ts` só conecta isto ao `$api` real.
 */
export function createSettingsClient(api: ApiFn) {
  return {
    getCompany(): Promise<{ company: Company }> {
      return api('/api/company')
    },

    updateCompany(payload: CompanyUpdatePayload): Promise<{ company: Company }> {
      return api('/api/company', { method: 'PATCH', body: payload })
    },

    listUsers(): Promise<{ users: User[] }> {
      return api('/api/users')
    },

    createUser(payload: UserCreatePayload): Promise<{ user: User }> {
      return api('/api/users', { method: 'POST', body: payload })
    },

    updateUser(id: string, payload: UserUpdatePayload): Promise<{ user: User }> {
      return api(`/api/users/${id}`, { method: 'PATCH', body: payload })
    },

    deleteUser(id: string): Promise<void> {
      return api(`/api/users/${id}`, { method: 'DELETE' })
    },

    listMlAccounts(): Promise<{ ml_accounts: MlAccount[] }> {
      return api('/api/ml_accounts')
    },

    authorizeMlAccount(): Promise<{ url: string }> {
      return api('/api/ml_accounts/authorize', { method: 'POST' })
    },

    /**
     * Troca o `code`/`state` que `GET /auth/ml/callback` devolveu na URL
     * (DECISOES.md §5) pela conta conectada. Erro vem com `{errors, code}`
     * (403/409/422) — `code` mapeado em `lib/mlCallback.ts`.
     */
    connectMlAccount(code: string, state: string): Promise<ConnectMlAccountResponse> {
      return api('/api/ml_accounts/connect', { method: 'POST', body: { code, state } })
    },

    deleteMlAccount(id: string): Promise<void> {
      return api(`/api/ml_accounts/${id}`, { method: 'DELETE' })
    },

    syncNow(accountId: string): Promise<{ run_id: string }> {
      return api(`/api/sync?account_id=${accountId}`, { method: 'POST' })
    },

    listSyncRuns(accountId: string, limit = 20): Promise<{ runs: SyncRun[] }> {
      return api(`/api/sync/runs?account_id=${accountId}&limit=${limit}`)
    }
  }
}

export type SettingsClient = ReturnType<typeof createSettingsClient>
