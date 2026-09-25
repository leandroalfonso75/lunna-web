import { reactive } from 'vue'
import { createAiPlanStreamer } from '../lib/aiPlanStream'
import { useSessionStore } from '../stores/session'

export type AiPlanStatus = 'idle' | 'loading' | 'done' | 'error'

export interface AiPlanState {
  status: AiPlanStatus
  text: string
  error: string
}

/**
 * Plano de ação com IA por anúncio (SPEC §9): "Gerar" → "Parar" (aborta) →
 * "Gerar de novo", resultado em memória por anúncio enquanto a página está
 * aberta — por isso o estado é module-scope, chaveado por `item_id` (mesmo
 * padrão de `useToast`), e não algo local ao componente do detalhe.
 */
const plans = reactive(new Map<string, AiPlanState>())
const controllers = new Map<string, AbortController>()

function stateFor(itemId: string): AiPlanState {
  // Sempre devolve o valor via `.get()` (nunca o objeto cru recém-criado):
  // um `Map` reativo envolve cada valor lido num proxy reativo — devolver o
  // objeto cru na criação faria o componente ler uma referência que nunca
  // dispara re-render quando `generate()` mutar o estado depois.
  if (!plans.has(itemId)) plans.set(itemId, { status: 'idle', text: '', error: '' })
  return plans.get(itemId)!
}

export function useAiPlan() {
  const config = useRuntimeConfig()
  const { $token } = useNuxtApp()
  const session = useSessionStore()
  const stream = createAiPlanStreamer({ baseURL: config.public.apiUrl, getToken: () => $token.value })

  function generate(itemId: string) {
    const accountId = session.selectedAccountId
    if (!accountId) return

    const state = stateFor(itemId)
    state.status = 'loading'
    state.text = ''
    state.error = ''

    const controller = new AbortController()
    controllers.set(itemId, controller)

    stream({
      itemId,
      accountId,
      signal: controller.signal,
      onData: (chunk) => {
        state.text += chunk
      },
      onDone: () => {
        state.status = 'done'
        controllers.delete(itemId)
      },
      onError: (message) => {
        state.status = 'error'
        state.error = message
        controllers.delete(itemId)
      }
    })
  }

  function stop(itemId: string) {
    controllers.get(itemId)?.abort()
  }

  function reset(itemId: string) {
    plans.delete(itemId)
    controllers.get(itemId)?.abort()
    controllers.delete(itemId)
  }

  return { stateFor, generate, stop, reset }
}
