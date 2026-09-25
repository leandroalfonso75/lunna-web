import { describe, expect, it, vi } from 'vitest'
import { createAiPlanStreamer } from './aiPlanStream'

function bodyStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let i = 0
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]))
        i++
        return
      }
      controller.close()
    }
  })
}

function callbacks() {
  return { onData: vi.fn(), onDone: vi.fn(), onError: vi.fn() }
}

describe('createAiPlanStreamer', () => {
  it('faz POST com Authorization: Bearer <token> e lê o stream até "event: done"', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: bodyStream(['data: "Diagnóst', 'ico: tudo bem"\n\n', 'event: done\n\n'])
    } as unknown as Response)

    const streamAiPlan = createAiPlanStreamer({ baseURL: 'https://api.lunna.test', getToken: () => 'tok123', fetchFn })
    const cb = callbacks()

    await streamAiPlan({ itemId: 'MLB1', accountId: 'acc1', signal: new AbortController().signal, ...cb })

    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.lunna.test/api/items/MLB1/ai-plan?account_id=acc1',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok123' })
      })
    )
    expect(cb.onData).toHaveBeenCalledWith('Diagnóstico: tudo bem')
    expect(cb.onDone).toHaveBeenCalledTimes(1)
    expect(cb.onError).not.toHaveBeenCalled()
  })

  it('403 chama onError com mensagem de permissão', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 403, body: null } as unknown as Response)
    const streamAiPlan = createAiPlanStreamer({ baseURL: 'https://api.lunna.test', getToken: () => 'tok', fetchFn })
    const cb = callbacks()

    await streamAiPlan({ itemId: 'MLB1', accountId: 'acc1', signal: new AbortController().signal, ...cb })

    expect(cb.onError).toHaveBeenCalledWith('Você não tem permissão para gerar este plano.')
  })

  it('429 chama onError com mensagem de limite ("tente em instantes")', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 429, body: null } as unknown as Response)
    const streamAiPlan = createAiPlanStreamer({ baseURL: 'https://api.lunna.test', getToken: () => 'tok', fetchFn })
    const cb = callbacks()

    await streamAiPlan({ itemId: 'MLB1', accountId: 'acc1', signal: new AbortController().signal, ...cb })

    expect(cb.onError).toHaveBeenCalledWith('Limite de uso atingido. Tente em instantes.')
  })

  it('erro genérico (500) chama onError com mensagem padrão', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 500, body: null } as unknown as Response)
    const streamAiPlan = createAiPlanStreamer({ baseURL: 'https://api.lunna.test', getToken: () => 'tok', fetchFn })
    const cb = callbacks()

    await streamAiPlan({ itemId: 'MLB1', accountId: 'acc1', signal: new AbortController().signal, ...cb })

    expect(cb.onError).toHaveBeenCalledWith('Não foi possível gerar o plano agora. Tente de novo.')
  })

  it('abortar (Parar) durante a chamada chama onError com "Interrompido.", nunca onDone', async () => {
    const controller = new AbortController()
    let rejectFetch: (err: unknown) => void = () => {}
    const fetchFn = vi.fn(
      () =>
        new Promise<Response>((_resolve, reject) => {
          rejectFetch = reject
        })
    )

    const streamAiPlan = createAiPlanStreamer({ baseURL: 'https://api.lunna.test', getToken: () => 'tok', fetchFn })
    const cb = callbacks()

    const pending = streamAiPlan({ itemId: 'MLB1', accountId: 'acc1', signal: controller.signal, ...cb })

    controller.abort()
    rejectFetch(new DOMException('Aborted', 'AbortError'))
    await pending

    expect(cb.onError).toHaveBeenCalledWith('Interrompido.')
    expect(cb.onDone).not.toHaveBeenCalled()
  })

  it('sem token não manda header Authorization', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, body: bodyStream(['event: done\n\n']) } as unknown as Response)
    const streamAiPlan = createAiPlanStreamer({ baseURL: 'https://api.lunna.test', getToken: () => null, fetchFn })

    await streamAiPlan({ itemId: 'MLB1', accountId: 'acc1', signal: new AbortController().signal, ...callbacks() })

    const headers = fetchFn.mock.calls[0]![1].headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })
})
