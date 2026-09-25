/**
 * Um jeito só de ler o erro que o `$api` (ofetch) rejeita. O ofetch expõe o
 * status em lugares diferentes dependendo de onde o erro nasce (`FetchError`
 * vs. a `Response` crua), então quem lê precisa aceitar os dois.
 */

interface MaybeFetchError {
  status?: unknown
  statusCode?: unknown
  response?: { status?: unknown }
  data?: { errors?: unknown }
}

/** HTTP status do erro, quando dá para saber. */
export function apiErrorStatus(err: unknown): number | undefined {
  const candidate = err as MaybeFetchError | null | undefined
  const raw = candidate?.status ?? candidate?.statusCode ?? candidate?.response?.status
  return typeof raw === 'number' ? raw : undefined
}

/** Primeira mensagem de `{ errors: [...] }` da API, ou o texto padrão da tela. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const errors = (err as MaybeFetchError | null | undefined)?.data?.errors
  if (Array.isArray(errors)) {
    const first = errors.find((message) => typeof message === 'string' && message.trim())
    if (typeof first === 'string') return first
  }
  return fallback
}

/** Todas as mensagens de `{ errors: [...] }` — formulários que listam uma por linha. */
export function apiErrorMessages(err: unknown, fallback: string): string[] {
  const errors = (err as MaybeFetchError | null | undefined)?.data?.errors
  if (Array.isArray(errors)) {
    const texts = errors.filter((message): message is string => typeof message === 'string' && !!message.trim())
    if (texts.length) return texts
  }
  return [fallback]
}
