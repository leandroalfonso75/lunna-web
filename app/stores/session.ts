import { defineStore } from 'pinia'
import type { Company, MlAccount, User } from '../types/api'

/**
 * Escolhe a conta a selecionar: mantém a atual se ainda existir, senão a
 * preferida (lida do cookie `lunna_account` por `plugins/account-cookie.ts`),
 * senão a primeira. A store não toca em cookie: `useCookie` numa action
 * chamada depois de um `await` no SSR perde o contexto do Nuxt (NUXT_E1001).
 */
function pickSelectedAccountId(accounts: MlAccount[], current: string | null, preferred: string | null): string | null {
  if (current && accounts.some((a) => a.id === current)) return current
  if (preferred && accounts.some((a) => a.id === preferred)) return preferred
  return accounts[0]?.id ?? null
}

export const useSessionStore = defineStore('session', {
  state: () => ({
    user: null as User | null,
    company: null as Company | null,
    mlAccounts: [] as MlAccount[],
    selectedAccountId: null as string | null,
    preferredAccountId: null as string | null
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
    isAdmin: (state) => state.user?.role === 'admin',
    selectedAccount: (state): MlAccount | null =>
      state.mlAccounts.find((a) => a.id === state.selectedAccountId) ?? null
  },

  actions: {
    setSession(user: User, company: Company, mlAccounts: MlAccount[]) {
      this.user = user
      this.company = company
      this.setAccounts(mlAccounts)
    },

    /** Atualiza a lista de contas mantendo a seleção quando possível. */
    setAccounts(mlAccounts: MlAccount[]) {
      this.mlAccounts = mlAccounts
      this.selectedAccountId = pickSelectedAccountId(mlAccounts, this.selectedAccountId, this.preferredAccountId)
    },

    selectAccount(id: string) {
      this.selectedAccountId = id
    },

    clear() {
      this.user = null
      this.company = null
      this.mlAccounts = []
      this.selectedAccountId = null
    }
  }
})
