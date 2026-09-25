import { describe, expect, it } from 'vitest'
import { MAX_AUTO_REDIRECTS, PUBLIC_ROUTES, capRedirect, decide, isPublicRoute } from './authGuard'

describe('isPublicRoute', () => {
  it('conhece as duas rotas que existem antes de haver sessão', () => {
    expect([...PUBLIC_ROUTES].sort()).toEqual(['/cadastro', '/login'])
    for (const path of PUBLIC_ROUTES) expect(isPublicRoute(path)).toBe(true)
  })

  it('ignora uma barra final — `/login/` é a mesma porta que `/login`', () => {
    expect(isPublicRoute('/login/')).toBe(true)
    expect(isPublicRoute('/')).toBe(false)
    expect(isPublicRoute('/configuracoes')).toBe(false)
  })
})

describe('decide', () => {
  it('manda um visitante já autenticado para fora de login/cadastro', () => {
    expect(decide({ path: '/login', hasToken: true, hasSession: true })).toEqual({ action: 'redirect', to: '/' })
    expect(decide({ path: '/cadastro', hasToken: true, hasSession: true })).toEqual({ action: 'redirect', to: '/' })
  })

  it('deixa login/cadastro em paz sem token', () => {
    expect(decide({ path: '/login', hasToken: false, hasSession: false })).toEqual({ action: 'continue' })
    expect(decide({ path: '/cadastro', hasToken: false, hasSession: false })).toEqual({ action: 'continue' })
  })

  it('nunca ricocheteia /login para / com token mas sem sessão (JWT morto, /me 401)', () => {
    expect(decide({ path: '/login', hasToken: true, hasSession: false })).toEqual({ action: 'continue' })
  })

  it('manda um visitante sem token para /login em qualquer rota privada', () => {
    expect(decide({ path: '/', hasToken: false, hasSession: false })).toEqual({ action: 'redirect', to: '/login' })
    expect(decide({ path: '/configuracoes', hasToken: false, hasSession: false })).toEqual({
      action: 'redirect',
      to: '/login'
    })
  })

  it('pede um /me num reload completo — o cookie sobreviveu, a store Pinia não', () => {
    expect(decide({ path: '/', hasToken: true, hasSession: false })).toEqual({ action: 'hydrate' })
  })

  it('não refaz o /me quando a sessão já está em memória', () => {
    expect(decide({ path: '/', hasToken: true, hasSession: true })).toEqual({ action: 'continue' })
  })
})

describe('capRedirect', () => {
  it('deixa passar uma decisão que não é redirect, seja qual for o contador', () => {
    expect(capRedirect({ action: 'continue' }, 99)).toEqual({ action: 'continue' })
    expect(capRedirect({ action: 'hydrate' }, 99)).toEqual({ action: 'hydrate' })
  })

  it('deixa passar o primeiro redirect automático de uma navegação', () => {
    expect(capRedirect({ action: 'redirect', to: '/login' }, 0)).toEqual({ action: 'redirect', to: '/login' })
  })

  it('corta um redirect além do teto para um /login limpo com o motivo de sessão expirada', () => {
    expect(capRedirect({ action: 'redirect', to: '/' }, MAX_AUTO_REDIRECTS)).toEqual({
      action: 'redirect',
      to: '/login?motivo=sessao_expirada'
    })
    expect(capRedirect({ action: 'redirect', to: '/login' }, MAX_AUTO_REDIRECTS + 5)).toEqual({
      action: 'redirect',
      to: '/login?motivo=sessao_expirada'
    })
  })
})
