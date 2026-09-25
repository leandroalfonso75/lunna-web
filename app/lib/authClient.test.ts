import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createApiClient } from './apiClient'
import { createAuthClient } from './authClient'

const BASE = 'https://api.lunna.test'

const user = { id: 'u1', name: 'Ana', email: 'ana@empresa.com', role: 'admin' }
const company = { id: 'c1', name: 'Empresa Ana', tax_pct: 11.3, min_margin_pct: 9, abc_cut_a: 80, abc_cut_b: 95, group_up_pct: 10, group_down_pct: -15 }

const server = setupServer(
  http.post(`${BASE}/auth/sign_in`, () => HttpResponse.json({ token: 'fresh-jwt', user, company, ml_accounts: [] })),
  http.post(`${BASE}/auth/sign_up`, () => HttpResponse.json({ token: 'novo-jwt', user, company, ml_accounts: [] }))
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function buildDeps(apiImpl: any) {
  const state: { token: string | null; user: any; company: any; mlAccounts: any } = {
    token: null,
    user: null,
    company: null,
    mlAccounts: null
  }
  const deps = {
    api: apiImpl,
    setToken: (token: string | null) => {
      state.token = token
    },
    setSession: (u: any, c: any, accounts: any) => {
      state.user = u
      state.company = c
      state.mlAccounts = accounts
    },
    clearSession: () => {
      state.user = null
      state.company = null
      state.mlAccounts = null
    },
    navigate: vi.fn()
  }
  return { deps, state }
}

describe('createAuthClient', () => {
  it('login envia {email, password} sem aninhar em "user" e navega para /', async () => {
    const api = vi.fn().mockResolvedValue({ token: 'jwt', user, company, ml_accounts: [] })
    const { deps, state } = buildDeps(api)

    await createAuthClient(deps).login('ana@empresa.com', 'segredo123')

    expect(api).toHaveBeenCalledWith('/auth/sign_in', {
      method: 'POST',
      body: { email: 'ana@empresa.com', password: 'segredo123' }
    })
    expect(state.token).toBe('jwt')
    expect(state.user).toEqual(user)
    expect(state.company).toEqual(company)
    expect(deps.navigate).toHaveBeenCalledWith('/')
  })

  it('login guarda o token que vem no corpo da resposta (não num header)', async () => {
    const cookie: { value: string | null } = { value: null }
    const api = createApiClient({ baseURL: BASE, getToken: () => cookie.value })
    const auth = createAuthClient({
      api,
      setToken: (token) => {
        cookie.value = token
      },
      setSession: vi.fn(),
      clearSession: vi.fn(),
      navigate: vi.fn()
    })

    await auth.login('ana@empresa.com', 'segredo123')

    expect(cookie.value).toBe('fresh-jwt')
  })

  it('signup envia company_name/name/email/password e navega para /', async () => {
    const api = vi.fn().mockResolvedValue({ token: 'jwt', user, company, ml_accounts: [] })
    const { deps, state } = buildDeps(api)

    await createAuthClient(deps).signup({
      companyName: 'Empresa Ana',
      name: 'Ana',
      email: 'ana@empresa.com',
      password: 'segredo123'
    })

    expect(api).toHaveBeenCalledWith('/auth/sign_up', {
      method: 'POST',
      body: { company_name: 'Empresa Ana', name: 'Ana', email: 'ana@empresa.com', password: 'segredo123' }
    })
    expect(state.token).toBe('jwt')
    expect(deps.navigate).toHaveBeenCalledWith('/')
  })

  it('logout limpa token e sessão mesmo se sign_out falhar', async () => {
    const api = vi.fn().mockRejectedValue(new Error('network'))
    const { deps, state } = buildDeps(api)
    state.token = 'abc'
    state.user = user

    await createAuthClient(deps).logout()

    expect(state.token).toBeNull()
    expect(state.user).toBeNull()
    expect(deps.navigate).toHaveBeenCalledWith('/login')
  })

  it('me() reidrata a store a partir de /api/me (o caminho do F5)', async () => {
    const api = vi.fn().mockResolvedValue({ user, company, ml_accounts: [] })
    const { deps, state } = buildDeps(api)

    const data = await createAuthClient(deps).me()

    expect(api).toHaveBeenCalledWith('/api/me')
    expect(state.user).toEqual(user)
    expect(deps.navigate).not.toHaveBeenCalled()
    expect(data.user).toEqual(user)
  })

  it('me() deixa a falha passar para o middleware derrubar o cookie morto', async () => {
    const api = vi.fn().mockRejectedValue({ status: 401 })
    const { deps, state } = buildDeps(api)

    await expect(createAuthClient(deps).me()).rejects.toMatchObject({ status: 401 })
    expect(state.user).toBeNull()
  })

  it('funciona sem um dep navigate (uso headless)', async () => {
    const api = vi.fn().mockResolvedValue({})
    const auth = createAuthClient({ api, setToken: vi.fn(), setSession: vi.fn(), clearSession: vi.fn() })

    await expect(auth.logout()).resolves.toBeUndefined()
  })
})
