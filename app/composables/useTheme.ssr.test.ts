// @vitest-environment node
import { describe, expect, it } from 'vitest'

/**
 * Roda num ambiente `node` de verdade (sem jsdom) — `window`/`document`/
 * `localStorage` não existem, exatamente como no SSR do Nuxt. Importar e
 * chamar `useTheme()` aqui não pode lançar; senão toda página quebraria no
 * servidor antes de qualquer hidratação.
 */
describe('useTheme (SSR — sem window/document)', () => {
  it('importa e chama sem lançar quando não há window', async () => {
    expect(typeof window).toBe('undefined')

    const { useTheme } = await import('./useTheme')
    const theme = useTheme()

    expect(theme.mode.value).toBe('claro')
    expect(theme.resolved.value).toBe('claro')
  })

  it('setTheme também não lança sem window (não persiste, mas não quebra o SSR)', async () => {
    const { useTheme } = await import('./useTheme')
    const theme = useTheme()

    expect(() => theme.setTheme('escuro')).not.toThrow()
    expect(theme.mode.value).toBe('escuro')
  })
})
