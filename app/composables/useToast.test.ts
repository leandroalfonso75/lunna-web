import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToast } from './useToast'

/**
 * `useToast` é um estado global (module-scope) — cada teste limpa o que
 * sobrou do anterior para não vazar toasts de um teste para o outro.
 */
beforeEach(() => {
  vi.useFakeTimers()
  useToast().toasts.splice(0)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useToast', () => {
  it('começa vazio', () => {
    expect(useToast().toasts).toEqual([])
  })

  it('success() empilha um toast de sucesso com o texto dado', () => {
    const toast = useToast()
    toast.success('Sincronização iniciada.')
    expect(toast.toasts).toHaveLength(1)
    expect(toast.toasts[0]).toMatchObject({ kind: 'success', text: 'Sincronização iniciada.' })
  })

  it('error() empilha um toast de erro', () => {
    const toast = useToast()
    toast.error('Não foi possível salvar agora.')
    expect(toast.toasts[0]).toMatchObject({ kind: 'error', text: 'Não foi possível salvar agora.' })
  })

  it('info() empilha um toast informativo', () => {
    const toast = useToast()
    toast.info('Conexão feita com sucesso.')
    expect(toast.toasts[0]).toMatchObject({ kind: 'info', text: 'Conexão feita com sucesso.' })
  })

  it('dá a cada toast um id único e estável', () => {
    const toast = useToast()
    toast.success('Um')
    toast.success('Dois')
    expect(toast.toasts[0]!.id).not.toBe(toast.toasts[1]!.id)
  })

  it('a mesma instância do composable compartilha estado entre duas chamadas (singleton)', () => {
    useToast().success('Visível de outro lugar')
    expect(useToast().toasts).toHaveLength(1)
  })

  it('dismiss() remove um toast pelo id', () => {
    const toast = useToast()
    const id = toast.success('Some depois')
    toast.dismiss(id)
    expect(toast.toasts).toEqual([])
  })

  it('auto-descarta um toast depois de 5 segundos', () => {
    const toast = useToast()
    toast.success('Some sozinho')
    expect(toast.toasts).toHaveLength(1)

    vi.advanceTimersByTime(4999)
    expect(toast.toasts).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(toast.toasts).toHaveLength(0)
  })

  it('não lança se dismiss() rodar duas vezes para o mesmo toast', () => {
    const toast = useToast()
    const id = toast.success('Fechar na mão')
    toast.dismiss(id)
    vi.advanceTimersByTime(5000)
    expect(toast.toasts).toEqual([])
  })
})
