import { onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import { useSessionStore } from '../stores/session'

/**
 * Pontos vermelhos do menu (pedido do usuário em 08/11/2026): quantas reclamações, perguntas e mensagens aguardam o
 * vendedor (`GET /api/attention`), relido a cada minuto e ao trocar de página ou de conta.
 */
const counts = reactive<Record<string, number>>({ claims: 0, questions: 0, messages: 0 })

export const ATTENTION_BY_ROUTE: Record<string, 'claims' | 'questions' | 'messages'> = {
  '/reclamacoes': 'claims',
  '/perguntas': 'questions',
  '/mensagens': 'messages'
}

export function useAttention() {
  const { $api } = useNuxtApp()
  const session = useSessionStore()
  const route = useRoute()
  let timer: ReturnType<typeof setInterval> | undefined

  async function refresh() {
    if (!session.selectedAccountId) return
    try {
      const res = await $api<{ claims: number; questions: number; messages: number }>('/api/attention', { query: { account_id: session.selectedAccountId } })
      Object.assign(counts, res)
    } catch {
      // sem pontos nesta rodada; tenta de novo no próximo minuto
    }
  }

  onMounted(() => {
    void refresh()
    timer = setInterval(refresh, 60_000)
  })
  onBeforeUnmount(() => clearInterval(timer))
  watch(() => [session.selectedAccountId, route.path], () => void refresh())

  /** Quantos itens aguardam na seção do link (0 = sem ponto). */
  const pending = (to: string) => {
    const key = ATTENTION_BY_ROUTE[to]
    return key ? counts[key] ?? 0 : 0
  }

  return { counts, pending, refresh }
}
