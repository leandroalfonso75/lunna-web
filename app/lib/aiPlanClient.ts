import type { AiPlan } from '../types/painel'

type ApiFn = (path: string, options?: Record<string, unknown>) => Promise<any>

/**
 * Fábrica pura do plano de ação com IA (SPEC §9, DECISOES §10): `POST` enfileira
 * a geração no servidor, `GET` lê o estado e o texto parcial (polling), `DELETE`
 * cancela. Livre de composables do Nuxt para testar direto contra `$api`.
 */
export function createAiPlanClient(api: ApiFn) {
  return {
    get(accountId: string, itemId: string): Promise<{ ai_plan: AiPlan | null }> {
      return api(`/api/items/${itemId}/ai-plan`, { query: { account_id: accountId } })
    },

    generate(accountId: string, itemId: string): Promise<{ ai_plan: AiPlan }> {
      return api(`/api/items/${itemId}/ai-plan`, { method: 'POST', query: { account_id: accountId } })
    },

    cancel(accountId: string, itemId: string): Promise<void> {
      return api(`/api/items/${itemId}/ai-plan`, { method: 'DELETE', query: { account_id: accountId } })
    }
  }
}

export type AiPlanClient = ReturnType<typeof createAiPlanClient>
