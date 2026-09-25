import type { AiPlan } from '../types/painel'
import { apiErrorMessage, apiErrorStatus } from './apiErrors'
import type { AiPlanClient } from './aiPlanClient'

export type AiPlanStatus = 'idle' | 'loading' | 'done' | 'error'

export interface AiPlanState {
  status: AiPlanStatus
  text: string
  error: string
}

const GENERIC_ERROR = 'Não foi possível gerar o plano agora. Tente de novo.'
const LOST_ERROR = 'Não foi possível acompanhar a geração do plano. Tente de novo.'
const MAX_POLL_FAILURES = 5

/**
 * Polling do plano de ação com IA: a geração roda no servidor (job) e aqui só
 * se consulta `GET /api/items/:id/ai-plan` a cada `intervalMs` até `done`/`error`.
 * Nenhuma conexão longa aberta — proxy/timeout/aba fechada não perdem o plano,
 * que fica salvo e reaparece ao reabrir o anúncio (`load`).
 *
 * Muta o `state` recebido (proxy reativo do composable); livre de Nuxt para
 * testar com timers falsos.
 */
export function createAiPlanRunner(client: AiPlanClient, options: { intervalMs?: number } = {}) {
  const intervalMs = options.intervalMs ?? 2000
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  /** Aplica o que veio do servidor; devolve true enquanto ainda está gerando. */
  function apply(state: AiPlanState, plan: AiPlan | null): boolean {
    if (!plan) {
      state.status = 'idle'
      state.text = ''
      state.error = ''
      return false
    }

    state.text = plan.text
    if (plan.status === 'pending' || plan.status === 'running') {
      state.status = 'loading'
      state.error = ''
      return true
    }

    state.status = plan.status === 'done' ? 'done' : 'error'
    state.error = plan.status === 'done' ? '' : plan.status === 'cancelled' ? 'Interrompido.' : (plan.error ?? GENERIC_ERROR)
    return false
  }

  function clear(itemId: string) {
    const timer = timers.get(itemId)
    if (timer) clearTimeout(timer)
    timers.delete(itemId)
  }

  function poll(state: AiPlanState, accountId: string, itemId: string, failures = 0) {
    clear(itemId)
    timers.set(
      itemId,
      setTimeout(async () => {
        try {
          const { ai_plan } = await client.get(accountId, itemId)
          if (apply(state, ai_plan)) poll(state, accountId, itemId)
          else timers.delete(itemId)
        } catch {
          // Falha de rede passageira não derruba a geração (ela segue no servidor).
          if (failures + 1 >= MAX_POLL_FAILURES) {
            state.status = 'error'
            state.error = LOST_ERROR
            timers.delete(itemId)
          } else {
            poll(state, accountId, itemId, failures + 1)
          }
        }
      }, intervalMs)
    )
  }

  return {
    /** Ao abrir o anúncio: mostra o último plano salvo e retoma o polling se ainda estiver gerando. */
    async load(state: AiPlanState, accountId: string, itemId: string) {
      try {
        const { ai_plan } = await client.get(accountId, itemId)
        if (apply(state, ai_plan)) poll(state, accountId, itemId)
      } catch {
        // Sem plano salvo visível: o botão "Gerar" continua funcionando.
      }
    },

    async generate(state: AiPlanState, accountId: string, itemId: string) {
      state.status = 'loading'
      state.text = ''
      state.error = ''
      try {
        const { ai_plan } = await client.generate(accountId, itemId)
        if (apply(state, ai_plan)) poll(state, accountId, itemId)
      } catch (err) {
        // 409: já está sendo gerado (outra aba/clique) — só acompanha.
        if (apiErrorStatus(err) === 409) {
          poll(state, accountId, itemId)
          return
        }
        state.status = 'error'
        state.error = apiErrorMessage(err, GENERIC_ERROR)
      }
    },

    async stop(state: AiPlanState, accountId: string, itemId: string) {
      clear(itemId)
      state.status = 'error'
      state.error = 'Interrompido.'
      try {
        await client.cancel(accountId, itemId)
      } catch {
        // O servidor para de qualquer forma quando o job termina; a tela já saiu do "gerando".
      }
    },

    reset(itemId: string) {
      clear(itemId)
    }
  }
}

export type AiPlanRunner = ReturnType<typeof createAiPlanRunner>
