<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { brl, pct } from '../../lib/format'
import { promotionValidity } from '../../lib/promotionValidity'
import type { PromotionCosts, PromotionItemDetail, PromotionOffer, PromotionSettingsInput, PromotionSpread, PromotionTarget } from '../../types/promotions'

/**
 * Painel de um anúncio na seção Promoções: os custos por unidade hoje e depois da melhor promoção (lucro e margem
 * reais, pós Ads), todas as ofertas com preço, parte do ML, tarifa e margem (a melhor marcada), os limites do
 * anúncio por margem ou por valor (com a opção de aplicar ao SKU e às variações) e, para
 * administradores, aplicar a melhor oferta, entrar numa oferta ou sair da promoção, sempre com confirmação.
 */
const props = defineProps<{
  detail: PromotionItemDetail | null
  loading: boolean
  error: string
  isAdmin: boolean
  saving: boolean
  saveError: string
  acting: boolean
  actionResult: { ok: boolean; message: string } | null
  /** Painel do produto com variações: só os limites, aplicados a todas as variações e aos anúncios do SKU. */
  groupMode?: boolean
  groupCount?: number
  /** Há um próximo anúncio na lista (mostra "Próximo" e "Confirmar e ir para o próximo"). */
  hasNext?: boolean
}>()
const emit = defineEmits<{
  save: [input: PromotionSettingsInput]
  apply: [target: PromotionTarget | undefined, spread: PromotionSpread, goNext: boolean]
  leave: [goNext: boolean]
  next: []
  automation: [enabled: boolean, spread: { sku: boolean; variations: boolean }]
}>()

/** Ação esperando confirmação: o que vai acontecer, em texto, antes de mexer no Mercado Livre. `spreadable` = ao entrar
 * numa promoção, dá para levar a mesma aos outros anúncios do SKU e das variações. */
const pending = ref<{ text: string; run: (goNext: boolean) => void; spreadable?: boolean } | null>(null)
const spread = reactive<PromotionSpread>({ alsoSku: false, alsoVariations: false })

const canApplyBest = computed(() => {
  const d = props.detail
  return !!d?.best && d.best.action !== 'manter' && (!d.current || !d.current.valid || (d.gain ?? 0) > 0)
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
  pending.value = { text: `${from}${describe(d.best)}. O preço muda no Mercado Livre na hora.`, run: (goNext) => emit('apply', undefined, { ...spread }, goNext), spreadable: true }
}

function askOffer(o: PromotionOffer) {
  const target: PromotionTarget = { promotion_id: o.promotion_id, promotion_type: o.type, action: o.action === 'editar_preco' ? 'editar_preco' : 'aderir' }
  const what = o.action === 'editar_preco' ? `Ajusta o preço em ${describe(o)}` : `${props.detail?.current ? `Sai de ${describe(props.detail.current)} e entra em` : 'Entra em'} ${describe(o)}`
  spread.alsoSku = false
  spread.alsoVariations = false
  pending.value = { text: `${what}. O preço muda no Mercado Livre na hora.`, run: (goNext) => emit('apply', target, { ...spread }, goNext), spreadable: true }
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
    const others = (form.apply_to_sku ? props.detail?.sku_items.length ?? 0 : 0) + (form.apply_to_variations ? props.detail?.variation_items.length ?? 0 : 0)
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
  { key: 'fixed_expenses', label: 'Despesas fixas' },
  { key: 'ads', label: 'Ads (15 dias)' }
]

const today = computed(() => {
  const d = props.detail
  if (!d) return null
  if (d.current?.costs) return { title: 'Hoje', sub: d.current.name || d.current.label, validity: promotionValidity(d.current), price: d.current.price, profit: d.current.profit, margin: d.current.margin_pct, costs: d.current.costs }
  if (d.base) return { title: 'Hoje', sub: 'sem promoção', validity: '', price: d.base.price, profit: d.base.profit, margin: d.base.margin_pct, costs: d.base.costs }
  return null
})

const after = computed(() => {
  const d = props.detail
  const b = d?.best
  if (b?.costs && b.action !== 'manter') return { title: 'Depois da melhor oferta', sub: b.name || b.label, validity: promotionValidity(b), price: b.price, profit: b.profit, margin: b.margin_pct, costs: b.costs, blocked: false }
  // Para revisar: a melhor oferta barrada, com a regra que a barrou
  const x = d?.review?.blocked_best
  if (x?.costs) return { title: 'Melhor oferta barrada', sub: `${x.name || x.label} · ${x.reason}`, validity: promotionValidity(x), price: x.price, profit: x.profit, margin: x.margin_pct, costs: x.costs, blocked: true }
  return null
})

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
  pending.value = {
    text: `Aplica ${describe(b.short)} mesmo ferindo a regra: ${b.short.reason}. Fica registrado no Histórico. O preço muda no Mercado Livre na hora.`,
    run: (goNext) => emit('apply', { ...b.target, force: true }, { alsoSku: false, alsoVariations: false }, goNext)
  }
}

function askCustom() {
  const b = blocked.value
  const p = customPrice.value
  const v = customPreview.value
  if (!b || p === null || !v || customError.value) return
  pending.value = {
    text: `Aplica ${b.short.name || b.short.label} a ${brl(p)} (${pct(v.discount)} de desconto sobre o preço cheio; margem real aprox. ${pct(v.margin)}, lucro aprox. ${brl(v.profit)}), `
      + 'mesmo que fira as regras do anúncio. Fica registrado no Histórico. O preço muda no Mercado Livre na hora.',
    run: (goNext) => emit('apply', { ...b.target, price: p, force: true }, { alsoSku: false, alsoVariations: false }, goNext)
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
</script>

<template>
  <p v-if="loading" class="text-[13px] text-ink-3">Carregando ofertas…</p>
  <p v-else-if="error" class="text-[13px] text-danger" role="alert">{{ error }}</p>

  <div v-else-if="detail" class="grid grid-cols-1 gap-4 text-[13px]" :class="groupMode ? 'xl:grid-cols-2' : 'xl:grid-cols-4'" data-test="promo-detail">
    <div v-if="groupMode" class="card p-4 text-[12px] text-ink-2">
      <p class="font-semibold text-ink">Limites do produto</p>
      <p class="mt-1">
        O que você salvar aqui vale para todos os {{ groupCount ?? detail.variation_items.length + 1 }} anúncios deste produto (todas as variações e os
        anúncios do mesmo SKU). Para ver as ofertas e aplicar uma promoção, abra cada anúncio na lista.
      </p>
      <p v-if="detail.review" class="mt-2 text-danger">Este produto tem anúncios para revisar: {{ detail.review.label }}.</p>
    </div>
    <div v-else class="card overflow-x-auto p-4 xl:col-span-3">
      <div class="mb-1 flex flex-wrap items-center gap-2">
        <p class="font-semibold text-ink">Ofertas deste anúncio</p>
        <div v-if="isAdmin" class="ml-auto flex gap-2">
          <button v-if="canApplyBest" type="button" class="btn-primary h-8 px-3 text-[12px]" :disabled="acting" data-test="aplicar-melhor" @click="askBest">
            Aplicar a melhor oferta
          </button>
          <button v-if="detail.current" type="button" class="btn-link text-[12px]" :disabled="acting" @click="askLeave">Sair da promoção</button>
          <button v-if="hasNext" type="button" class="btn-link text-[12px]" :disabled="acting" data-test="proximo" title="Abre o próximo anúncio da lista sem mudar nada neste" @click="emit('next')">
            Próximo anúncio →
          </button>
        </div>
      </div>
      <div v-if="pending" class="my-2 rounded-card border border-warning bg-warning-soft p-3 text-[12px]" role="alertdialog" aria-label="Confirmar ação no Mercado Livre">
        <p class="text-ink">{{ pending.text }}</p>
        <div v-if="pending.spreadable && (detail.sku_items.length || detail.variation_items.length)" class="mt-2 space-y-1 text-ink-2">
          <label v-if="detail.sku_items.length" class="flex items-start gap-2">
            <input v-model="spread.alsoSku" type="checkbox" class="mt-0.5" />
            <span>Aplicar a mesma promoção aos outros {{ detail.sku_items.length }} {{ detail.sku_items.length === 1 ? 'anúncio' : 'anúncios' }} do SKU {{ detail.sku }}</span>
          </label>
          <label v-if="detail.variation_items.length" class="flex items-start gap-2">
            <input v-model="spread.alsoVariations" type="checkbox" class="mt-0.5" />
            <span>Aplicar a mesma promoção aos {{ detail.variation_items.length }} anúncios das outras variações do produto</span>
          </label>
          <p class="text-[11px] text-ink-3">Cada um entra pelo próprio preço de venda e pelos próprios limites; o que não couber fica no Histórico com o motivo.</p>
        </div>
        <div class="mt-2 flex gap-2">
          <button type="button" class="btn-primary h-8 px-3 text-[12px]" :disabled="acting" data-test="confirmar" @click="confirm(false)">Confirmar</button>
          <button v-if="hasNext" type="button" class="btn-primary h-8 px-3 text-[12px]" :disabled="acting" data-test="confirmar-proximo" @click="confirm(true)">
            Confirmar e ir para o próximo
          </button>
          <button type="button" class="btn-link text-[12px]" @click="pending = null">Cancelar</button>
        </div>
      </div>
      <p v-if="acting" class="my-2 text-[12px] text-ink-2" role="status">Falando com o Mercado Livre…</p>
      <p v-else-if="actionResult" class="my-2 text-[12px]" :class="actionResult.ok ? 'text-success' : 'text-danger'" role="status">{{ actionResult.message }}</p>
      <p class="mb-3 text-[12px] text-ink-3">
        Preço cheio {{ brl(detail.full_price) }} · custo {{ detail.cost === null ? 'sem custo' : brl(detail.cost) }}
        · Ads nos últimos {{ detail.ads.days }} dias:
        <template v-if="detail.ads.spend > 0">{{ brl(detail.ads.spend) }} ÷ {{ detail.ads.units }} {{ detail.ads.units === 1 ? 'unidade' : 'unidades' }} = {{ brl(detail.ads.unit) }} por unidade<template v-if="detail.ads.units === 0"> (gastou sem vender; fica zero na conta)</template></template>
        <template v-else>sem gasto (zero na conta)</template>
      </p>

      <div v-if="today" class="mb-4 overflow-x-auto rounded-card border border-line" data-test="custos">
        <table class="w-full border-collapse text-[12px]">
          <thead>
            <tr class="border-b border-line text-ink-2">
              <th scope="col" class="px-3 py-1.5 text-left font-semibold">Por unidade</th>
              <th scope="col" class="px-3 py-1.5 text-right font-semibold">
                {{ today.title }}<span class="block text-[11px] font-normal text-ink-3">{{ today.sub }}</span>
                <span v-if="today.validity" class="block text-[11px] font-normal text-ink-3" data-test="validade-hoje">Validade: {{ today.validity }}</span>
              </th>
              <th v-if="after" scope="col" class="px-3 py-1.5 text-right font-semibold" :class="after.blocked ? 'text-danger' : ''">{{ after.title }}<span class="block text-[11px] font-normal" :class="after.blocked ? 'text-danger' : 'text-ink-3'">{{ after.sub }}</span>
                <span v-if="after.validity" class="block text-[11px] font-normal text-ink-3" data-test="validade-melhor">Validade: {{ after.validity }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-b border-line">
              <td class="px-3 py-1">Preço de venda</td>
              <td class="px-3 py-1 text-right" data-numeric>{{ brl(today.price) }}</td>
              <td v-if="after" class="px-3 py-1 text-right" data-numeric>{{ brl(after.price) }}</td>
            </tr>
            <tr v-if="today.costs.meli_amount || after?.costs.meli_amount" class="border-b border-line">
              <td class="px-3 py-1">Parte paga pelo ML</td>
              <td class="px-3 py-1 text-right" data-numeric>+ {{ brl(today.costs.meli_amount) }}</td>
              <td v-if="after" class="px-3 py-1 text-right" data-numeric>+ {{ brl(after.costs.meli_amount) }}</td>
            </tr>
            <tr v-for="r in COST_ROWS" :key="r.key" class="border-b border-line text-ink-2">
              <td class="px-3 py-1">{{ r.label }}</td>
              <td class="px-3 py-1 text-right" data-numeric>− {{ brl(today.costs[r.key]) }}</td>
              <td v-if="after" class="px-3 py-1 text-right" data-numeric>− {{ brl(after.costs[r.key]) }}</td>
            </tr>
            <tr class="font-semibold">
              <td class="px-3 py-1.5">Lucro real (pós Ads)</td>
              <td class="px-3 py-1.5 text-right" data-numeric :class="(today.profit ?? 0) < 0 ? 'text-danger' : 'text-success'">{{ brl(today.profit) }} · {{ pct(today.margin) }}</td>
              <td v-if="after" class="px-3 py-1.5 text-right" data-numeric :class="(after.profit ?? 0) < 0 ? 'text-danger' : 'text-success'">{{ brl(after.profit) }} · {{ pct(after.margin) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="isAdmin && blocked" class="mb-4 rounded-card border border-danger p-3 text-[12px]" data-test="forcar">
        <p class="font-semibold text-ink">Aplicar fora das regras</p>
        <p class="mt-0.5 text-ink-2">
          A melhor oferta está barrada por: <span class="text-danger">{{ blocked.short.reason }}</span>. Você pode aplicá-la mesmo assim ou escolher outro valor;
          o Lunna registra no Histórico a regra que foi ferida.
        </p>
        <p v-if="blocked.hard" class="mt-1 text-danger">Esta não dá para aplicar: o Mercado Livre recusaria ({{ blocked.short.reason }}).</p>
        <div v-else class="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
          <button type="button" class="btn-primary h-8 px-3 text-[12px]" :disabled="acting" data-test="aplicar-mesmo-assim" @click="askForce">
            Aplicar mesmo assim ({{ brl(blocked.short.price) }})
          </button>
          <template v-if="customRange">
            <div class="flex items-end gap-2">
              <label class="block">
                <span class="block text-[11px] text-ink-3">Outro valor</span>
                <select v-model="custom.mode" class="input h-8 w-[170px] text-[12px]" aria-label="Tipo de valor">
                  <option value="price">Preço final (R$)</option>
                  <option value="pct">Desconto (%) sobre o cheio</option>
                </select>
              </label>
              <input
                v-model="custom.value"
                type="number"
                step="0.01"
                min="0"
                class="input h-8 w-[110px] text-[12px]"
                :placeholder="custom.mode === 'price' ? 'ex.: 89,90' : 'ex.: 15'"
                :aria-label="custom.mode === 'price' ? 'Preço final em reais' : 'Desconto em porcentagem'"
                data-test="outro-valor"
              />
              <button type="button" class="btn-secondary h-8 px-3 text-[12px]" :disabled="acting || !customPreview || !!customError" data-test="aplicar-outro-valor" @click="askCustom">
                Aplicar este valor
              </button>
            </div>
            <p class="w-full text-[11px] text-ink-3">
              Faixa aceita pelo Mercado Livre: {{ brl(customRange.min) }} a {{ brl(customRange.max) }}.
              <template v-if="customPreview && !customError">
                Fica {{ brl(customPrice) }} ({{ pct(customPreview.discount) }} de desconto) · margem real aprox.
                <span :class="customPreview.profit < 0 ? 'text-danger' : 'text-ink'">{{ pct(customPreview.margin) }}</span>, lucro aprox. {{ brl(customPreview.profit) }}.
              </template>
              <span v-if="customError" class="text-danger">{{ customError }}</span>
            </p>
          </template>
          <p v-else class="text-[11px] text-ink-3">Esta oferta tem preço fixo dado pelo Mercado Livre: não dá para escolher outro valor.</p>
        </div>
      </div>
      <table class="w-full border-collapse text-[12px]">
        <thead>
          <tr class="border-b border-line text-left text-ink-2">
            <th scope="col" class="py-1.5 pr-2 font-semibold">Promoção</th>
            <th scope="col" class="py-1.5 pr-2 font-semibold">Situação</th>
            <th scope="col" class="py-1.5 pr-2 text-right font-semibold">Preço</th>
            <th scope="col" class="py-1.5 pr-2 text-right font-semibold">Parte do ML</th>
            <th scope="col" class="py-1.5 pr-2 text-right font-semibold">Tarifa</th>
            <th scope="col" class="py-1.5 pr-2 text-right font-semibold">Margem real<span class="block text-[10px] font-normal text-ink-3">pós Ads, e lucro</span></th>
            <th scope="col" class="py-1.5 pr-2 font-semibold">Validade</th>
            <th v-if="isAdmin" scope="col" class="py-1.5"><span class="sr-only">Ação</span></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(o, i) in detail.offers"
            :key="i"
            class="border-b border-line align-top"
            :class="[isBest(o) ? 'bg-success-soft' : '', o.valid ? '' : 'text-ink-3']"
          >
            <td class="py-1.5 pr-2">
              <span class="font-medium" :class="o.valid ? 'text-ink' : ''">{{ o.name || o.label }}</span>
              <span class="block text-[11px] text-ink-3">{{ o.label }}<template v-if="o.flexible"> · faixa {{ range(o) }}</template><template v-if="o.stock_reserved"> · reserva {{ o.stock_reserved }} un.</template></span>
              <span v-if="isBest(o)" class="mt-0.5 inline-block rounded bg-success px-1.5 text-[10px] font-semibold text-white">Melhor margem</span>
            </td>
            <td class="py-1.5 pr-2">
              {{ ACTION[o.action] }}
              <span v-if="o.reason" class="block text-[11px]">{{ o.reason }}</span>
            </td>
            <td class="py-1.5 pr-2 text-right" data-numeric>{{ o.price ? brl(o.price) : '—' }}</td>
            <td class="py-1.5 pr-2 text-right" data-numeric>{{ o.meli_amount ? brl(o.meli_amount) : '—' }}</td>
            <td class="py-1.5 pr-2 text-right" data-numeric>{{ o.fee === null ? '—' : brl(o.fee) }}</td>
            <td class="py-1.5 pr-2 text-right font-medium" data-numeric :class="!o.valid && o.margin_pct !== null ? 'text-danger' : ''">
              {{ o.margin_pct === null ? '—' : pct(o.margin_pct) }}
              <span v-if="o.profit !== null" class="block text-[11px] font-normal text-ink-3">{{ brl(o.profit) }}</span>
            </td>
            <td class="py-1.5 pr-2 text-[11px]">{{ promotionValidity(o, true) }}</td>
            <td v-if="isAdmin" class="py-1.5 text-right">
              <button
                v-if="o.valid && o.action !== 'manter' && JOINABLE.includes(o.type)"
                type="button"
                class="btn-link text-[12px]"
                :disabled="acting"
                @click="askOffer(o)"
              >{{ o.action === 'editar_preco' ? 'Ajustar' : 'Entrar' }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="space-y-4">
    <div class="card space-y-2 p-4" :class="manual.on ? 'border-warning' : ''" data-test="nao-automatizar">
      <label class="flex items-start gap-2 text-[13px]">
        <input v-model="manual.on" type="checkbox" class="mt-0.5" :disabled="!isAdmin" @change="manual.dirty = true" />
        <span>
          <span class="font-semibold text-ink">Não automatizar promoções {{ groupMode ? 'neste produto' : 'neste anúncio' }}</span>
          <span class="block text-[11px] text-ink-3">A rotina automática e o lote não mexem; só muda pela tela. A melhor oferta continua sugerida.</span>
        </span>
      </label>
      <template v-if="manual.dirty || manual.on !== detail.manual">
        <label v-if="detail.variation_items.length && !groupMode" class="ml-6 flex items-start gap-2 text-[12px] text-ink-2">
          <input v-model="manual.variations" type="checkbox" class="mt-0.5" :disabled="!isAdmin" />
          <span>Aplicar também às outras variações do produto ({{ detail.variation_items.length }} anúncios)</span>
        </label>
        <label v-if="detail.sku_items.length" class="ml-6 flex items-start gap-2 text-[12px] text-ink-2">
          <input v-model="manual.sku" type="checkbox" class="mt-0.5" :disabled="!isAdmin" />
          <span>Aplicar também aos outros {{ detail.sku_items.length }} anúncios do mesmo SKU</span>
        </label>
        <button v-if="isAdmin" type="button" class="btn-primary h-8 w-full text-[12px]" :disabled="saving" @click="saveManual">
          {{ manual.on ? 'Marcar como não automatizado' : 'Voltar a automatizar' }}
        </button>
      </template>
    </div>
    <form class="card space-y-3 p-4" @submit.prevent="submitLimits">
      <p class="font-semibold text-ink">{{ groupMode ? 'Limites do produto (todas as variações)' : 'Limites deste anúncio' }}</p>
      <div v-if="detail.review && !groupMode" class="space-y-1 rounded-card border border-danger bg-danger-soft px-2 py-1.5 text-[12px] text-danger" data-test="review-reason">
        <p><span class="font-semibold">Para revisar:</span> {{ detail.review.label }}</p>
        <p v-if="detail.review.blocked_best">Melhor oferta barrada: {{ detail.review.blocked_best.label }}<template v-if="detail.review.blocked_best.name"> “{{ detail.review.blocked_best.name }}”</template> a {{ brl(detail.review.blocked_best.price) }} · {{ detail.review.blocked_best.shortfall }}</p>
        <p v-if="detail.review.suggestion" class="text-ink">
          <span class="font-semibold">Para caber:</span> {{ detail.review.suggestion }}
          <button v-if="isAdmin && detail.review.suggested" type="button" class="btn-link ml-1 text-[12px]" data-test="usar-sugestao" @click="useSuggestion">Usar a sugestão</button>
        </p>
        <p v-if="detail.review.reasons.length > 1" class="text-ink-3">Outras regras: {{ detail.review.reasons.slice(1).map((r) => `${r.reason} (${r.offers})`).join('; ') }}</p>
      </div>
      <div class="flex rounded-md border border-line p-0.5 text-[12px]" role="radiogroup" aria-label="Limitar a promoção por">
        <button type="button" role="radio" :aria-checked="form.limit_mode === 'margin'" class="flex-1 rounded px-2 py-1"
          :class="form.limit_mode === 'margin' ? 'bg-primary-soft font-semibold text-primary' : 'text-ink-2'" :disabled="!isAdmin" @click="form.limit_mode = 'margin'">Por margem (%)</button>
        <button type="button" role="radio" :aria-checked="form.limit_mode === 'price'" class="flex-1 rounded px-2 py-1"
          :class="form.limit_mode === 'price' ? 'bg-primary-soft font-semibold text-primary' : 'text-ink-2'" :disabled="!isAdmin" @click="form.limit_mode = 'price'">Por valor (R$)</button>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <label class="block">
          <span class="text-[12px] text-ink-2">Margem mínima (%)</span>
          <input v-model="form.min_margin_pct" type="number" step="0.1" class="input mt-1 h-9 w-full" :placeholder="`Geral: ${detail.settings.effective_min_pct}`" :disabled="!isAdmin || form.limit_mode !== 'margin'" />
        </label>
        <label class="block">
          <span class="text-[12px] text-ink-2">Margem máxima (%)</span>
          <input v-model="form.max_margin_pct" type="number" step="0.1" class="input mt-1 h-9 w-full" :placeholder="detail.settings.effective_max_pct === null ? 'Sem teto' : `Geral: ${detail.settings.effective_max_pct}`" :disabled="!isAdmin || form.limit_mode !== 'margin'" />
        </label>
        <label class="block">
          <span class="text-[12px] text-ink-2">Valor mínimo (R$)</span>
          <input v-model="form.min_price" type="number" step="0.01" class="input mt-1 h-9 w-full" placeholder="Sem piso" :disabled="!isAdmin || form.limit_mode !== 'price'" />
        </label>
        <label class="block">
          <span class="text-[12px] text-ink-2">Valor máximo (R$)</span>
          <input v-model="form.max_price" type="number" step="0.01" class="input mt-1 h-9 w-full" placeholder="Sem teto" :disabled="!isAdmin || form.limit_mode !== 'price'" />
        </label>
      </div>
      <p class="text-[11px] text-ink-3">
        <template v-if="form.limit_mode === 'margin'">Margem real, pós Ads. Acima da máxima o Lunna aplica um desconto maior, para o preço não subir demais.</template>
        <template v-else>Preço da promoção. Oferta abaixo do valor mínimo não entra; nas de faixa, o preço fica até o valor máximo.</template>
      </p>
      <label class="block">
        <span class="text-[12px] text-ink-2">Regras específicas deste anúncio{{ groupMode ? ' (todas as variações)' : '' }} · texto livre</span>
        <textarea v-model="form.rules_note" rows="3" class="input mt-1 w-full py-1.5 text-[12px]" maxlength="2000" :disabled="!isAdmin"
          placeholder="Ex.: nunca entrar em oferta relâmpago; manter abaixo de R$ 199,90 na Black Friday" />
        <span class="mt-1 block text-[11px] text-ink-3">Fica guardado com o anúncio e aparece na lista; a rotina automática não mexe em anúncio com regra própria.</span>
      </label>
      <label v-if="detail.sku_items.length" class="flex items-start gap-2">
        <input v-model="form.apply_to_sku" type="checkbox" class="mt-0.5" :disabled="!isAdmin || groupMode" />
        <span class="text-[12px] text-ink-2">
          Aplicar aos outros {{ detail.sku_items.length }} {{ detail.sku_items.length === 1 ? 'anúncio' : 'anúncios' }} do SKU {{ detail.sku }}
          <span class="block text-[11px] text-ink-3">{{ detail.sku_items.map((s) => s.item_id).join(', ') }}</span>
        </span>
      </label>
      <label v-if="detail.variation_items.length" class="flex items-start gap-2">
        <input v-model="form.apply_to_variations" type="checkbox" class="mt-0.5" :disabled="!isAdmin || groupMode" />
        <span class="text-[12px] text-ink-2">
          Aplicar às outras variações do produto ({{ detail.variation_items.length }} {{ detail.variation_items.length === 1 ? 'anúncio' : 'anúncios' }})
          <span class="block text-[11px] text-ink-3">{{ [...new Set(detail.variation_items.map((v) => v.sku))].slice(0, 6).join(', ') }}<template v-if="new Set(detail.variation_items.map((v) => v.sku)).size > 6">…</template></span>
        </span>
      </label>
      <p v-if="saveError" class="text-[12px] text-danger" role="alert">{{ saveError }}</p>
      <p v-else-if="savedNote" class="text-[12px] text-success" role="status" data-test="limites-salvos">{{ savedNote }}</p>
      <button v-if="isAdmin" type="submit" class="btn-primary w-full" :disabled="saving">{{ saving ? 'Salvando…' : 'Salvar limites' }}</button>
      <p v-else class="text-[11px] text-ink-3">Só administradores mudam os limites.</p>
      <a v-if="detail.permalink" :href="detail.permalink" target="_blank" rel="noopener" class="btn-link block text-[12px]">Abrir o anúncio no Mercado Livre</a>
    </form>
    </div>
  </div>
</template>
