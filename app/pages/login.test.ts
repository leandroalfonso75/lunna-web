import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import LoginPage from './login.vue'

/**
 * `login.vue` usa `definePageMeta`/`useAuth`/`useRoute` (globais
 * auto-importados do Nuxt) — fora do runtime real, stubamos como global
 * antes de montar.
 */
function mountLogin(loginMock: ReturnType<typeof vi.fn>, query: Record<string, string> = {}) {
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('useAuth', () => ({ login: loginMock }))
  vi.stubGlobal('useRoute', () => ({ query }))

  return mount(LoginPage, {
    global: {
      stubs: {
        NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] }
      }
    }
  })
}

describe('login', () => {
  let loginMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    loginMock = vi.fn().mockResolvedValue(undefined)
  })

  it('envia e-mail e senha ao entrar', async () => {
    const wrapper = mountLogin(loginMock)

    await wrapper.get('#email').setValue('ana@empresa.com')
    await wrapper.get('#password').setValue('segredo123')
    await wrapper.get('form').trigger('submit.prevent')

    expect(loginMock).toHaveBeenCalledWith('ana@empresa.com', 'segredo123')
  })

  it('mostra o aviso de sessão expirada quando ?motivo=sessao_expirada', () => {
    const wrapper = mountLogin(loginMock, { motivo: 'sessao_expirada' })
    expect(wrapper.get('[data-test="sessao-expirada"]').text()).toBe('Sua sessão expirou. Entre novamente.')
  })

  it('não mostra o aviso sem o parâmetro', () => {
    const wrapper = mountLogin(loginMock)
    expect(wrapper.find('[data-test="sessao-expirada"]').exists()).toBe(false)
  })

  it('mostra a mensagem de erro da API quando o login falha', async () => {
    loginMock.mockRejectedValue({ data: { errors: ['E-mail ou senha inválidos.'] } })
    const wrapper = mountLogin(loginMock)

    await wrapper.get('#email').setValue('ana@empresa.com')
    await wrapper.get('#password').setValue('errada')
    await wrapper.get('form').trigger('submit.prevent')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[role="alert"]').text()).toBe('E-mail ou senha inválidos.')
  })

  it('tem um link para /cadastro', () => {
    const wrapper = mountLogin(loginMock)
    expect(wrapper.find('a[href="/cadastro"]').exists()).toBe(true)
  })
})
