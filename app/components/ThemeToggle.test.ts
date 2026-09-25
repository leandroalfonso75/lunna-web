import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ThemeToggle from './ThemeToggle.vue'
import { THEME_STORAGE_KEY } from '../lib/theme'

/**
 * `useTheme` é module-scope (singleton) — cada teste escolhe explicitamente
 * um tema com `setTheme` antes de checar o resto, em vez de assumir o
 * estado inicial de outro teste.
 */
beforeEach(() => {
  window.localStorage.clear()
})

describe('ThemeToggle', () => {
  it('mostra as três opções Claro/Escuro/Sistema', () => {
    const wrapper = mount(ThemeToggle)
    const radios = wrapper.findAll('[role="radio"]')
    expect(radios).toHaveLength(3)
    expect(radios.map((r) => r.text())).toEqual(['Claro', 'Escuro', 'Sistema'])
  })

  it('é um radiogroup acessível com aria-label', () => {
    const wrapper = mount(ThemeToggle)
    const group = wrapper.get('[role="radiogroup"]')
    expect(group.attributes('aria-label')).toBeTruthy()
  })

  it('marca aria-checked="true" só na opção do modo atual', async () => {
    const wrapper = mount(ThemeToggle)
    await wrapper.get('[data-test="tema-escuro"]').trigger('click')

    expect(wrapper.get('[data-test="tema-claro"]').attributes('aria-checked')).toBe('false')
    expect(wrapper.get('[data-test="tema-escuro"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.get('[data-test="tema-sistema"]').attributes('aria-checked')).toBe('false')
  })

  it('clicar em "Escuro" muda o tema e persiste no localStorage', async () => {
    const wrapper = mount(ThemeToggle)
    await wrapper.get('[data-test="tema-escuro"]').trigger('click')

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('escuro')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('duas instâncias montadas ao mesmo tempo refletem o mesmo estado', async () => {
    const a = mount(ThemeToggle)
    const b = mount(ThemeToggle)

    await a.get('[data-test="tema-escuro"]').trigger('click')
    await b.vm.$nextTick()

    expect(b.get('[data-test="tema-escuro"]').attributes('aria-checked')).toBe('true')
  })

  it('aceita um aria-label customizado', () => {
    const wrapper = mount(ThemeToggle, { props: { label: 'Aparência' } })
    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe('Aparência')
  })
})
