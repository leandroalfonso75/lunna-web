import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { THEME_STORAGE_KEY } from '../lib/theme'

/**
 * `useTheme` guarda estado module-scope (singleton, mesmo padrão de
 * `useToast`) para os vários `ThemeToggle` da tela lerem e mudarem o MESMO
 * tema. Isso também significa que a inicialização (localStorage salvo,
 * `matchMedia` do sistema) só roda na PRIMEIRA importação do módulo — por
 * isso cada teste que precisa de um cenário de partida diferente reseta os
 * módulos e reimporta depois de armar o `localStorage`/`matchMedia`.
 */

interface MediaQueryListStub {
  matches: boolean
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  listeners: Array<(event: { matches: boolean }) => void>
  fire(matches: boolean): void
}

function stubMatchMedia(initialMatches: boolean): MediaQueryListStub {
  const stub: MediaQueryListStub = {
    matches: initialMatches,
    listeners: [],
    addEventListener: vi.fn((event: string, listener: (e: { matches: boolean }) => void) => {
      if (event === 'change') stub.listeners.push(listener)
    }),
    removeEventListener: vi.fn(),
    fire(matches: boolean) {
      stub.matches = matches
      for (const listener of stub.listeners) listener({ matches })
    }
  }
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => stub)
  )
  return stub
}

async function freshUseTheme() {
  vi.resetModules()
  const mod = await import('./useTheme')
  return mod.useTheme
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('data-theme')
})

describe('useTheme', () => {
  it('o padrão é "claro" quando não há nada salvo, mesmo com o SO escuro', async () => {
    stubMatchMedia(true)
    const useTheme = await freshUseTheme()
    expect(useTheme().mode.value).toBe('claro')
    expect(useTheme().resolved.value).toBe('claro')
  })

  it('sistema sem matchMedia disponível (browser antigo) resolve para claro, sem quebrar', async () => {
    vi.resetModules()
    const original = window.matchMedia
    // @ts-expect-error simula ausência de matchMedia
    delete window.matchMedia
    const { useTheme } = await import('./useTheme')
    expect(useTheme().resolved.value).toBe('claro')
    window.matchMedia = original
  })

  it('lê o modo salvo no localStorage na inicialização', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'escuro')
    stubMatchMedia(false)
    const useTheme = await freshUseTheme()
    expect(useTheme().mode.value).toBe('escuro')
  })

  it('ignora um valor salvo inválido (lixo de uma versão antiga) e cai em "claro"', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'nightmode')
    stubMatchMedia(false)
    const useTheme = await freshUseTheme()
    expect(useTheme().mode.value).toBe('claro')
  })

  it('"sistema" resolve para escuro quando o SO prefere escuro', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'sistema')
    stubMatchMedia(true)
    const useTheme = await freshUseTheme()
    expect(useTheme().resolved.value).toBe('escuro')
  })

  it('"sistema" resolve para claro quando o SO prefere claro', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'sistema')
    stubMatchMedia(false)
    const useTheme = await freshUseTheme()
    expect(useTheme().resolved.value).toBe('claro')
  })

  it('aplica data-theme="dark" no <html> quando o resolvido é escuro', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'escuro')
    stubMatchMedia(false)
    const useTheme = await freshUseTheme()
    useTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('aplica data-theme="light" no <html> quando o resolvido é claro', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'claro')
    stubMatchMedia(true)
    const useTheme = await freshUseTheme()
    useTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('setTheme("escuro") muda o modo, persiste e reaplica o atributo', async () => {
    stubMatchMedia(false)
    const useTheme = await freshUseTheme()
    const theme = useTheme()

    theme.setTheme('escuro')

    expect(theme.mode.value).toBe('escuro')
    expect(theme.resolved.value).toBe('escuro')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('escuro')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('duas chamadas do composable compartilham o mesmo estado (singleton, como useToast)', async () => {
    stubMatchMedia(false)
    const useTheme = await freshUseTheme()
    const a = useTheme()
    const b = useTheme()

    a.setTheme('escuro')

    expect(b.mode.value).toBe('escuro')
  })

  it('em modo "sistema", uma mudança ao vivo do SO (matchMedia change) atualiza o resolvido e o atributo', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'sistema')
    const media = stubMatchMedia(false)
    const useTheme = await freshUseTheme()
    const theme = useTheme()

    expect(theme.resolved.value).toBe('claro')

    media.fire(true)

    expect(theme.resolved.value).toBe('escuro')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('uma mudança do SO é ignorada quando o modo está travado em "claro"/"escuro" (não é "sistema")', async () => {
    const media = stubMatchMedia(false)
    const useTheme = await freshUseTheme()
    const theme = useTheme()

    theme.setTheme('claro')
    media.fire(true)

    expect(theme.mode.value).toBe('claro')
    expect(theme.resolved.value).toBe('claro')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('não explode quando localStorage lança (modo privado/quota) — tema aplicado só nesta sessão', async () => {
    stubMatchMedia(false)
    const useTheme = await freshUseTheme()
    const theme = useTheme()

    const setItem = vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(() => theme.setTheme('escuro')).not.toThrow()
    expect(theme.mode.value).toBe('escuro')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    setItem.mockRestore()
  })
})
