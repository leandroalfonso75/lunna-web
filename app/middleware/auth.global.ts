import { capRedirect, decide } from '../lib/authGuard'
import { useSessionStore } from '../stores/session'

/**
 * Contador de saltos automáticos no cliente. Vive por aba (o módulo é
 * carregado uma vez por sessão do browser), resetado a zero toda vez que
 * uma navegação NÃO termina em redirect. No servidor o equivalente é
 * `event.context`, por-request; um `let` de módulo ali vazaria entre
 * requisições concorrentes de usuários diferentes.
 */
let clientRedirects = 0

/**
 * Middleware global de autenticação. A decisão em si (rota pública,
 * redirect, reidratar a sessão) é pura e vive em `lib/authGuard.ts`, com
 * testes; aqui fica só o que precisa do Nuxt: ler o cookie, chamar
 * `/api/me` e navegar.
 *
 * Duas defesas em profundidade: (1) `capRedirect` corta em seco para
 * `/login?motivo=sessao_expirada` se mais de `MAX_AUTO_REDIRECTS` redirect
 * automático acontecer na mesma navegação; (2) todo caminho que apaga a
 * sessão por falha de auth usa a mesma query `motivo=sessao_expirada`, que
 * `login.vue` traduz numa frase fixa, nunca o texto da API.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const nuxtApp = useNuxtApp()
  const token = useCookie<string | null>('lunna_token', {
    default: () => null,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  })
  const session = useSessionStore()

  const event = import.meta.server ? useRequestEvent() : null
  const redirectsSoFar = event ? ((event.context.authRedirects as number | undefined) ?? 0) : clientRedirects

  const decision = capRedirect(
    decide({ path: to.path, hasToken: !!token.value, hasSession: !!session.user }),
    redirectsSoFar
  )

  if (decision.action === 'redirect') {
    if (event) event.context.authRedirects = redirectsSoFar + 1
    else clientRedirects = redirectsSoFar + 1
    // O teto capado sempre manda para /login: garante que a sessão morta
    // não sobrevive ao corte (senão o próximo hasToken continuaria true).
    if (decision.to.startsWith('/login')) {
      token.value = null
      session.clear()
    }
    return navigateTo(decision.to)
  }

  if (event) event.context.authRedirects = 0
  else clientRedirects = 0

  if (decision.action === 'continue') return

  const auth = useAuth()
  try {
    await auth.me()
  } catch {
    token.value = null
    session.clear()
    // Depois de um `await` o contexto do Nuxt se perde no SSR (NUXT_E1001).
    return nuxtApp.runWithContext(() => navigateTo('/login?motivo=sessao_expirada'))
  }
})
