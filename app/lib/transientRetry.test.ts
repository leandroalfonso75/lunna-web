import { describe, expect, it, vi } from 'vitest'
import { isTransientError, withTransientRetry } from './transientRetry'

function errorWithStatus(status: number) {
  return { response: { status } }
}

describe('isTransientError', () => {
  it.each([429, 502, 503, 504])('%i é temporário', (status) => {
    expect(isTransientError(errorWithStatus(status))).toBe(true)
  })

  it.each([400, 401, 403, 404, 422, 500])('%i não é temporário', (status) => {
    expect(isTransientError(errorWithStatus(status))).toBe(false)
  })

  it('erro sem status (falha de rede) é temporário', () => {
    expect(isTransientError(new Error('network error'))).toBe(true)
  })

  it('AbortError (requisição cancelada de propósito) nunca é temporário', () => {
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    expect(isTransientError(abortError)).toBe(false)
  })
})

describe('withTransientRetry', () => {
  it('devolve o resultado direto quando a primeira tentativa funciona, sem esperar', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    await expect(withTransientRetry(fn, 4000)).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('erro não-temporário relança na hora, sem tentar de novo', async () => {
    const fn = vi.fn().mockRejectedValue(errorWithStatus(422))
    await expect(withTransientRetry(fn, 4000)).rejects.toEqual(errorWithStatus(422))
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('erro temporário tenta de novo uma vez após o delay', async () => {
    vi.useFakeTimers()
    const fn = vi.fn().mockRejectedValueOnce(errorWithStatus(503)).mockResolvedValueOnce('ok na segunda')

    const promise = withTransientRetry(fn, 4000)
    await vi.advanceTimersByTimeAsync(4000)

    await expect(promise).resolves.toBe('ok na segunda')
    expect(fn).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('se a segunda tentativa também falhar, relança o erro (só tenta uma vez)', async () => {
    vi.useFakeTimers()
    const fn = vi.fn().mockRejectedValue(errorWithStatus(429))

    const promise = withTransientRetry(fn, 4000)
    promise.catch(() => {})
    await vi.advanceTimersByTimeAsync(4000)

    await expect(promise).rejects.toEqual(errorWithStatus(429))
    expect(fn).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})
