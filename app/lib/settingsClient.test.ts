import { describe, expect, it, vi } from 'vitest'
import { createSettingsClient } from './settingsClient'

function buildClient(resolvedValue: unknown = {}) {
  const api = vi.fn().mockResolvedValue(resolvedValue)
  return { api, client: createSettingsClient(api) }
}

describe('createSettingsClient', () => {
  it('getCompany faz GET /api/company', async () => {
    const { api, client } = buildClient({ company: { id: 'c1' } })
    const result = await client.getCompany()
    expect(api).toHaveBeenCalledWith('/api/company')
    expect(result).toEqual({ company: { id: 'c1' } })
  })

  it('updateCompany faz PATCH /api/company com o payload', async () => {
    const { api, client } = buildClient()
    await client.updateCompany({ tax_pct: 12 })
    expect(api).toHaveBeenCalledWith('/api/company', { method: 'PATCH', body: { tax_pct: 12 } })
  })

  it('listUsers faz GET /api/users', async () => {
    const { api, client } = buildClient({ users: [] })
    await client.listUsers()
    expect(api).toHaveBeenCalledWith('/api/users')
  })

  it('createUser faz POST /api/users com nome, e-mail, senha e papel', async () => {
    const { api, client } = buildClient()
    await client.createUser({ name: 'Ana', email: 'ana@empresa.com', password: 'segredo123', role: 'member' })
    expect(api).toHaveBeenCalledWith('/api/users', {
      method: 'POST',
      body: { name: 'Ana', email: 'ana@empresa.com', password: 'segredo123', role: 'member' }
    })
  })

  it('updateUser faz PATCH /api/users/:id', async () => {
    const { api, client } = buildClient()
    await client.updateUser('u1', { role: 'admin' })
    expect(api).toHaveBeenCalledWith('/api/users/u1', { method: 'PATCH', body: { role: 'admin' } })
  })

  it('deleteUser faz DELETE /api/users/:id', async () => {
    const { api, client } = buildClient()
    await client.deleteUser('u1')
    expect(api).toHaveBeenCalledWith('/api/users/u1', { method: 'DELETE' })
  })

  it('listMlAccounts faz GET /api/ml_accounts', async () => {
    const { api, client } = buildClient({ ml_accounts: [] })
    await client.listMlAccounts()
    expect(api).toHaveBeenCalledWith('/api/ml_accounts')
  })

  it('authorizeMlAccount faz POST /api/ml_accounts/authorize e devolve a url', async () => {
    const { api, client } = buildClient({ url: 'https://auth.mercadolivre.com.br/...' })
    const result = await client.authorizeMlAccount()
    expect(api).toHaveBeenCalledWith('/api/ml_accounts/authorize', { method: 'POST' })
    expect(result.url).toBe('https://auth.mercadolivre.com.br/...')
  })

  it('connectMlAccount faz POST /api/ml_accounts/connect com code e state', async () => {
    const { api, client } = buildClient({ code: 'conectada', ml_account: { id: 'acc1' } })
    const result = await client.connectMlAccount('auth-code', 'state-uuid')
    expect(api).toHaveBeenCalledWith('/api/ml_accounts/connect', {
      method: 'POST',
      body: { code: 'auth-code', state: 'state-uuid' }
    })
    expect(result.code).toBe('conectada')
  })

  it('deleteMlAccount faz DELETE /api/ml_accounts/:id', async () => {
    const { api, client } = buildClient()
    await client.deleteMlAccount('acc1')
    expect(api).toHaveBeenCalledWith('/api/ml_accounts/acc1', { method: 'DELETE' })
  })

  it('syncNow faz POST /api/sync?account_id=', async () => {
    const { api, client } = buildClient({ run_id: 'run1' })
    const result = await client.syncNow('acc1')
    expect(api).toHaveBeenCalledWith('/api/sync?account_id=acc1', { method: 'POST' })
    expect(result.run_id).toBe('run1')
  })

  it('listSyncRuns faz GET /api/sync/runs?account_id=&limit=, com limit padrão 20', async () => {
    const { api, client } = buildClient({ runs: [] })
    await client.listSyncRuns('acc1')
    expect(api).toHaveBeenCalledWith('/api/sync/runs?account_id=acc1&limit=20')
  })

  it('listSyncRuns aceita um limit customizado', async () => {
    const { api, client } = buildClient({ runs: [] })
    await client.listSyncRuns('acc1', 5)
    expect(api).toHaveBeenCalledWith('/api/sync/runs?account_id=acc1&limit=5')
  })
})
