import { createSseParser } from './sse'

/**
 * Chama `POST /api/items/:id/ai-plan` (SPEC §9) e faz streaming da resposta
 * SSE. Usa `fetch` puro (não `$api`/ofetch, não `EventSource`): a rota é
 * POST e precisa do header `Authorization`, que `EventSource` não manda.
 * Função fábrica livre de Nuxt para testar com `fetch` mockado —
 * `composables/useAiPlan.ts` conecta isto à base URL e ao token reais.
 */

export interface AiPlanStreamDeps {
  baseURL: string
  getToken: () => string | null | undefined
  /** Injeção de `fetch` para teste; usa o `fetch` global por padrão. */
  fetchFn?: typeof fetch
}

export interface AiPlanStreamOptions {
  itemId: string
  accountId: string
  signal: AbortSignal
  onData: (text: string) => void
  onDone: () => void
  onError: (message: string) => void
}

const GENERIC_ERROR = 'Não foi possível gerar o plano agora. Tente de novo.'

export function createAiPlanStreamer(deps: AiPlanStreamDeps) {
  const fetchFn = deps.fetchFn ?? fetch

  return async function streamAiPlan(options: AiPlanStreamOptions): Promise<void> {
    const { itemId, accountId, signal, onData, onDone, onError } = options
    const token = deps.getToken()
    const parser = createSseParser({ onData, onDone, onError })

    let response: Response
    try {
      response = await fetchFn(`${deps.baseURL}/api/items/${itemId}/ai-plan?account_id=${accountId}`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          Accept: 'text/event-stream'
        },
        signal
      })
    } catch {
      if (signal.aborted) {
        onError('Interrompido.')
        return
      }
      onError(GENERIC_ERROR)
      return
    }

    if (!response.ok || !response.body) {
      if (response.status === 403) onError('Você não tem permissão para gerar este plano.')
      else if (response.status === 429) onError('Limite de uso atingido. Tente em instantes.')
      else onError(GENERIC_ERROR)
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        parser.push(decoder.decode(value, { stream: true }))
      }
      parser.end()
    } catch {
      if (signal.aborted) onError('Interrompido.')
      else onError(GENERIC_ERROR)
    }
  }
}

export type AiPlanStreamer = ReturnType<typeof createAiPlanStreamer>
