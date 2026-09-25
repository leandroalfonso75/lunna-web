import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore } from '../stores/session'

/**
 * Teste de integração do middleware global de auth. `authGuard.test.ts` já
 * cobre `decide()`/`capRedirect()` como funções puras; este arquivo
 * exercita o `defineNuxtRouteMiddleware` de verdade, com o cookie e o
 * `useAuth().me()` dublados.
 *
 * `import.meta.server`/`import.meta.client` são constantes de compilação do
 * Vite do Nuxt — sob este `vitest.config.ts` (sem o plugin do Nuxt) nenhum
 * dos dois é `true`, então todo caso aqui exercita o ramo "cliente" do
 * middleware. O ramo servidor usa a mesma `decide()`/`capRedirect()` só
 * trocando onde o contador de redirects mora.
 */
let cookieValue: string | null = null
const meMock = vi.fn()
const navigateToMock = vi.fn((to: string) => ({ redirectedTo: to }))

vi.stubGlobal('defineNuxtRouteMiddleware', (fn: unknown) => fn)
vi.stubGlobal('navigateTo', navigateToMock)
vi.stubGlobal('useCookie', () => ({
  get value() {
    return cookieValue
  },
  set value(v: string | null) {
    cookieValue = v
  }
}))
vi.stubGlobal('useAuth', () => ({ me: meMock }))
vi.stubGlobal('useRequestEvent', () => undefined)
vi.stubGlobal('useNuxtApp', () => ({ runWithContext: (fn: () => unknown) => fn() }))

const authGlobal = (await import('./auth.global')).default as (to: { path: string }) => unknown

function route(path: string) {
  return { path }
}

describe('middleware auth.global', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    cookieValue = null
    meMock.mockReset()
    navigateToMock.mockClear()
  })

  it('um JWT expirado/inválido (token presente, /me 401) vai para /login uma única vez, cookie e sessão limpos', async () => {
    cookieValue = 'expired.jwt.token'
    meMock.mockRejectedValue({ status: 401 })

    await authGlobal(route('/configuracoes'))

    expect(navigateToMock).toHaveBeenCalledTimes(1)
    expect(navigateToMock).toHaveBeenCalledWith('/login?motivo=sessao_expirada')
    expect(cookieValue).toBeNull()
    expect(useSessionStore().user).toBeNull()
  })

  it('/login nunca ricocheteia para / enquanto um cookie morto ainda está presente e a sessão já foi limpa', async () => {
    cookieValue = 'expired.jwt.token'
    useSessionStore().clear()

    const result = await authGlobal(route('/login'))

    expect(result).toBeUndefined()
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('um usuário autenticado numa aba nova (cookie presente, sessão ainda não reidratada) não é afetado: /me resolve, sem redirect', async () => {
    cookieValue = 'good.jwt.token'
    meMock.mockResolvedValue({ user: { id: '1' }, company: { id: 'c1' }, ml_accounts: [] })

    await authGlobal(route('/'))

    expect(navigateToMock).not.toHaveBeenCalled()
    expect(cookieValue).toBe('good.jwt.token')
  })

  it('um visitante sem token vai para /login uma vez', async () => {
    cookieValue = null

    await authGlobal(route('/configuracoes'))

    expect(navigateToMock).toHaveBeenCalledTimes(1)
    expect(navigateToMock).toHaveBeenCalledWith('/login')
  })

  it('defesa em profundidade: um segundo redirect automático na mesma navegação é cortado para um /login limpo', async () => {
    const { capRedirect, MAX_AUTO_REDIRECTS } = await import('../lib/authGuard')
    expect(capRedirect({ action: 'redirect', to: '/' }, MAX_AUTO_REDIRECTS)).toEqual({
      action: 'redirect',
      to: '/login?motivo=sessao_expirada'
    })
  })
})
