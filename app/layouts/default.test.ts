import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * `default.vue` usa vários composables auto-importados pelo Nuxt (`useAuth`,
 * `useRoute`, ...) sem import explícito — montá-lo de verdade pediria o
 * ambiente do Nuxt inteiro, que este `vitest.config.ts` não carrega. Uma
 * checagem estática do template é o que garante as regras de layout sem
 * esse peso (mesmo padrão do timeia e do W1).
 */
const LAYOUT_PATH = join(dirname(fileURLToPath(import.meta.url)), 'default.vue')
const source = readFileSync(LAYOUT_PATH, 'utf-8')

describe('layouts/default.vue (sidebar SaaS)', () => {
  it('a sidebar fica escondida abaixo de 1024px (lg:) e visível a partir daí', () => {
    expect(source).toContain('hidden lg:sticky')
    expect(source).toContain('lg:flex')
  })

  it('a barra compacta e a gaveta só existem abaixo de 1024px (lg:hidden)', () => {
    const occurrences = source.split('lg:hidden').length - 1
    expect(occurrences).toBeGreaterThanOrEqual(2) // barra compacta + gaveta
  })

  it('mostra as 4 rotas do painel na navegação: Visão geral, Anúncios, Curva ABC, Configurações', () => {
    expect(source).toContain("{ to: '/', label: 'Visão geral', icon: HomeIcon }")
    expect(source).toContain("{ to: '/anuncios', label: 'Anúncios', icon: ListBulletIcon }")
    expect(source).toContain("{ to: '/curva-abc', label: 'Curva ABC', icon: ChartBarIcon }")
    expect(source).toContain("{ to: '/configuracoes', label: 'Configurações', icon: Cog6ToothIcon }")
  })

  it('mostra Vendas logo abaixo de Anúncios', () => {
    const anuncios = source.indexOf("{ to: '/anuncios'")
    const vendas = source.indexOf("{ to: '/vendas', label: 'Vendas', icon: ShoppingBagIcon }")
    const abc = source.indexOf("{ to: '/curva-abc'")
    expect(vendas).toBeGreaterThan(anuncios)
    expect(vendas).toBeLessThan(abc)
  })

  it('mostra Produtos logo abaixo de Visão geral', () => {
    const visao = source.indexOf("{ to: '/', label: 'Visão geral'")
    const produtos = source.indexOf("{ to: '/produtos', label: 'Produtos', icon: CubeIcon }")
    const anuncios = source.indexOf("{ to: '/anuncios'")
    expect(visao).toBeGreaterThan(-1)
    expect(produtos).toBeGreaterThan(visao)
    expect(produtos).toBeLessThan(anuncios)
  })

  it('mostra o Radar Mercado Livre no menu Painel', () => {
    expect(source).toContain("{ to: '/radar-ml', label: 'Radar Mercado Livre', icon: SignalIcon }")
  })

  it('o seletor de conta ML só aparece com pelo menos 1 conta', () => {
    expect(source).toContain('session.mlAccounts.length >= 1')
  })

  it('sem conta e admin, mostra o atalho "Conectar conta"', () => {
    expect(source).toContain('session.isAdmin')
    expect(source).toContain('Conectar conta')
  })

  it('mostra o ícone da marca (32px, alt vazio porque o texto "Lunna" está ao lado) na sidebar e na gaveta', () => {
    const occurrences = source.split('/brand/lunna-mark-128.png').length - 1
    expect(occurrences).toBe(2) // sidebar + gaveta
    expect(source).toContain('alt=""')
  })

  it('importa e usa o ThemeToggle', () => {
    expect(source).toContain("import ThemeToggle from '../components/ThemeToggle.vue'")
    expect(source).toContain('<ThemeToggle')
  })

  it('tem um botão "Sair" ligado a auth.logout()', () => {
    expect(source).toContain('const sair = () => auth.logout()')
    expect(source).toContain('@click="sair"')
  })

  it('mostra nome e empresa do usuário no rodapé da sidebar', () => {
    expect(source).toContain('session.user?.name')
    expect(source).toContain('session.company?.name')
  })

  it('a gaveta fecha ao navegar (watch de route.fullPath) e usa o Dialog do headlessui (foco preso, Esc/clique fora fecha, foco volta ao abrir)', () => {
    expect(source).toContain('watch(() => route.fullPath, closeDrawer)')
    expect(source).toContain("import { Dialog, DialogPanel } from '@headlessui/vue'")
    expect(source).toContain('<Dialog')
    expect(source).toContain('@close="closeDrawer"')
  })

  it('a barra compacta lê título e selo de sync de usePageHeader() (a página escreve, o layout só lê)', () => {
    expect(source).toContain("import { usePageHeader } from '../composables/usePageHeader'")
    expect(source).toContain('header.state.title')
    expect(source).toContain('header.state.sync')
  })

  it('nunca rola na horizontal: nenhuma classe overflow-x adicionada ao contêiner raiz', () => {
    expect(source).not.toContain('overflow-x-auto"')
  })
})
