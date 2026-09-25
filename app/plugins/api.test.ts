import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createApiClient } from '../lib/apiClient'

const BASE = 'https://api.lunna.test'

const server = setupServer(
  http.get(`${BASE}/protected`, ({ request }) => {
    if (request.headers.get('Authorization') !== 'Bearer valid-token') {
      return HttpResponse.json({ errors: ['não autenticado'] }, { status: 401 })
    }
    return HttpResponse.json({ ok: true })
  }),
  http.post(`${BASE}/auth/sign_in`, async ({ request }) => {
    const body = (await request.json()) as { password?: string }
    if (body.password === 'wrong') {
      return HttpResponse.json({ errors: ['E-mail ou senha inválidos.'] }, { status: 401 })
    }
    return HttpResponse.json({ token: 'fresh-jwt' })
  }),
  http.post(`${BASE}/auth/sign_up`, () => HttpResponse.json({ errors: ['e-mail já cadastrado'] }, { status: 401 }))
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('createApiClient', () => {
  it('envia o bearer token devolvido por getToken em toda requisição', async () => {
    const api = createApiClient({ baseURL: BASE, getToken: () => 'valid-token' })
    await expect(api('/protected')).resolves.toEqual({ ok: true })
  })

  it('chama onUnauthorized quando a API responde 401', async () => {
    const onUnauthorized = vi.fn()
    const api = createApiClient({ baseURL: BASE, getToken: () => 'wrong-token', onUnauthorized })

    await expect(api('/protected')).rejects.toThrow()
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('não chama onUnauthorized quando o próprio /auth/sign_in responde 401 (credenciais inválidas)', async () => {
    const onUnauthorized = vi.fn()
    const api = createApiClient({ baseURL: BASE, getToken: () => null, onUnauthorized })

    await expect(api('/auth/sign_in', { method: 'POST', body: { password: 'wrong' } })).rejects.toThrow()
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('não chama onUnauthorized quando o próprio /auth/sign_up responde 401', async () => {
    const onUnauthorized = vi.fn()
    const api = createApiClient({ baseURL: BASE, getToken: () => null, onUnauthorized })

    await expect(api('/auth/sign_up', { method: 'POST', body: {} })).rejects.toThrow()
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})
