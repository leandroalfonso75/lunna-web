import { describe, expect, it, vi } from 'vitest'
import { createAiPlanClient } from './aiPlanClient'

function buildClient(resolvedValue: unknown = {}) {
  const api = vi.fn().mockResolvedValue(resolvedValue)
  return { api, client: createAiPlanClient(api) }
}

describe('createAiPlanClient', () => {
  it('get faz GET /api/items/:id/ai-plan com account_id', async () => {
    const { api, client } = buildClient({ ai_plan: null })
    const result = await client.get('acc1', 'MLB1')
    expect(api).toHaveBeenCalledWith('/api/items/MLB1/ai-plan', { query: { account_id: 'acc1' } })
    expect(result).toEqual({ ai_plan: null })
  })

  it('generate faz POST (enfileira a geração no servidor)', async () => {
    const { api, client } = buildClient({ ai_plan: { status: 'pending' } })
    await client.generate('acc1', 'MLB1')
    expect(api).toHaveBeenCalledWith('/api/items/MLB1/ai-plan', { method: 'POST', query: { account_id: 'acc1' } })
  })

  it('cancel faz DELETE', async () => {
    const { api, client } = buildClient()
    await client.cancel('acc1', 'MLB1')
    expect(api).toHaveBeenCalledWith('/api/items/MLB1/ai-plan', { method: 'DELETE', query: { account_id: 'acc1' } })
  })
})
