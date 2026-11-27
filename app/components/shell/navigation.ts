import {
  ArchiveBoxIcon, BanknotesIcon, ChartBarIcon, ChatBubbleLeftRightIcon, Cog6ToothIcon, CubeIcon, EnvelopeIcon, HomeIcon,
  ListBulletIcon, MegaphoneIcon, QuestionMarkCircleIcon, ShoppingBagIcon, SignalIcon, SparklesIcon, TagIcon
} from '@heroicons/vue/24/outline'
import type { Component } from 'vue'

/**
 * Menu do novo layout (27/11/2026): agrupado pelo que a pessoa vai fazer (vender, cuidar do catálogo, atender, gerir),
 * para caber inteiro numa tela de notebook (1366×768) sem rolar.
 */
export interface NavItem { to: string; label: string; icon: Component; keywords?: string }
export interface NavGroup { label: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  { label: 'Início', items: [{ to: '/', label: 'Visão geral', icon: HomeIcon, keywords: 'painel inicio dashboard resumo' }] },
  {
    label: 'Vendas e marketing',
    items: [
      { to: '/vendas', label: 'Vendas', icon: ShoppingBagIcon, keywords: 'pedidos lucro' },
      { to: '/anuncios', label: 'Anúncios', icon: ListBulletIcon, keywords: 'mlb catalogo' },
      { to: '/promocoes', label: 'Promoções', icon: TagIcon, keywords: 'desconto oferta' },
      { to: '/ads', label: 'Ads', icon: MegaphoneIcon, keywords: 'publicidade campanhas acos roas' }
    ]
  },
  {
    label: 'Catálogo e estoque',
    items: [
      { to: '/produtos', label: 'Produtos', icon: CubeIcon, keywords: 'erp olist sku' },
      { to: '/estoque', label: 'Estoque', icon: ArchiveBoxIcon, keywords: 'full reposição' },
      { to: '/curva-abc', label: 'Curva ABC', icon: ChartBarIcon, keywords: 'fotos ia modelo' }
    ]
  },
  {
    label: 'Atendimento',
    items: [
      { to: '/perguntas', label: 'Perguntas', icon: QuestionMarkCircleIcon, keywords: 'responder compradores' },
      { to: '/mensagens', label: 'Mensagens', icon: EnvelopeIcon, keywords: 'pós-venda' },
      { to: '/reclamacoes', label: 'Reclamações', icon: ChatBubbleLeftRightIcon, keywords: 'mediação devolução' }
    ]
  },
  {
    label: 'Gestão',
    items: [
      { to: '/financeiro', label: 'Financeiro', icon: BanknotesIcon, keywords: 'dre repasses despesas' },
      { to: '/radar-ml', label: 'Radar Mercado Livre', icon: SignalIcon, keywords: 'concorrência coleta' }
    ]
  }
]

export const SETTINGS_ITEM: NavItem = { to: '/configuracoes', label: 'Configurações', icon: Cog6ToothIcon, keywords: 'empresa usuários contas impostos' }

/** Atalhos de ação na busca rápida (Ctrl+K), além das páginas. */
export const QUICK_ACTIONS: NavItem[] = [
  { to: '/produtos/ia/novo', label: 'Criar Produto com IA', icon: SparklesIcon, keywords: 'novo cadastro kit variações' },
  { to: '/perguntas', label: 'Responder perguntas', icon: QuestionMarkCircleIcon, keywords: 'atender' },
  { to: '/vendas?period=today', label: 'Vendas de hoje', icon: ShoppingBagIcon, keywords: 'hoje pedidos' }
]

export function isActivePath(path: string, to: string): boolean {
  const base = to.split('?')[0] ?? to
  if (base === '/') return path === '/'
  return path === base || path.startsWith(`${base}/`)
}

/** Busca sem acento e sem diferenciar maiúsculas. */
export function matches(item: NavItem, query: string): boolean {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const q = norm(query.trim())
  if (!q) return true
  return norm(`${item.label} ${item.keywords ?? ''}`).includes(q)
}
