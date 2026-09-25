import { reactive } from 'vue'
import { createAiPlanClient } from '../lib/aiPlanClient'
import { createAiPlanRunner, type AiPlanRunner, type AiPlanState } from '../lib/aiPlanRunner'
import { useSessionStore } from '../stores/session'

export type { AiPlanState, AiPlanStatus } from '../lib/aiPlanRunner'

/**
 * Plano de ação com IA por anúncio (SPEC §9): "Gerar" → "Parar" → "Gerar de
 * novo". A geração roda no servidor e a tela faz polling (`lib/aiPlanRunner.ts`);
 * o plano fica salvo e é recarregado ao reabrir o anúncio (`load`). O estado é
 * module-scope, chaveado por `item_id` (mesmo padrão de `useToast`), e não algo
 * local ao componente do detalhe — assim o polling em curso sobrevive a fechar
 * e reabrir a linha.
 */
const plans = reactive(new Map<string, AiPlanState>())
let runner: AiPlanRunner | null = null

function stateFor(itemId: string): AiPlanState {
  // Sempre devolve o valor via `.get()` (nunca o objeto cru recém-criado):
  // um `Map` reativo envolve cada valor lido num proxy reativo — devolver o
  // objeto cru na criação faria o componente ler uma referência que nunca
  // dispara re-render quando o polling mutar o estado depois.
  if (!plans.has(itemId)) plans.set(itemId, { status: 'idle', text: '', error: '' })
  return plans.get(itemId)!
}

export function useAiPlan() {
  const { $api } = useNuxtApp()
  const session = useSessionStore()
  // Um runner só (guarda os timers de polling por anúncio), criado com o `$api` do app.
  runner ??= createAiPlanRunner(createAiPlanClient($api))
  const active = runner

  function load(itemId: string) {
    const accountId = session.selectedAccountId
    if (!accountId) return
    // Já gerando/carregado nesta sessão: o polling em curso é a fonte da verdade.
    if (stateFor(itemId).status !== 'idle') return
    active.load(stateFor(itemId), accountId, itemId)
  }

  function generate(itemId: string) {
    const accountId = session.selectedAccountId
    if (!accountId) return
    active.generate(stateFor(itemId), accountId, itemId)
  }

  function stop(itemId: string) {
    const accountId = session.selectedAccountId
    if (!accountId) return
    active.stop(stateFor(itemId), accountId, itemId)
  }

  function reset(itemId: string) {
    plans.delete(itemId)
    active.reset(itemId)
  }

  return { stateFor, load, generate, stop, reset }
}
