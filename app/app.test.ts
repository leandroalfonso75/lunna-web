import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './app.vue'
import { themeAntiFlashScript } from './lib/theme'

/**
 * `app.vue` usa `useHead` (auto-import do Nuxt) fora do runtime real —
 * stubamos como global e capturamos o que foi passado.
 */
function mountApp() {
  return mount(App, {
    global: {
      stubs: {
        NuxtRouteAnnouncer: true,
        NuxtLayout: true,
        NuxtPage: true
      }
    }
  })
}

describe('app.vue — script anti-flash do tema', () => {
  let useHeadMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    useHeadMock = vi.fn()
    vi.stubGlobal('useHead', useHeadMock)
  })

  it('registra um <script> inline com o texto do anti-flash do tema', () => {
    mountApp()

    expect(useHeadMock).toHaveBeenCalled()
    const call = useHeadMock.mock.calls.find(([config]) => Array.isArray(config?.script))
    expect(call).toBeTruthy()

    const [config] = call!
    const scriptEntry = config.script.find((entry: any) => entry.innerHTML === themeAntiFlashScript())
    expect(scriptEntry).toBeTruthy()
  })

  it('o script vai para o <head>, antes de qualquer outro (tagPriority critical)', () => {
    mountApp()

    const call = useHeadMock.mock.calls.find(([config]) => Array.isArray(config?.script))
    const [config] = call!
    const scriptEntry = config.script.find((entry: any) => entry.innerHTML === themeAntiFlashScript())

    expect(scriptEntry.tagPosition).toBe('head')
    expect(scriptEntry.tagPriority).toBe('critical')
  })

  it('mantém o titleTemplate (não regride o título das páginas)', () => {
    mountApp()

    const call = useHeadMock.mock.calls.find(([config]) => typeof config?.titleTemplate === 'function')
    expect(call).toBeTruthy()
    const [config] = call!
    expect(config.titleTemplate('Configurações')).toBe('Configurações · Lunna')
    expect(config.titleTemplate('Lunna')).toBe('Lunna')
  })
})
