<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { brl, dateTimeShort, pct } from '../../lib/format'
import type { PromotionItemDetail, PromotionOffer, PromotionSettingsInput, PromotionTarget } from '../../types/promotions'

/**
 * Painel de um anúncio na seção Promoções: todas as ofertas com preço, parte do ML, tarifa e margem
 * (a melhor marcada), as margens mínima/máxima do anúncio (com a opção de aplicar ao SKU) e, para
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
}>()
const emit = defineEmits<{ save: [input: PromotionSettingsInput]; apply: [target?: PromotionTarget]; leave: [] }>()

/** Ação esperando confirmação: o que vai acontecer, em texto, antes de mexer no Mercado Livre. */
const pending = ref<{ text: string; run: () => void } | null>(null)

const canApplyBest = computed(() => {
  const d = props.detail
  return !!d?.best && d.best.action !== 'manter' && (!d.current || (d.gain ?? 0) > 0)
})

function describe(o: { name: string | null; label: string; price: number | null; margin_pct: number | null }) {
  return `${o.name || o.label} a ${brl(o.price)} (margem ${pct(o.margin_pct)})`
}

function askBest() {
  const d = props.detail
  if (!d?.best) return
  const from = d.current ? `Sai de ${describe(d.current)} e entra em ` : 'Entra em '
  pending.value = { text: `${from}${describe(d.best)}. O preço muda no Mercado Livre na hora.`, run: () => emit('apply') }
}

function askOffer(o: PromotionOffer) {
  const target: PromotionTarget = { promotion_id: o.promotion_id, promotion_type: o.type, action: o.action === 'editar_preco' ? 'editar_preco' : 'aderir' }
  const what = o.action === 'editar_preco' ? `Ajusta o preço em ${describe(o)}` : `${props.detail?.current ? `Sai de ${describe(props.detail.current)} e entra em` : 'Entra em'} ${describe(o)}`
  pending.value = { text: `${what}. O preço muda no Mercado Livre na hora.`, run: () => emit('apply', target) }
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

const form = reactive<PromotionSettingsInput>({ min_margin_pct: '', max_margin_pct: '', apply_to_sku: false })

watch(() => props.detail, (d) => {
  if (!d) return
  form.min_margin_pct = d.settings.min_margin_pct === null ? '' : String(d.settings.min_margin_pct)
  form.max_margin_pct = d.settings.max_margin_pct === null ? '' : String(d.settings.max_margin_pct)
  form.apply_to_sku = d.settings.apply_to_sku
}, { immediate: true })

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

  <div v-else-if="detail" class="grid grid-cols-1 gap-4 text-[13px] xl:grid-cols-4" data-test="promo-detail">
    <div class="card overflow-x-auto p-4 xl:col-span-3">
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
        <div class="mt-2 flex gap-2">
          <button type="button" class="btn-primary h-8 px-3 text-[12px]" :disabled="acting" data-test="confirmar" @click="confirm">Confirmar</button>
          <button type="button" class="btn-link text-[12px]" @click="pending = null">Cancelar</button>
        </div>
      </div>
      <p v-if="acting" class="my-2 text-[12px] text-ink-2" role="status">Falando com o Mercado Livre…</p>
      <p v-else-if="actionResult" class="my-2 text-[12px]" :class="actionResult.ok ? 'text-success' : 'text-danger'" role="status">{{ actionResult.message }}</p>
      <p class="mb-3 text-[12px] text-ink-3">
        Preço cheio {{ brl(detail.full_price) }} · custo {{ detail.cost === null ? 'sem custo' : brl(detail.cost) }}
        <template v-if="detail.base"> · sem promoção a margem é {{ pct(detail.base.margin_pct) }} ({{ brl(detail.base.profit) }})</template>
      </p>
      <table class="w-full border-collapse text-[12px]">
        <thead>
          <tr class="border-b border-line text-left text-ink-2">
            <th scope="col" class="py-1.5 pr-2 font-semibold">Promoção</th>
            <th scope="col" class="py-1.5 pr-2 font-semibold">Situação</th>
            <th scope="col" class="py-1.5 pr-2 text-right font-semibold">Preço</th>
            <th scope="col" class="py-1.5 pr-2 text-right font-semibold">Parte do ML</th>
            <th scope="col" class="py-1.5 pr-2 text-right font-semibold">Tarifa</th>
            <th scope="col" class="py-1.5 pr-2 text-right font-semibold">Margem</th>
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
            <td class="py-1.5 pr-2 text-right font-medium" data-numeric :class="o.margin_pct !== null && o.margin_pct < detail.settings.effective_min_pct ? 'text-danger' : ''">
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
      <p class="font-semibold text-ink">Margem deste anúncio</p>
      <label class="block">
        <span class="text-[12px] text-ink-2">Margem mínima (%)</span>
        <input v-model="form.min_margin_pct" type="number" step="0.1" class="input mt-1 h-9 w-full" :placeholder="`Geral: ${detail.settings.effective_min_pct}`" :disabled="!isAdmin" />
      </label>
      <label class="block">
        <span class="text-[12px] text-ink-2">Margem máxima (%) · opcional</span>
        <input v-model="form.max_margin_pct" type="number" step="0.1" class="input mt-1 h-9 w-full" :placeholder="detail.settings.effective_max_pct === null ? 'Sem teto' : `Geral: ${detail.settings.effective_max_pct}`" :disabled="!isAdmin" />
        <span class="mt-1 block text-[11px] text-ink-3">Acima dela o Lunna aplica um desconto maior, para o preço não subir demais.</span>
      </label>
      <label v-if="detail.sku_items.length" class="flex items-start gap-2">
        <input v-model="form.apply_to_sku" type="checkbox" class="mt-0.5" :disabled="!isAdmin" />
        <span class="text-[12px] text-ink-2">
          Aplicar aos outros {{ detail.sku_items.length }} {{ detail.sku_items.length === 1 ? 'anúncio' : 'anúncios' }} do SKU {{ detail.sku }}
          <span class="block text-[11px] text-ink-3">{{ detail.sku_items.map((s) => s.item_id).join(', ') }}</span>
        </span>
      </label>
      <p v-if="saveError" class="text-[12px] text-danger" role="alert">{{ saveError }}</p>
      <button v-if="isAdmin" type="submit" class="btn-primary w-full" :disabled="saving">{{ saving ? 'Salvando…' : 'Salvar margens' }}</button>
      <p v-else class="text-[11px] text-ink-3">Só administradores mudam as margens.</p>
      <a v-if="detail.permalink" :href="detail.permalink" target="_blank" rel="noopener" class="btn-link block text-[12px]">Abrir o anúncio no Mercado Livre</a>
    </form>
  </div>
</template>
