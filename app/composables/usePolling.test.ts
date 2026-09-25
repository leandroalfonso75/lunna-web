import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePolling } from './usePolling'

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
}

beforeEach(() => {
  vi.useFakeTimers()
  setVisibility('visible')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('usePolling', () => {
  it('start() chama o fetcher imediatamente', async () => {
    const fetcher = vi.fn().mockResolvedValue(undefined)
    const { start, stop } = usePolling(fetcher, { intervalMs: 1000 })

    start()
    await vi.advanceTimersByTimeAsync(0)

    expect(fetcher).toHaveBeenCalledTimes(1)
    stop()
  })

  it('relê a cada intervalMs enquanto a aba está visível', async () => {
    const fetcher = vi.fn().mockResolvedValue(undefined)
    const { start, stop } = usePolling(fetcher, { intervalMs: 1000 })

    start()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(1000)

    expect(fetcher).toHaveBeenCalledTimes(3)
    stop()
  })

  it('não relê pelo timer quando a aba está oculta', async () => {
    const fetcher = vi.fn().mockResolvedValue(undefined)
    const { start, stop } = usePolling(fetcher, { intervalMs: 1000 })

    start()
    await vi.advanceTimersByTimeAsync(0)
    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(1000)

    expect(fetcher).toHaveBeenCalledTimes(1)
    stop()
  })

  it('relê na hora ao voltar para a aba (visibilitychange)', async () => {
    const fetcher = vi.fn().mockResolvedValue(undefined)
    const { start, stop } = usePolling(fetcher, { intervalMs: 60_000 })

    start()
    await vi.advanceTimersByTimeAsync(0)
    setVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(fetcher).toHaveBeenCalledTimes(1)

    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)

    expect(fetcher).toHaveBeenCalledTimes(2)
    stop()
  })

  it('nunca sobrepõe leituras: uma chamada em andamento ignora novos disparos', async () => {
    let resolveFirst: () => void = () => {}
    const fetcher = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve
        })
    )
    const { start, stop, refreshNow, refreshing } = usePolling(fetcher, { intervalMs: 1000 })

    start()
    await vi.advanceTimersByTimeAsync(0)
    expect(refreshing.value).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Timer venceu e "Atualizar agora" foi clicado enquanto a 1ª leitura
    // ainda está em voo — nenhum dos dois deve iniciar uma 2ª leitura.
    await vi.advanceTimersByTimeAsync(1000)
    refreshNow()
    expect(fetcher).toHaveBeenCalledTimes(1)

    resolveFirst()
    await vi.advanceTimersByTimeAsync(0)
    expect(refreshing.value).toBe(false)

    stop()
  })

  it('stop() para o timer e o listener de visibilidade', async () => {
    const fetcher = vi.fn().mockResolvedValue(undefined)
    const { start, stop } = usePolling(fetcher, { intervalMs: 1000 })

    start()
    await vi.advanceTimersByTimeAsync(0)
    stop()

    fetcher.mockClear()
    await vi.advanceTimersByTimeAsync(5000)
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)

    expect(fetcher).not.toHaveBeenCalled()
  })
})
