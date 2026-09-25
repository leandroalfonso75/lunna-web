import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiPlan } from '../types/painel'
import type { AiPlanClient } from './aiPlanClient'
import { createAiPlanRunner, type AiPlanState } from './aiPlanRunner'

const plan = (overrides: Partial<AiPlan> = {}): AiPlan => ({
  id: 'p1',
  status: 'running',
  text: '',
  error: null,
  updated_at: '2026-09-25T21:00:00Z',
  ...overrides
})

function setup() {
  const client = {
    get: vi.fn(),
    generate: vi.fn(),
    cancel: vi.fn().mockResolvedValue(undefined)
  } satisfies AiPlanClient
  const runner = createAiPlanRunner(client, { intervalMs: 1000 })
  const state: AiPlanState = { status: 'idle', text: '', error: '' }
  return { client, runner, state }
}

/** Deixa o setTimeout e as promises pendentes rodarem. */
const tick = (ms = 1000) => vi.advanceTimersByTimeAsync(ms)

describe('createAiPlanRunner', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('generate: POST e depois polling mostrando o texto parcial até done', async () => {
    const { client, runner, state } = setup()
    client.generate.mockResolvedValue({ ai_plan: plan({ status: 'pending' }) })
    client.get
      .mockResolvedValueOnce({ ai_plan: plan({ status: 'running', text: 'Diag' }) })
      .mockResolvedValueOnce({ ai_plan: plan({ status: 'done', text: 'Diagnóstico completo.' }) })

    await runner.generate(state, 'acc1', 'MLB1')
    expect(state.status).toBe('loading')
    expect(client.get).not.toHaveBeenCalled()

    await tick()
    expect(state).toMatchObject({ status: 'loading', text: 'Diag' })

    await tick()
    expect(state).toMatchObject({ status: 'done', text: 'Diagnóstico completo.', error: '' })

    await tick(5000)
    expect(client.get).toHaveBeenCalledTimes(2) // parou de consultar depois do done
  })

  it('erro do servidor vira status error com a mensagem, e o polling para', async () => {
    const { client, runner, state } = setup()
    client.generate.mockResolvedValue({ ai_plan: plan({ status: 'pending' }) })
    client.get.mockResolvedValue({ ai_plan: plan({ status: 'error', error: 'Sem créditos na OpenRouter.' }) })

    await runner.generate(state, 'acc1', 'MLB1')
    await tick()

    expect(state).toMatchObject({ status: 'error', error: 'Sem créditos na OpenRouter.' })
    await tick(5000)
    expect(client.get).toHaveBeenCalledTimes(1)
  })

  it('erro ao enfileirar (ex.: 422 de configuração) mostra a mensagem da API', async () => {
    const { client, runner, state } = setup()
    client.generate.mockRejectedValue({ status: 422, data: { errors: ['Configure a chave e o modelo da OpenRouter em Configurações › Empresa.'] } })

    await runner.generate(state, 'acc1', 'MLB1')

    expect(state).toMatchObject({ status: 'error', error: 'Configure a chave e o modelo da OpenRouter em Configurações › Empresa.' })
  })

  it('409 (já está gerando) só passa a acompanhar', async () => {
    const { client, runner, state } = setup()
    client.generate.mockRejectedValue({ status: 409, data: { errors: ['O plano deste anúncio já está sendo gerado.'] } })
    client.get.mockResolvedValue({ ai_plan: plan({ status: 'done', text: 'pronto' }) })

    await runner.generate(state, 'acc1', 'MLB1')
    await tick()

    expect(state).toMatchObject({ status: 'done', text: 'pronto' })
  })

  it('falha de rede passageira no polling não derruba: tenta de novo', async () => {
    const { client, runner, state } = setup()
    client.generate.mockResolvedValue({ ai_plan: plan({ status: 'pending' }) })
    client.get
      .mockRejectedValueOnce(new Error('rede'))
      .mockResolvedValueOnce({ ai_plan: plan({ status: 'done', text: 'ok' }) })

    await runner.generate(state, 'acc1', 'MLB1')
    await tick()
    expect(state.status).toBe('loading')
    await tick()
    expect(state).toMatchObject({ status: 'done', text: 'ok' })
  })

  it('5 falhas seguidas no polling viram erro (não fica "gerando" pra sempre)', async () => {
    const { client, runner, state } = setup()
    client.generate.mockResolvedValue({ ai_plan: plan({ status: 'pending' }) })
    client.get.mockRejectedValue(new Error('rede'))

    await runner.generate(state, 'acc1', 'MLB1')
    await tick(5000)

    expect(state.status).toBe('error')
    expect(state.error).toMatch(/acompanhar a geração/)
  })

  it('load: mostra o último plano salvo sem polling quando já terminou', async () => {
    const { client, runner, state } = setup()
    client.get.mockResolvedValue({ ai_plan: plan({ status: 'done', text: 'plano salvo' }) })

    await runner.load(state, 'acc1', 'MLB1')

    expect(state).toMatchObject({ status: 'done', text: 'plano salvo' })
    await tick(5000)
    expect(client.get).toHaveBeenCalledTimes(1)
  })

  it('load: retoma o polling se o plano ainda está gerando (ex.: recarregou a página)', async () => {
    const { client, runner, state } = setup()
    client.get
      .mockResolvedValueOnce({ ai_plan: plan({ status: 'running', text: 'parcial' }) })
      .mockResolvedValueOnce({ ai_plan: plan({ status: 'done', text: 'final' }) })

    await runner.load(state, 'acc1', 'MLB1')
    expect(state).toMatchObject({ status: 'loading', text: 'parcial' })

    await tick()
    expect(state).toMatchObject({ status: 'done', text: 'final' })
  })

  it('load sem plano salvo deixa idle', async () => {
    const { client, runner, state } = setup()
    client.get.mockResolvedValue({ ai_plan: null })

    await runner.load(state, 'acc1', 'MLB1')

    expect(state).toMatchObject({ status: 'idle', text: '' })
  })

  it('stop: cancela no servidor e sai do "gerando" na hora, mantendo o texto parcial', async () => {
    const { client, runner, state } = setup()
    client.generate.mockResolvedValue({ ai_plan: plan({ status: 'running', text: 'parcial' }) })

    await runner.generate(state, 'acc1', 'MLB1')
    await runner.stop(state, 'acc1', 'MLB1')

    expect(client.cancel).toHaveBeenCalledWith('acc1', 'MLB1')
    expect(state).toMatchObject({ status: 'error', error: 'Interrompido.', text: 'parcial' })
    await tick(5000)
    expect(client.get).not.toHaveBeenCalled()
  })

  it('plano cancelled vindo do servidor aparece como Interrompido', async () => {
    const { client, runner, state } = setup()
    client.get.mockResolvedValue({ ai_plan: plan({ status: 'cancelled', text: 'meio' }) })

    await runner.load(state, 'acc1', 'MLB1')

    expect(state).toMatchObject({ status: 'error', error: 'Interrompido.', text: 'meio' })
  })
})
