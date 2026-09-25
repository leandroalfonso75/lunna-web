import { apiErrorStatus } from './apiErrors'

/**
 * Erro temporário (SPEC §7.1): 429, 502, 503, 504 ou rede (sem status
 * conhecido). Os demais 4xx/5xx não são temporários.
 */
const TRANSIENT_STATUSES = [429, 502, 503, 504]

export function isTransientError(err: unknown): boolean {
  // Um AbortController.abort() (requisição cancelada de propósito, ex.:
  // debounce/troca de filtro) nunca deve virar um retry — não é uma falha.
  if (err && typeof err === 'object' && (err as { name?: unknown }).name === 'AbortError') return false

  const status = apiErrorStatus(err)
  if (status === undefined) return true
  return TRANSIENT_STATUSES.includes(status)
}

/**
 * Tenta de novo UMA vez, ~4s depois, só para erro temporário; qualquer
 * outro erro (ou a segunda falha) é relançado. Usado pelas leituras do
 * painel (`usePainel`, `useItemsTable`, `useAbc`, `useSyncBadge`).
 */
export async function withTransientRetry<T>(fn: () => Promise<T>, delayMs = 4000): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (!isTransientError(err)) throw err
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    return fn()
  }
}
