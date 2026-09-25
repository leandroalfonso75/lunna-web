/**
 * A decisão do middleware global de autenticação, isolada do Nuxt. Função
 * pura: entra o estado (rota, cookie, sessão em memória), sai o que fazer —
 * testável sem montar nada do Nuxt (ver authGuard.test.ts).
 */

/** Rotas que existem antes de haver sessão. */
export const PUBLIC_ROUTES = new Set(['/login', '/cadastro'])

export interface GuardInput {
  /** `to.path` da navegação. */
  path: string
  /** Existe o cookie `lunna_token`? */
  hasToken: boolean
  /** A store de sessão já tem o usuário (não tem, depois de um F5)? */
  hasSession: boolean
}

export type GuardDecision =
  /** Segue a navegação. */
  | { action: 'continue' }
  /** Manda para outra rota. */
  | { action: 'redirect'; to: string }
  /** Busca `/api/me` para reidratar a store antes de seguir. */
  | { action: 'hydrate' }

/** `/login/` e `/login` são a mesma porta — o router pode entregar as duas formas. */
function normalize(path: string): string {
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1)
  return path
}

export function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.has(normalize(path))
}

export function decide({ path, hasToken, hasSession }: GuardInput): GuardDecision {
  const route = normalize(path)

  if (PUBLIC_ROUTES.has(route)) {
    // Exigir token E sessão (não só o cookie, que pode estar morto) evita o
    // loop /login → / → /login → ...: sem sessão em memória, /login renderiza
    // de verdade em vez de ricochetear, mesmo com um JWT morto no cookie.
    if (hasToken && hasSession) return { action: 'redirect', to: '/' }
    return { action: 'continue' }
  }

  if (!hasToken) return { action: 'redirect', to: '/login' }
  if (!hasSession) return { action: 'hydrate' }
  return { action: 'continue' }
}

/** Teto de saltos automáticos por navegação — ver `capRedirect`. */
export const MAX_AUTO_REDIRECTS = 1

/**
 * Segunda linha de defesa: mesmo com `decide()` correto, nenhuma combinação
 * futura de rotas deveria poder empilhar mais de um redirect automático na
 * mesma navegação. `redirectsSoFar` vem de quem chama (contador por-request
 * no SSR, por-aba no cliente — ver `middleware/auth.global.ts`); esta
 * função fica pura e testável sem Nuxt. Ao estourar o teto, corta em seco
 * para `/login` com o motivo de sessão expirada.
 */
export function capRedirect(decision: GuardDecision, redirectsSoFar: number): GuardDecision {
  if (decision.action !== 'redirect') return decision
  if (redirectsSoFar < MAX_AUTO_REDIRECTS) return decision
  return { action: 'redirect', to: '/login?motivo=sessao_expirada' }
}
