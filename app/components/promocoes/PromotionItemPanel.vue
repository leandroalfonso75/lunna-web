<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { brl, dateTimeShort, pct } from '../../lib/format'
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
}>()
const emit = defineEmits<{ save: [input: PromotionSettingsInput]; apply: [target: PromotionTarget | undefined, spread: PromotionSpread]; leave: [] }>()

/** Ação esperando confirmação: o que vai acontecer, em texto, antes de mexer no Mercado Livre. `spreadable` = ao entrar
 * numa promoção, dá para levar a mesma aos outros anúncios do SKU e das variações. */
const pending = ref<{ text: string; run: () => void; spreadable?: boolean } | null>(null)
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
  pending.value = { text: `${from}${describe(d.best)}. O preço muda no Mercado Livre na hora.`, run: () => emit('apply', undefined, { ...spread }), spreadable: true }
}

function askOffer(o: PromotionOffer) {
  const target: PromotionTarget = { promotion_id: o.promotion_id, promotion_type: o.type, action: o.action === 'editar_preco' ? 'editar_preco' : 'aderir' }
  const what = o.action === 'editar_preco' ? `Ajusta o preço em ${describe(o)}` : `${props.detail?.current ? `Sai de ${describe(props.detail.current)} e entra em` : 'Entra em'} ${describe(o)}`
  spread.alsoSku = false
  spread.alsoVariations = false
  pending.value = { text: `${what}. O preço muda no Mercado Livre na hora.`, run: () => emit('apply', target, { ...spread }), spreadable: true }
}

function askLeave() {
  const c = props.detail?.current
  if (!c) return
  pending.value = { text: `Tira o anúncio de ${describe(c)}; ele volta ao preço cheio de ${brl(props.detail?.full_price)}.`, run: () => emit('leave') }
}

function confirm() {
  pending.value?.run()
  pending.value = null
}

const JOINABLE = ['SELLER_CAMPAIGN', 'DEAL', 'PRICE_DISCOUNT', 'SMART', 'PRICE_MATCHING', 'MARKETPLACE_CAMPAIGN', 'UNHEALTHY_STOCK', 'SMART_LIGHTNING', 'PRE_NEGOTIATED']

const form = reactive<PromotionSettingsInput>({
  limit_mode: 'margin', min_margin_pct: '', max_margin_pct: '', min_price: '', max_price: '', apply_to_sku: false, apply_to_variations: false, rules_note: ''
})

const str = (v: number | null) => (v === null ? '' : String(v))

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
  if (d.current?.costs) return { title: 'Hoje', sub: d.current.name || d.current.label, price: d.current.price, profit: d.current.profit, margin: d.current.margin_pct, costs: d.current.costs }
  if (d.base) return { title: 'Hoje', sub: 'sem promoção', price: d.base.price, profit: d.base.profit, margin: d.base.margin_pct, costs: d.base.costs }
  return null
})

const after = computed(() => {
  const b = props.detail?.best
  if (!b?.costs || b.action === 'manter') return null
  return { title: 'Depois da melhor oferta', sub: b.name || b.label, price: b.price, profit: b.profit, margin: b.margin_pct, costs: b.costs }
})

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
          <button type="button" class="btn-primary h-8 px-3 text-[12px]" :disabled="acting" data-test="confirmar" @click="confirm">Confirmar</button>
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
              <th scope="col" class="px-3 py-1.5 text-right font-semibold">{{ today.title }}<span class="block text-[11px] font-normal text-ink-3">{{ today.sub }}</span></th>
              <th v-if="after" scope="col" class="px-3 py-1.5 text-right font-semibold">{{ after.title }}<span class="block text-[11px] font-normal text-ink-3">{{ after.sub }}</span></th>
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
      <table class="w-full border-collapse text-[12px]">
        <thead>
          <tr class="border-b border-line text-left text-ink-2">
            <th scope="col" class="py-1.5 pr-2 font-semibold">Promoção</th>
            <th scope="col" class="py-1.5 pr-2 font-semibold">Situação</th>
            <th scope="col" class="py-1.5 pr-2 text-right font-semibold">Preço</th>
            <th scope="col" class="py-1.5 pr-2 text-right font-semibold">Parte do ML</th>
            <th scope="col" class="py-1.5 pr-2 text-right font-semibold">Tarifa</th>
            <th scope="col" class="py-1.5 pr-2 text-right font-semibold">Margem real<span class="block text-[10px] font-normal text-ink-3">pós Ads, e lucro</span></th>
            <th scope="col" class="py-1.5 pr-2 font-semibold">Até</th>
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
              <span class="block text-[11px] text-ink-3">{{ o.label }}<template v-if="o.flexible"> · faixa {{ range(o) }}</template></span>
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
            <td class="py-1.5 pr-2 text-[11px]">{{ o.finish_date ? dateTimeShort(o.finish_date) : '' }}</td>
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

    <form class="card space-y-3 p-4" @submit.prevent="emit('save', { ...form })">
      <p class="font-semibold text-ink">{{ groupMode ? 'Limites do produto (todas as variações)' : 'Limites deste anúncio' }}</p>
      <p v-if="detail.review && !groupMode" class="rounded-card border border-danger bg-danger-soft px-2 py-1.5 text-[12px] text-danger" data-test="review-reason">
        Para revisar: {{ detail.review.label }}<template v-if="detail.review.reasons.length"> · ofertas barradas por: {{ detail.review.reasons.map((r) => `${r.reason} (${r.offers})`).join('; ') }}</template>
      </p>
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
        <span class="mt-1 block text-[11px] text-ink-3">Fica guardado com o anúncio e aparece na lista; a rotina das 03:00 vai respeitar o que estiver aqui.</span>
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
      <button v-if="isAdmin" type="submit" class="btn-primary w-full" :disabled="saving">{{ saving ? 'Salvando…' : 'Salvar limites' }}</button>
      <p v-else class="text-[11px] text-ink-3">Só administradores mudam os limites.</p>
      <a v-if="detail.permalink" :href="detail.permalink" target="_blank" rel="noopener" class="btn-link block text-[12px]">Abrir o anúncio no Mercado Livre</a>
    </form>
  </div>
</template>
