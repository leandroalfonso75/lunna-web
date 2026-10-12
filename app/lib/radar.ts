/**
 * Radar Mercado Livre (protótipo): consulta de anúncios de uma base coletada
 * no site do Mercado Livre (`public/radar/data.json`), filtrada no navegador.
 *
 * ATENÇÃO — exceção temporária à regra "regra de negócio só no back": nesta
 * fase de testes a base é um arquivo estático e os filtros rodam aqui. Quando
 * o Radar for para a lunna-api, estas funções viram o contrato do endpoint.
 */

/** Linha da base: [id, título, categoria, catálogo(0/1), vendedor, marca, dia (epoch/86400), vendas, preço, nota×10]. */
export type RadarRow = [number, string, string, number, number, number, number, number, number, number]

export interface RadarData {
  ref: number
  note: string
  sellerNote: string
  root: string
  /** [id, nome, pai] */
  cats: [string, string, string | null][]
  sellers: string[]
  brands: string[]
  topSellers: string[]
  topBrands: string[]
  items: RadarRow[]
}

export interface RadarItem {
  id: number
  title: string
  catId: string
  catName: string
  isCatalog: boolean
  seller: string
  brand: string
  sellerKey: string
  brandKey: string
  /** Caminhos completos da categoria e de todas as suas ancestrais. */
  pathKeys: string[]
  /** Dia de criação (epoch / 86400). */
  day: number
  sold: number
  price: number
  rating: number | null
  /** Vendas por mês desde a criação. */
  monthlyAvg: number
  revenue: number
}

/** Nó da árvore de categorias, identificado pelo caminho completo ("A > B > C"). */
export interface RadarCategory {
  key: string
  name: string
  children: string[]
  /** Anúncios da base nesta categoria (incluindo subcategorias). */
  count: number
}

export interface RadarIndex {
  refDay: number
  items: RadarItem[]
  tree: Record<string, RadarCategory>
  /** Categorias de topo, em ordem alfabética. */
  roots: string[]
}

export const CATEGORY_SEP = ' > '

export type RadarSort = 'rev' | 'avg' | 'sold' | 'date' | 'price_d' | 'price_a' | 'rat'
export type CatalogMode = 'only' | 'excl' | 'both'
export type ListingType = 'all' | 'cat' | 'tra'

export interface RadarFilters {
  /** Caminho completo da categoria escolhida ('' = todas). */
  category: string
  /** Período em dias (0 = todos). Ignorado se `customDays` estiver preenchido. */
  period: number
  customDays: string
  catalog: CatalogMode
  type: ListingType
  seller: string
  brand: string
  priceMin: string
  priceMax: string
  revMin: string
  revMax: string
  soldMin: string
  soldMax: string
  /** '' = qualquer · 'none' = sem avaliação · '4.5' = nota mínima. */
  rating: string
  sort: RadarSort
}

export const PERIODS = [15, 30, 60, 90, 120, 150, 180]

export function defaultFilters(): RadarFilters {
  return {
    category: '', period: 180, customDays: '', catalog: 'both', type: 'all',
    seller: '', brand: '', priceMin: '', priceMax: '', revMin: '', revMax: '',
    soldMin: '', soldMax: '', rating: '', sort: 'rev'
  }
}

/** Minúsculas e sem acento, para busca por texto. */
export function normalize(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/**
 * Monta o índice de busca. `categoryPaths` é a lista completa de categorias
 * do Mercado Livre ("Categoria > Sub > Sub"); categorias da base que não
 * estiverem na lista entram na árvore mesmo assim.
 */
export function buildIndex(data: RadarData, categoryPaths: string[] = []): RadarIndex {
  const tree: Record<string, RadarCategory> = {}
  const touch = (path: string[]): string[] => {
    const keys: string[] = []
    path.forEach((name, i) => {
      const key = path.slice(0, i + 1).join(CATEGORY_SEP)
      if (!tree[key]) {
        tree[key] = { key, name, children: [], count: 0 }
        if (i > 0) tree[path.slice(0, i).join(CATEGORY_SEP)]?.children.push(key)
      }
      keys.push(key)
    })
    return keys
  }
  for (const p of categoryPaths) touch(p.split(CATEGORY_SEP))

  const byId = new Map(data.cats.map(([id, name, parent]) => [id, { name, parent }]))
  const namePath = (id: string): string[] => {
    const out: string[] = []
    for (let c = byId.get(id); c; c = c.parent ? byId.get(c.parent) : undefined) out.unshift(c.name)
    return out
  }
  const items = data.items.map((row): RadarItem => {
    const [id, title, catId, isCatalog, sellerIdx, brandIdx, day, sold, price, rating] = row
    const seller = sellerIdx >= 0 ? (data.sellers[sellerIdx] ?? '') : ''
    const brand = brandIdx >= 0 ? (data.brands[brandIdx] ?? '') : ''
    const months = Math.max(Math.max(data.ref - day, 1) / 30.4375, 1)
    const pathKeys = touch(namePath(catId))
    return {
      id, title, catId, catName: byId.get(catId)?.name ?? '', pathKeys, isCatalog: !!isCatalog,
      seller, brand, sellerKey: normalize(seller), brandKey: normalize(brand), day, sold, price,
      rating: rating ? rating / 10 : null, monthlyAvg: sold / months, revenue: sold * price
    }
  })
  for (const it of items) for (const k of it.pathKeys) { const c = tree[k]; if (c) c.count++ }
  for (const c of Object.values(tree)) c.children.sort((x, y) => (tree[x]?.name ?? '').localeCompare(tree[y]?.name ?? '', 'pt'))
  const roots = Object.values(tree).filter((c) => !c.key.includes(CATEGORY_SEP)).map((c) => c.key)
  roots.sort((x, y) => (tree[x]?.name ?? '').localeCompare(tree[y]?.name ?? '', 'pt'))
  return { refDay: data.ref, items, tree, roots }
}

/** Filhos diretos de uma categoria ('' = categorias de topo). */
export function childrenOf(index: RadarIndex, key: string): RadarCategory[] {
  const keys = key ? (index.tree[key]?.children ?? []) : index.roots
  return keys.map((k) => index.tree[k]).filter((c): c is RadarCategory => !!c)
}

/** Seletores em cascata: um por nível, até a categoria mais funda escolhida (+1 vazio). */
export function categoryLevels(index: RadarIndex, selected: string): { options: RadarCategory[]; value: string }[] {
  const names = selected ? selected.split(CATEGORY_SEP) : []
  const levels: { options: RadarCategory[]; value: string }[] = []
  let parent = ''
  for (let i = 0; ; i++) {
    const options = childrenOf(index, parent)
    if (!options.length) break
    const value = names.length > i ? names.slice(0, i + 1).join(CATEGORY_SEP) : ''
    levels.push({ options, value })
    if (!value) break
    parent = value
  }
  return levels
}

/** Categoria ao escolher `value` no nível `level` ('' volta para a do nível anterior). */
export function pickCategory(selected: string, level: number, value: string): string {
  if (value) return value
  return selected ? selected.split(CATEGORY_SEP).slice(0, level).join(CATEGORY_SEP) : ''
}

const toNum = (v: string): number | null => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v))

const SORTERS: Record<RadarSort, (a: RadarItem, b: RadarItem) => number> = {
  avg: (a, b) => b.monthlyAvg - a.monthlyAvg,
  rev: (a, b) => b.revenue - a.revenue,
  sold: (a, b) => b.sold - a.sold,
  date: (a, b) => b.day - a.day,
  price_d: (a, b) => b.price - a.price,
  price_a: (a, b) => a.price - b.price,
  rat: (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.sold - a.sold
}

export function effectiveDays(f: RadarFilters): number {
  const custom = parseInt(f.customDays, 10)
  return Number.isFinite(custom) && custom > 0 ? custom : f.period
}

export function filterItems(index: RadarIndex, f: RadarFilters): RadarItem[] {
  const cat = f.category
  const days = effectiveDays(f)
  const minDay = days ? index.refDay - days : -Infinity
  const seller = normalize(f.seller)
  const brand = normalize(f.brand)
  const pMin = toNum(f.priceMin), pMax = toNum(f.priceMax)
  const rMin = toNum(f.revMin), rMax = toNum(f.revMax)
  const sMin = toNum(f.soldMin), sMax = toNum(f.soldMax)
  const minRating = f.rating && f.rating !== 'none' ? Number(f.rating) : null

  const out = index.items.filter((it) => {
    if (cat && !it.pathKeys.includes(cat)) return false
    if (it.day < minDay) return false
    if (f.catalog === 'only' && !it.isCatalog) return false
    if (f.catalog === 'excl' && it.isCatalog) return false
    if (f.catalog === 'both' && f.type !== 'all' && (f.type === 'cat') !== it.isCatalog) return false
    if (seller && !it.sellerKey.includes(seller)) return false
    if (brand && !it.brandKey.includes(brand)) return false
    if (pMin != null && it.price < pMin) return false
    if (pMax != null && it.price > pMax) return false
    if (sMin != null && it.sold < sMin) return false
    if (sMax != null && it.sold > sMax) return false
    if (rMin != null && it.revenue < rMin) return false
    if (rMax != null && it.revenue > rMax) return false
    if (f.rating === 'none') return !it.rating
    if (minRating != null && (!it.rating || it.rating < minRating)) return false
    return true
  })
  return out.sort(SORTERS[f.sort])
}

export interface RadarSummary {
  total: number
  catalog: number
  traditional: number
  sold: number
  revenue: number
  medianPrice: number
}

export function summarize(items: RadarItem[]): RadarSummary {
  const catalog = items.filter((i) => i.isCatalog).length
  const prices = items.map((i) => i.price).sort((a, b) => a - b)
  return {
    total: items.length,
    catalog,
    traditional: items.length - catalog,
    sold: items.reduce((a, i) => a + i.sold, 0),
    revenue: items.reduce((a, i) => a + i.revenue, 0),
    medianPrice: prices.length ? (prices[Math.floor(prices.length / 2)] ?? 0) : 0
  }
}

export function itemUrl(id: number): string {
  return `https://produto.mercadolivre.com.br/MLB-${id}-_JM`
}

/** "dd/mm/aaaa" a partir do dia (epoch / 86400), em UTC. */
export function formatDay(day: number): string {
  const [y, m, d] = new Date(day * 86400000).toISOString().slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/** Divide um texto com `<b>…</b>` em trechos, sem usar v-html. */
export function splitBold(html: string): { text: string; bold: boolean }[] {
  const parts: { text: string; bold: boolean }[] = []
  for (const piece of html.split(/(<b>.*?<\/b>)/g)) {
    if (!piece) continue
    const m = /^<b>(.*)<\/b>$/.exec(piece)
    parts.push({ text: (m ? m[1] : piece.replace(/<[^>]+>/g, '')) ?? '', bold: !!m })
  }
  return parts
}

export function toTsv(items: RadarItem[], limit = 5000): string {
  const head = ['ID', 'Anúncio', 'Tipo', 'Categoria', 'Vendedor', 'Marca', 'Criado em', 'Vendas', 'Média/mês', 'Preço', 'Receita', 'Avaliação', 'Link']
  const lines = items.slice(0, limit).map((it) => [
    `MLB${it.id}`, it.title, it.isCatalog ? 'Catálogo' : 'Tradicional', it.catName, it.seller, it.brand,
    formatDay(it.day), it.sold, Math.round(it.monthlyAvg), String(it.price).replace('.', ','),
    Math.round(it.revenue), it.rating ? String(it.rating).replace('.', ',') : '', itemUrl(it.id)
  ].join('\t'))
  return [head.join('\t'), ...lines].join('\n')
}
