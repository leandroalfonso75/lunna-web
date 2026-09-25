import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CadastroPage from './cadastro.vue'

/**
 * `cadastro.vue` usa `definePageMeta`/`useAuth` (globais auto-importados do
 * Nuxt) — fora do runtime real, stubamos como global antes de montar.
 */
function mountCadastro(signupMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('useAuth', () => ({ signup: signupMock }))

  return mount(CadastroPage, {
    global: {
      stubs: {
        NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] }
      }
    }
  })
}

describe('cadastro', () => {
  let signupMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    signupMock = vi.fn().mockResolvedValue(undefined)
  })

  it('envia companyName/name/email/password ao criar conta', async () => {
    const wrapper = mountCadastro(signupMock)

    await wrapper.get('#company-name').setValue('Empresa Ana')
    await wrapper.get('#name').setValue('Ana')
    await wrapper.get('#email').setValue('ana@empresa.com')
    await wrapper.get('#password').setValue('segredo123')

    await wrapper.get('form').trigger('submit.prevent')

    expect(signupMock).toHaveBeenCalledWith({
      companyName: 'Empresa Ana',
      name: 'Ana',
      email: 'ana@empresa.com',
      password: 'segredo123'
    })
  })

  it('o campo de senha exige mínimo de 8 caracteres', () => {
    const wrapper = mountCadastro(signupMock)
    expect(wrapper.get('#password').attributes('minlength')).toBe('8')
  })

  it('mostra a mensagem de erro da API quando o cadastro falha', async () => {
    signupMock.mockRejectedValue({ data: { errors: ['E-mail já cadastrado.'] } })
    const wrapper = mountCadastro(signupMock)

    await wrapper.get('#company-name').setValue('Empresa Ana')
    await wrapper.get('#name').setValue('Ana')
    await wrapper.get('#email').setValue('ana@empresa.com')
    await wrapper.get('#password').setValue('segredo123')
    await wrapper.get('form').trigger('submit.prevent')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[role="alert"]').text()).toBe('E-mail já cadastrado.')
  })

  it('tem um link para /login', () => {
    const wrapper = mountCadastro(signupMock)
    expect(wrapper.find('a[href="/login"]').exists()).toBe(true)
  })

  it('o botão de mostrar/ocultar alterna o tipo do campo de senha e o aria-pressed', async () => {
    const wrapper = mountCadastro(signupMock)
    const toggle = wrapper.get('[data-test="alternar-senha"]')

    expect(wrapper.get('#password').attributes('type')).toBe('password')
    expect(toggle.attributes('aria-pressed')).toBe('false')

    await toggle.trigger('click')

    expect(wrapper.get('#password').attributes('type')).toBe('text')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    expect(toggle.attributes('aria-label')).toBe('Ocultar senha')
  })

  it('desabilita o botão de criar conta enquanto o cadastro está em andamento', async () => {
    let resolveSignup: () => void = () => {}
    signupMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSignup = resolve
      })
    )
    const wrapper = mountCadastro(signupMock)

    await wrapper.get('#company-name').setValue('Empresa Ana')
    await wrapper.get('#name').setValue('Ana')
    await wrapper.get('#email').setValue('ana@empresa.com')
    await wrapper.get('#password').setValue('segredo123')
    await wrapper.get('form').trigger('submit.prevent')

    const button = wrapper.get('[data-test="signup-submit"]')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.text()).toContain('Criando...')

    resolveSignup()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-test="signup-submit"]').attributes('disabled')).toBeUndefined()
  })
})
