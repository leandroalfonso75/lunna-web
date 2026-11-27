/**
 * Guias da seção Promoções no layout novo (27/11/2026), organizadas pela tarefa do usuário.
 *
 * Antes eram 4 guias (Anúncios, Promoções do ML, Rotina automática, Histórico) e, dentro de Anúncios, 13 subguias de
 * situação. Agora são 5 guias principais com um único nível de filtros (chips). Nada saiu: cada situação da API
 * (`status` de `GET /api/promotions`) continua alcançável num chip, e os endereços antigos (`?aba=` / `?status=`)
 * abrem a guia e o chip certos.
 */
export type PromoTab = 'decidir' | 'automacao' | 'todos' | 'campanhas' | 'historico'

export interface PromoChip {
  /** Valor de `status` enviado à API ('' = sem filtro). */
  value: string
  label: string
  /** Uma linha explicando o filtro (aparece ao passar o mouse e embaixo dos chips). */
  hint: string
  tone?: 'danger' | 'warning' | 'success' | 'accent'
}

export interface PromoTabDef {
  key: PromoTab
  label: string
  /** Uma linha de explicação, embaixo das guias. */
  hint: string
  chips: PromoChip[]
}

export const PROMO_TABS: PromoTabDef[] = [
  {
    key: 'decidir',
    label: 'Decidir agora',
    hint: 'Anúncios em que uma escolha sua aumenta o lucro ou evita vender abaixo da sua margem.',
    chips: [
      { value: 'para_revisar', label: 'Para revisar', hint: 'Nenhuma oferta coube nas suas regras: veja a cabível ou aplique mesmo assim.', tone: 'danger' },
      { value: 'trocar', label: 'Trocar por melhor', hint: 'Existe outra oferta com mais lucro dentro das suas regras.', tone: 'success' },
      { value: 'sem_promocao', label: 'Sem promoção', hint: 'Podem entrar numa oferta.', tone: 'warning' },
      { value: 'abaixo_minima', label: 'Abaixo da mínima', hint: 'A promoção atual deixa a margem abaixo da mínima.', tone: 'danger' },
      { value: 'acima_maxima', label: 'Acima da máxima', hint: 'Margem acima da máxima: um desconto maior pode vender mais.', tone: 'warning' },
      { value: 'sem_custo', label: 'Sem custo', hint: 'Sem custo do produto não dá para calcular a margem: cadastre o custo no ERP.' }
    ]
  },
  {
    key: 'automacao',
    label: 'Automação',
    hint: 'O que o Lunna já está cuidando sozinho, e como a rotina automática está configurada.',
    chips: [
      { value: 'programado', label: 'Programados', hint: 'A troca já está marcada para quando a promoção atual acabar.', tone: 'accent' },
      { value: 'minima_inalcancavel', label: 'Mínima inalcançável', hint: 'Nem o preço cheio atinge a mínima: fica na oferta mais perto dela. Reveja preço ou custo.', tone: 'warning' },
      { value: 'revisar_ciente', label: 'Ciente', hint: 'Anúncios que você tirou de "Para revisar" sem mudar nada.' },
      { value: 'nao_automatizados', label: 'Não automatizados', hint: 'A rotina e o lote não mexem nestes; só muda pela tela.', tone: 'warning' },
      { value: 'rotina', label: 'Rotina automática', hint: 'Horário, modo (simulação ou aplicação real) e as últimas execuções.', tone: 'accent' }
    ]
  },
  {
    key: 'todos',
    label: 'Todos os anúncios',
    hint: 'A lista completa, com busca por anúncio, título ou SKU.',
    chips: [
      { value: '', label: 'Todos', hint: 'Todos os anúncios ativos.' },
      { value: 'ok', label: 'Na melhor oferta', hint: 'Já estão na oferta de maior lucro dentro das regras.', tone: 'success' },
      { value: 'catalogo', label: 'Catálogo', hint: 'Anúncios de catálogo e sincronizados, com quem está ganhando a vitrine.', tone: 'success' }
    ]
  },
  {
    key: 'campanhas',
    label: 'Campanhas do ML',
    hint: 'Promoções e convites da Central de Promoções do Mercado Livre, com os anúncios de cada uma.',
    chips: []
  },
  {
    key: 'historico',
    label: 'Histórico',
    hint: 'Tudo o que foi aplicado, por quem, de onde para onde e o resultado no Mercado Livre.',
    chips: [
      { value: '', label: 'Tudo', hint: 'Todas as ações.' },
      { value: 'falhou', label: 'Falharam', hint: 'O Mercado Livre recusou. Quando dá, o Lunna tenta de novo a cada 2 minutos por 20 minutos e depois de hora em hora.', tone: 'danger' },
      { value: 'forcado', label: 'Mesmo assim', hint: 'Aplicadas ferindo uma regra sua (fica registrada qual).', tone: 'warning' }
    ]
  }
]

/** Chips de lista (os que filtram anúncios na API); "rotina" abre o painel da rotina e não é uma situação. */
export const LIST_TABS: PromoTab[] = ['decidir', 'automacao', 'todos']
export const ROUTINE_CHIP = 'rotina'

/** Recortes: um anúncio também está na guia da sua situação, então ficam fora das somas. */
const SLICES = ['nao_automatizados', 'catalogo', 'catalogo_perdendo']

export function tabDef(key: PromoTab): PromoTabDef {
  return PROMO_TABS.find((t) => t.key === key) ?? PROMO_TABS[0]!
}

/** Quantos anúncios um chip mostra ("Todos" = soma das situações, sem os recortes). */
export function chipCount(counts: Record<string, number> | undefined, value: string): number {
  const c = counts ?? {}
  if (value === '') return Object.entries(c).reduce((a, [k, n]) => (SLICES.includes(k) ? a : a + n), 0)
  return c[value] ?? 0
}

/** Contador da guia: em "Decidir agora", o que pede decisão; em "Automação", o que ela está cuidando. */
export function tabCount(counts: Record<string, number> | undefined, key: PromoTab): number | null {
  const c = counts ?? {}
  if (key === 'decidir') return tabDef('decidir').chips.reduce((a, ch) => a + (c[ch.value] ?? 0), 0)
  if (key === 'automacao') return (c.programado ?? 0) + (c.minima_inalcancavel ?? 0)
  if (key === 'todos') return chipCount(c, '')
  return null
}

/**
 * Chip que abre ao entrar numa guia: em "Decidir agora", o primeiro que tem anúncio (Para revisar antes de tudo);
 * nas outras, o primeiro.
 */
export function defaultChip(key: PromoTab, counts: Record<string, number> | undefined): string {
  const chips = tabDef(key).chips
  if (key === 'decidir') return chips.find((ch) => (counts?.[ch.value] ?? 0) > 0)?.value ?? chips[0]!.value
  return chips[0]?.value ?? ''
}

/** Em qual guia fica uma situação da API (para links antigos e para os cartões do topo). */
export function tabOfStatus(status: string): PromoTab {
  for (const t of PROMO_TABS) {
    if (LIST_TABS.includes(t.key) && t.chips.some((ch) => ch.value === status)) return t.key
  }
  return 'todos'
}

const OLD_TABS: Record<string, PromoTab> = {
  anuncios: 'todos', promocoes: 'campanhas', rotina: 'automacao', historico: 'historico',
  decidir: 'decidir', automacao: 'automacao', todos: 'todos', campanhas: 'campanhas'
}

/**
 * Lê o endereço: aceita o novo (`?aba=decidir&filtro=trocar`) e o antigo (`?aba=anuncios|promocoes|rotina|historico`,
 * `?status=trocar`). Sem nada, abre "Decidir agora" (a guia que pede ação). `chip: null` = escolher pelo contador.
 */
export function resolvePromoRoute(query: Record<string, unknown>): { tab: PromoTab; chip: string | null } {
  const q = (k: string) => (typeof query[k] === 'string' ? (query[k] as string) : '')
  const status = q('filtro') || q('status')
  const aba = q('aba')
  if (aba === 'rotina') return { tab: 'automacao', chip: ROUTINE_CHIP }
  const tab = OLD_TABS[aba]
  if (status && (!tab || LIST_TABS.includes(tab) || tab === 'historico')) {
    if (tab === 'historico') return { tab, chip: tabDef('historico').chips.some((c) => c.value === status) ? status : '' }
    return { tab: tabOfStatus(status), chip: status }
  }
  if (tab) return { tab, chip: tab === 'todos' && aba === 'anuncios' ? '' : null }
  return { tab: 'decidir', chip: null }
}

/** Ações do Histórico que ainda podem estar em nova tentativa: recusa do ML nas últimas 24 h sem acerto depois. */
export function recentFailures<T extends { item_id: string; ok: boolean; created_at: string }>(actions: T[], now: Date = new Date()): T[] {
  const since = now.getTime() - 24 * 3600 * 1000
  const lastOk = new Map<string, number>()
  for (const a of actions) {
    if (a.ok) lastOk.set(a.item_id, Math.max(lastOk.get(a.item_id) ?? 0, new Date(a.created_at).getTime()))
  }
  const seen = new Set<string>()
  return actions.filter((a) => {
    const t = new Date(a.created_at).getTime()
    if (a.ok || t < since || (lastOk.get(a.item_id) ?? 0) > t || seen.has(a.item_id)) return false
    seen.add(a.item_id)
    return true
  })
}
