import { computed, nextTick, reactive, ref, watch } from 'vue'
import { brl, pct } from '../lib/format'
import { promotionValidity } from '../lib/promotionValidity'
import type { PromotionCosts, PromotionItemDetail, PromotionOffer, PromotionSettingsInput, PromotionSpread, PromotionTarget } from '../types/promotions'

/**
 * Lógica do painel de um anúncio em Promoções (custos hoje × depois, ofertas, aplicar / aplicar mesmo assim / cabível /
 * outro valor, sair, não automatizar e limites). Saiu de `PromotionItemPanel.vue` em 27/11/2026 para o painel do layout
 * novo (`PromoPanelNovo.vue`) usar exatamente as mesmas contas e confirmações: nenhuma regra mudou, só o lugar do código.
 */
export interface PromotionPanelProps {
  detail: PromotionItemDetail | null
  saving: boolean
  saveError: string
  groupMode?: boolean
}

export interface PromotionPanelEmit {
  (e: 'save', input: PromotionSettingsInput): void
  (e: 'apply', target: PromotionTarget | undefined, spread: PromotionSpread, goNext: boolean): void
  (e: 'leave', goNext: boolean): void
  (e: 'automation', enabled: boolean, spread: { sku: boolean; variations: boolean }): void
}

export function usePromotionPanel(props: PromotionPanelProps, emit: PromotionPanelEmit) {
  /** Ação esperando confirmação: o que vai acontecer, em texto, antes de mexer no Mercado Livre. `spreadable` = ao entrar
   * numa promoção, dá para levar a mesma aos outros anúncios do SKU e das variações. */
  const pending = ref<{ text: string; run: (goNext: boolean) => void; spreadable?: boolean } | null>(null)
  const spread = reactive<PromotionSpread>({ alsoSku: false, alsoVariations: false })
  /** A caixa de confirmação fica no alto do card; quando o botão clicado está lá embaixo, rola até ela. */
  const dialogEl = ref<HTMLElement | null>(null)
  watch(pending, async (p) => {
    if (!p) return
    await nextTick()
    dialogEl.value?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    dialogEl.value?.querySelector<HTMLElement>('[data-test=confirmar]')?.focus()
  })

  const canApplyBest = computed(() => {
    const d = props.detail
    // "Baixar preço até o alvo" (27/11/2026): a redução cabe na tolerância; a confirmação diz quanto o lucro cai
    return !!d?.best && d.best.action !== 'manter' && (!d.current || !d.current.valid || (d.gain ?? 0) > 0 || d.status.key === 'baixar_alvo')
  })

  function describe(o: { name: string | null; label: string; price: number | null; margin_pct: number | null; profit?: number | null }) {
    const profit = o.profit === null || o.profit === undefined ? '' : `, lucro real ${brl(o.profit)}`
    return `${o.name || o.label} a ${brl(o.price)} (margem real ${pct(o.margin_pct)}${profit})`
  }

  function askBest() {
    const d = props.detail
    if (!d?.best) return
    const from = d.current ? `Sai de ${describe(d.current)} e entra em ` : 'Entra em '
    spread.alsoSku = false
    spread.alsoVariations = false
    const loss = d.current && d.gain !== null && d.gain < 0
      ? ` O lucro por unidade CAI ${brl(Math.abs(d.gain))} (de ${brl(d.current.profit)} para ${brl(d.best.profit)}), para vender mais barato; fica dentro da tolerância de redução.`
      : ''
    pending.value = { text: `${from}${describe(d.best)}.${loss} O preço muda no Mercado Livre na hora.`, run: (goNext) => emit('apply', undefined, { ...spread }, goNext), spreadable: true }
  }

  function askOffer(o: PromotionOffer) {
    const target: PromotionTarget = { promotion_id: o.promotion_id, promotion_type: o.type, action: o.action === 'editar_preco' ? 'editar_preco' : 'aderir' }
    const what = o.action === 'editar_preco' ? `Ajusta o preço em ${describe(o)}` : `${props.detail?.current ? `Sai de ${describe(props.detail.current)} e entra em` : 'Entra em'} ${describe(o)}`
    spread.alsoSku = false
    spread.alsoVariations = false
    pending.value = { text: `${what}. O preço muda no Mercado Livre na hora.`, run: (goNext) => emit('apply', target, { ...spread }, goNext), spreadable: true }
  }

  /** Oferta barrada por uma regra do Lunna (não pelo ML): pode ser aplicada mesmo assim, em qualquer anúncio. */
  function forceable(o: PromotionOffer) {
    return !o.valid && !!o.reason && o.action !== 'manter' && JOINABLE.includes(o.type) && !HARD_REASONS.some((r) => (o.reason ?? '').startsWith(r))
  }
  const blockedOffers = computed(() => (props.detail?.offers ?? []).filter(forceable))

  function askForceOffer(o: PromotionOffer) {
    const target: PromotionTarget = { promotion_id: o.promotion_id, promotion_type: o.type, action: o.action === 'editar_preco' ? 'editar_preco' : 'aderir' }
    spread.alsoSku = false
    spread.alsoVariations = false
    pending.value = {
      text: `Aplica ${describe(o)} mesmo ferindo a regra: ${o.reason}. Fica registrado no Histórico. O preço muda no Mercado Livre na hora.`,
      run: (goNext) => emit('apply', { ...target, force: true }, { ...spread }, goNext), spreadable: true
    }
  }

  function askLeave() {
    const c = props.detail?.current
    if (!c) return
    pending.value = { text: `Tira o anúncio de ${describe(c)}; ele volta ao preço cheio de ${brl(props.detail?.full_price)}.`, run: (goNext) => emit('leave', goNext) }
  }

  /** Preenche o campo de limite com o valor sugerido (o operador confere e salva). */
  function useSuggestion() {
    const s = props.detail?.review?.suggested
    if (!s) return
    form.limit_mode = s.field.endsWith('_price') ? 'price' : 'margin'
    form[s.field] = String(s.value)
  }

  function confirm(goNext = false) {
    pending.value?.run(goNext)
    pending.value = null
  }

  const JOINABLE = ['SELLER_CAMPAIGN', 'DEAL', 'PRICE_DISCOUNT', 'SMART', 'PRICE_MATCHING', 'MARKETPLACE_CAMPAIGN', 'UNHEALTHY_STOCK', 'SMART_LIGHTNING', 'PRE_NEGOTIATED', 'LIGHTNING', 'DOD']

  /** "Não automatizar promoções neste anúncio": ao marcar, abre as opções de levar ao SKU e às variações. */
  const manual = reactive({ on: false, sku: false, variations: false, dirty: false })
  watch(() => props.detail, (d) => {
    if (!d) return
    manual.on = d.manual
    manual.sku = false
    manual.variations = !!props.groupMode
    manual.dirty = false
  }, { immediate: true })
  function saveManual() {
    emit('automation', !manual.on, { sku: manual.sku, variations: manual.variations })
    manual.dirty = false
  }

  const form = reactive<PromotionSettingsInput>({
    limit_mode: 'margin', min_margin_pct: '', max_margin_pct: '', min_price: '', max_price: '', apply_to_sku: false, apply_to_variations: false, rules_note: ''
  })

  const str = (v: number | null) => (v === null ? '' : String(v))

  /** "Limites salvos": aparece quando a gravação termina sem erro e some ao mexer no formulário ou trocar de anúncio. */
  const savedNote = ref('')
  let limitsSubmitted = false
  function submitLimits() {
    savedNote.value = ''
    limitsSubmitted = true
    emit('save', { ...form })
  }
  watch(() => props.saving, (now, before) => {
    if (before && !now && limitsSubmitted) limitsSubmitted = false
    else return
    if (!props.saveError) {
      const others = (form.apply_to_sku ? props.detail?.sku_items.length ?? 0 : 0) + (form.apply_to_variations ? props.detail?.variation_total ?? 0 : 0)
      savedNote.value = others ? `Limites salvos neste anúncio e em mais ${others}.` : 'Limites salvos.'
    }
  })
  watch(() => props.detail?.item_id, () => { savedNote.value = '' })

  watch(() => props.detail, (d) => {
    if (!d) return
    form.limit_mode = d.settings.limit_mode
    form.min_margin_pct = str(d.settings.min_margin_pct)
    form.max_margin_pct = str(d.settings.max_margin_pct)
    form.min_price = str(d.settings.min_price)
    form.max_price = str(d.settings.max_price)
    form.apply_to_sku = d.settings.apply_to_sku
    form.apply_to_variations = props.groupMode ? true : d.settings.apply_to_variations
    if (props.groupMode) form.apply_to_sku = true
    form.rules_note = d.settings.rules_note ?? ''
  }, { immediate: true })

  /** Linhas do quadro de custos: hoje (promoção atual ou preço cheio) e depois da melhor oferta. */
  const COST_ROWS: { key: keyof PromotionCosts; label: string }[] = [
    { key: 'cost', label: 'Custo do produto' },
    { key: 'fee', label: 'Tarifa do ML' },
    { key: 'shipping', label: 'Frete' },
    { key: 'tax', label: 'Imposto' },
    { key: 'fixed_expenses', label: 'Despesas Operacionais' },
    { key: 'ads', label: 'Ads (15 dias)' }
  ]

  const today = computed(() => {
    const d = props.detail
    if (!d) return null
    if (d.current?.costs) return { title: 'Hoje', sub: d.current.name || d.current.label, validity: promotionValidity(d.current), price: d.current.price, profit: d.current.profit, margin: d.current.margin_pct, costs: d.current.costs }
    if (d.base) return { title: 'Hoje', sub: 'sem promoção', validity: '', price: d.base.price, profit: d.base.profit, margin: d.base.margin_pct, costs: d.base.costs }
    return null
  })

  interface CostColumn {
    title: string
    sub: string
    validity: string
    price: number | null
    profit: number | null
    margin: number | null
    costs: PromotionCosts
    tone: 'ok' | 'blocked' | 'fit'
  }

  /** Colunas ao lado de "Hoje": depois da melhor oferta; ou, para revisar, a melhor barrada e a oferta cabível. */
  const cols = computed<CostColumn[]>(() => {
    const d = props.detail
    const b = d?.best
    if (b?.costs && b.action !== 'manter') {
      return [{ title: 'Depois da melhor oferta', sub: b.name || b.label, validity: promotionValidity(b), price: b.price, profit: b.profit, margin: b.margin_pct, costs: b.costs, tone: 'ok' }]
    }
    const out: CostColumn[] = []
    const x = d?.review?.blocked_best
    if (x?.costs) out.push({ title: 'Melhor oferta barrada', sub: `${x.name || x.label} · ${x.reason}`, validity: promotionValidity(x), price: x.price, profit: x.profit, margin: x.margin_pct, costs: x.costs, tone: 'blocked' })
    const f = d?.review?.fitting
    if (f?.costs) {
      out.push({ title: 'Oferta cabível', sub: `${f.name || f.label}${f.soft_reason ? ` · ${f.soft_reason}` : ''}`, validity: promotionValidity(f), price: f.price, profit: f.profit, margin: f.margin_pct, costs: f.costs, tone: 'fit' })
    }
    return out
  })
  const COL_TONE: Record<CostColumn['tone'], string> = { ok: '', blocked: 'text-danger', fit: 'text-success' }

  /** Aplica a oferta cabível (pode ferir a trava de lucro ou a regra de aumento: fica no Histórico). */
  function askFitting() {
    const f = props.detail?.review?.fitting
    if (!f) return
    const target: PromotionTarget = { promotion_id: f.promotion_id, promotion_type: f.type, action: f.action === 'editar_preco' ? 'editar_preco' : 'aderir', force: true }
    const offer = props.detail?.offers.find((o) => o.promotion_id === f.promotion_id && o.type === f.type)
    if (offer?.flexible && f.price !== null) target.price = f.price
    const why = f.soft_reason ? ` Fere a regra: ${f.soft_reason}. Fica registrado no Histórico.` : ''
    spread.alsoSku = false
    spread.alsoVariations = false
    pending.value = {
      text: `${props.detail?.current ? `Sai de ${describe(props.detail.current)} e entra em` : 'Entra em'} ${describe(f)}.${why} O preço muda no Mercado Livre na hora.`,
      run: (goNext) => emit('apply', target, { ...spread }, goNext), spreadable: true
    }
  }

  /** Regras que nem "aplicar mesmo assim" passa (o Mercado Livre recusaria); iguais às da API. */
  const HARD_REASONS = ['não muda o preço', 'encerrada', 'sem preço permitido', 'acima do preço cheio do anúncio', 'sem estoque sugerido', 'estoque insuficiente']

  /** Para revisar: a melhor oferta barrada, que o administrador pode aplicar mesmo assim (ou em outro valor). */
  const blocked = computed(() => {
    const d = props.detail
    const x = d?.review?.blocked_best
    if (!d || !x || x.action === 'manter' || !JOINABLE.includes(x.type)) return null
    const offer = d.offers.find((o) => o.promotion_id === x.promotion_id && o.type === x.type && o.action === x.action) ?? null
    const hard = HARD_REASONS.some((r) => (x.reason ?? '').startsWith(r))
    const target: PromotionTarget = { promotion_id: x.promotion_id, promotion_type: x.type, action: x.action === 'editar_preco' ? 'editar_preco' : 'aderir' }
    return { short: x, offer, hard, target }
  })

  /** "Outro valor": preço final em R$ ou % de desconto sobre o preço cheio. */
  const custom = reactive<{ mode: 'price' | 'pct'; value: string | number }>({ mode: 'price', value: '' })
  watch(() => props.detail?.item_id, () => { custom.value = '' })

  const customPrice = computed(() => {
    const v = Number(String(custom.value).replace(',', '.'))
    const full = props.detail?.full_price ?? 0
    if (!v || v <= 0) return null
    return Math.round((custom.mode === 'pct' ? full * (1 - v / 100) : v) * 100) / 100
  })

  const customRange = computed(() => {
    const o = blocked.value?.offer
    if (!o?.flexible || !props.detail) return null
    return { min: o.min_price ?? 0, max: Math.min(o.max_price ?? Infinity, props.detail.full_price) }
  })

  const customError = computed(() => {
    const p = customPrice.value
    const r = customRange.value
    if (p === null || !r) return ''
    if (p > r.max + 0.005) return `O Mercado Livre só aceita até ${brl(r.max)} nesta oferta.`
    if (r.min && p < r.min - 0.005) return `O Mercado Livre só aceita a partir de ${brl(r.min)} nesta oferta.`
    return ''
  })

  /** Margem e lucro aproximados no valor digitado (tarifa, imposto e despesas acompanham o preço; a conta exata é da API). */
  const customPreview = computed(() => {
    const p = customPrice.value
    const x = blocked.value?.short
    if (p === null || !x?.costs || !x.price) return null
    const c = x.costs
    const k = p / x.price
    const profit = p + c.meli_amount - c.cost - c.fee * k - c.shipping - c.tax * k - c.fixed_expenses * k - c.ads
    const full = props.detail?.full_price ?? 0
    return { profit, margin: (profit / p) * 100, discount: full ? (1 - p / full) * 100 : 0 }
  })

  function askForce() {
    const b = blocked.value
    if (!b) return
    spread.alsoSku = false
    spread.alsoVariations = false
    pending.value = {
      text: `Aplica ${describe(b.short)} mesmo ferindo a regra: ${b.short.reason}. Fica registrado no Histórico. O preço muda no Mercado Livre na hora.`,
      run: (goNext) => emit('apply', { ...b.target, force: true }, { ...spread }, goNext), spreadable: true
    }
  }

  function askCustom() {
    const b = blocked.value
    const p = customPrice.value
    const v = customPreview.value
    if (!b || p === null || !v || customError.value) return
    spread.alsoSku = false
    spread.alsoVariations = false
    pending.value = {
      text: `Aplica ${b.short.name || b.short.label} a ${brl(p)} (${pct(v.discount)} de desconto sobre o preço cheio; margem real aprox. ${pct(v.margin)}, lucro aprox. ${brl(v.profit)}), `
        + 'mesmo que fira as regras do anúncio. Fica registrado no Histórico. O preço muda no Mercado Livre na hora.',
      run: (goNext) => emit('apply', { ...b.target, price: p, force: true }, { ...spread }, goNext), spreadable: true
    }
  }

  const ACTION: Record<string, string> = { manter: 'Como está hoje', editar_preco: 'Ajustar o preço', aderir: 'Entrar' }

  function range(o: { min_price: number | null; max_price: number | null }) {
    return o.min_price && o.max_price ? `${brl(o.min_price)} a ${brl(o.max_price)}` : ''
  }

  function isBest(o: { promotion_id: string | null; type: string; action: string; price: number | null }) {
    const b = props.detail?.best
    return !!b && b.promotion_id === o.promotion_id && b.type === o.type && b.action === o.action && b.price === o.price
  }

  function cancel() {
    pending.value = null
  }

  return {
    pending, spread, dialogEl, canApplyBest, askBest, askOffer, forceable, blockedOffers, askForceOffer, askLeave, useSuggestion,
    confirm, cancel, JOINABLE, manual, saveManual, form, savedNote, submitLimits, COST_ROWS, today, cols, COL_TONE, askFitting,
    blocked, custom, customPrice, customRange, customError, customPreview, askForce, askCustom, ACTION, range, isBest
  }
}
