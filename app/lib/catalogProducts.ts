/**
 * "Criar Produto com IA" (26/11/2026): produtos cadastrados no Lunna, neutros de ERP. Tipos, regras de tela e cliente da
 * API (/api/catalog_products).
 */
export type CatalogKind = 'simple' | 'variations' | 'kit'
export type CatalogStatus = 'rascunho' | 'em_revisao' | 'pronto'

export interface Component { sku: string; quantity: number }
export interface Variation { key?: string; attrs: Record<string, string>; sku: string | null; gtin: string | null; price: number | null; stock: number | null; kit: boolean; components: Component[] }
export interface SheetRow { name: string; value: string }
export interface Asset { id: number; kind: 'referencia' | 'foto'; name: string | null; mime: string; variation_key: string | null; position: number }
export interface ComponentInfo { name: string; cost: number | null; price: number | null; gtin: string | null }
export interface SkuHit { sku: string; name: string; gtin: string | null; unit: string | null; price: number | null; cost: number | null; kit: boolean }

export interface CatalogProduct {
  id: number; kind: CatalogKind; status: CatalogStatus
  name: string | null; sku: string | null; gtin: string | null; unit: string; price: string | number | null; cost_price: string | number | null
  weight_net: string | number | null; weight_gross: string | number | null
  package_width: number | null; package_height: number | null; package_length: number | null; package_source: 'usuario' | 'ia' | 'nao_encontrado' | null
  stock_control: boolean; initial_stock: string | number | null; min_stock: string | number | null; max_stock: string | number | null
  location: string | null; preparation_days: number | null
  ncm: string | null; cest: string | null; icms_origin: number | null; sped_item_type: string | null
  brand: string | null; line: string | null; model: string | null; category: string | null; condition: string; sale_format: string
  titles: string[]; description: string | null; technical_sheet: SheetRow[]; keywords: string | null; seo_title: string | null; seo_description: string | null; video_url: string | null
  warranty: string | null; supplier: string | null; regulatory: { anvisa?: string }; notes: string | null
  references: { links?: string[]; text?: string }; no_reference_skus: boolean; use_component_references: boolean
  kit_components: Component[]; variation_axes: string[]; variations: Variation[]; common_components: Component[]
  ai_suggestions: { fiscal?: { ncm?: string; cest?: string; icms_origin?: number; sped_item_type?: string; why?: string }; kept?: Record<string, unknown> }
  ai_review: string[]; ai_generated_at: string | null; ai_error: string | null
  erp_exports: Record<string, unknown>; created_at: string; updated_at: string
  assets: Asset[]; components_info: Record<string, ComponentInfo>
}

export interface CatalogSummary { id: number; kind: CatalogKind; status: CatalogStatus; name: string | null; sku: string | null; price: number | null; variations_count: number; components_count: number; updated_at: string; ai_generated_at: string | null; review_count: number; exported: boolean }

export const KIND_LABELS: Record<CatalogKind, string> = { simple: 'Simples', variations: 'Com variações', kit: 'Kit' }
export const STATUS_LABELS: Record<CatalogStatus, string> = { rascunho: 'Rascunho', em_revisao: 'Em revisão', pronto: 'Pronto' }
export const TITLE_MAX = 60
export const AXIS_SUGGESTIONS = ['Cor', 'Voltagem', 'Tamanho', 'Tom']
export const ICMS_ORIGINS = [
  '0 - Nacional', '1 - Estrangeira, importação direta', '2 - Estrangeira, adquirida no mercado interno',
  '3 - Nacional, conteúdo de importação entre 40% e 70%', '4 - Nacional, processos produtivos básicos',
  '5 - Nacional, conteúdo de importação até 40%', '6 - Estrangeira, importação direta sem similar (CAMEX)',
  '7 - Estrangeira, mercado interno sem similar (CAMEX)', '8 - Nacional, conteúdo de importação acima de 70%'
]
export const SPED_TYPES = ['Mercadoria para Revenda', 'Matéria-Prima', 'Embalagem', 'Produto em Processo', 'Produto Acabado', 'Subproduto', 'Produto Intermediário', 'Material de Uso e Consumo', 'Ativo Imobilizado', 'Serviços', 'Outros insumos', 'Outras']

/** Dígito verificador de EAN-8/12/13/14 (igual ao da API). */
export function validGtin(code: string | null | undefined): boolean {
  const c = (code ?? '').trim()
  if (!/^\d+$/.test(c) || ![8, 12, 13, 14].includes(c.length)) return false
  const body = c.slice(0, -1).split('').map(Number).reverse()
  const sum = body.reduce((acc, d, i) => acc + (i % 2 === 0 ? d * 3 : d), 0)
  return (10 - (sum % 10)) % 10 === Number(c.slice(-1))
}

/** Todas as combinações dos valores de cada eixo (ex.: Cor × Tamanho), mantendo SKU/EAN/estoque das linhas que já existiam. */
export function buildGrid(axes: string[], values: Record<string, string[]>, current: Variation[]): Variation[] {
  const lists = axes.map((a) => (values[a] ?? []).map((v) => v.trim()).filter(Boolean))
  if (!axes.length || lists.some((l) => !l.length)) return current
  let combos: Record<string, string>[] = [{}]
  axes.forEach((axis, i) => { combos = combos.flatMap((c) => (lists[i] ?? []).map((v) => ({ ...c, [axis]: v }))) })
  const same = (a: Record<string, string>, b: Record<string, string>) => axes.every((x) => (a[x] ?? '').toLowerCase() === (b[x] ?? '').toLowerCase())
  return combos.map((attrs) => current.find((v) => same(v.attrs, attrs)) ?? { attrs, sku: null, gtin: null, price: null, stock: null, kit: false, components: [] })
}

/** Custo somado de uma composição (kit), com os custos dos SKUs conhecidos; null se faltar custo de algum. */
export function compositionCost(components: Component[], info: Record<string, ComponentInfo | SkuHit>): number | null {
  if (!components.length) return null
  let total = 0
  for (const c of components) {
    const cost = (info[c.sku] as { cost?: number | null } | undefined)?.cost
    if (cost === null || cost === undefined) return null
    total += cost * c.quantity
  }
  return Math.round(total * 100) / 100
}

// ----- Planilha das variações (26/11/2026): CSV com ";" e BOM, que o Excel brasileiro abre em colunas.
const SHEET_FIXED = ['SKU', 'EAN', 'Preço', 'Estoque inicial']

function csvCell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Modelo da planilha: uma coluna por eixo (Cor, Voltagem…) já com as variações preenchidas, e SKU, EAN, preço, estoque. */
export function variationsSheet(axes: string[], variations: Variation[]): string {
  const money = (n: number | null) => (n === null || n === undefined ? '' : String(n).replace('.', ','))
  const lines = [[...axes, ...SHEET_FIXED].map(csvCell).join(';')]
  for (const v of variations) lines.push([...axes.map((a) => v.attrs[a] ?? ''), v.sku ?? '', v.gtin ?? '', money(v.price), v.stock ?? ''].map(csvCell).join(';'))
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}

/** Lê CSV (";" ou ","), com aspas. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '')
  const firstLine = src.split(/\r?\n/, 1)[0] ?? ''
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++ } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) { row.push(cell); cell = '' } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

export interface SheetImport { variations: Variation[]; updated: number; added: number; problems: string[] }

/** Aplica a planilha preenchida: casa as linhas pelos valores dos eixos; combinação nova vira variação nova. */
export function importVariationsSheet(text: string, axes: string[], current: Variation[]): SheetImport {
  const rows = parseCsv(text)
  const problems: string[] = []
  if (!rows.length) return { variations: current, updated: 0, added: 0, problems: ['A planilha está vazia.'] }
  const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const header = rows[0]!.map(norm)
  const col = (name: string) => header.indexOf(norm(name))
  const missing = [...axes, 'SKU', 'EAN'].filter((n) => col(n) < 0)
  if (missing.length) return { variations: current, updated: 0, added: 0, problems: [`Faltam as colunas: ${missing.join(', ')}. Use o modelo baixado.`] }
  const iPrice = col('Preço') >= 0 ? col('Preço') : col('Preco')
  const iStock = col('Estoque inicial')
  const num = (s: string | undefined) => { const t = (s ?? '').trim().replace(/\./g, '').replace(',', '.'); return t === '' || Number.isNaN(Number(t)) ? null : Number(t) }
  const plain = (s: string | undefined) => { const t = (s ?? '').trim(); return t === '' ? null : t }
  const result = current.map((v) => ({ ...v, attrs: { ...v.attrs } }))
  let updated = 0
  let added = 0
  rows.slice(1).forEach((r, k) => {
    const attrs = Object.fromEntries(axes.map((a) => [a, (r[col(a)] ?? '').trim()]))
    if (axes.some((a) => !attrs[a])) { problems.push(`Linha ${k + 2}: falta ${axes.filter((a) => !attrs[a]).join(', ')}.`); return }
    const gtin = plain(r[col('EAN')])
    if (gtin && !validGtin(gtin)) problems.push(`Linha ${k + 2}: EAN ${gtin} inválido (dígito verificador).`)
    // preço com vírgula decimal ("129,90"); sem separador de milhar quando vier com ponto decimal ("129.90")
    const rawPrice = (r[iPrice] ?? '').trim()
    const price = iPrice < 0 ? undefined : (/^\d+\.\d{1,2}$/.test(rawPrice) ? Number(rawPrice) : num(rawPrice))
    const stock = iStock < 0 ? undefined : num(r[iStock])
    const fields = { sku: plain(r[col('SKU')]), gtin, ...(price !== undefined ? { price } : {}), ...(stock !== undefined ? { stock } : {}) }
    const found = result.find((v) => axes.every((a) => norm(v.attrs[a] ?? '') === norm(attrs[a]!)))
    if (found) { Object.assign(found, fields); updated++ } else {
      result.push({ attrs, sku: null, gtin: null, price: null, stock: null, kit: false, components: [], ...fields })
      added++
    }
  })
  return { variations: result, updated, added, problems }
}

type Api = <T>(path: string, options?: Record<string, unknown>) => Promise<T>

export function catalogClient(api: Api) {
  return {
    list: (params: { q?: string; status?: string } = {}) => api<{ products: CatalogSummary[]; total: number }>('/api/catalog_products', { query: params }),
    get: (id: number | string) => api<CatalogProduct>(`/api/catalog_products/${id}`),
    create: (kind: CatalogKind) => api<CatalogProduct>('/api/catalog_products', { method: 'POST', body: { kind } }),
    update: (id: number, body: Partial<CatalogProduct>) => api<CatalogProduct>(`/api/catalog_products/${id}`, { method: 'PATCH', body }),
    remove: (id: number) => api<unknown>(`/api/catalog_products/${id}`, { method: 'DELETE' }),
    generate: (id: number, replace = false) => api<CatalogProduct>(`/api/catalog_products/${id}/generate`, { method: 'POST', body: { replace } }),
    addAsset: (id: number, data: string, name: string) => api<Asset>(`/api/catalog_products/${id}/assets`, { method: 'POST', body: { data, name } }),
    removeAsset: (assetId: number) => api<unknown>(`/api/catalog_product_assets/${assetId}`, { method: 'DELETE' }),
    assetBlob: (assetId: number) => api<Blob>(`/api/catalog_product_assets/${assetId}`, { responseType: 'blob' }),
    skuSearch: (q: string) => api<{ items: SkuHit[] }>('/api/catalog_products/sku_search', { query: { q } })
  }
}
