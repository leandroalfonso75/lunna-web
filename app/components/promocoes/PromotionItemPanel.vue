<script setup lang="ts">
import { reactive, watch } from 'vue'
import { brl, dateTimeShort, pct } from '../../lib/format'
import type { PromotionItemDetail, PromotionSettingsInput } from '../../types/promotions'

/**
 * Painel de um anúncio na seção Promoções: todas as ofertas com preço, parte do ML, tarifa e margem
 * (a melhor marcada) e as margens mínima/máxima do anúncio, com a opção de aplicar ao SKU.
 */
const props = defineProps<{
  detail: PromotionItemDetail | null
  loading: boolean
  error: string
  isAdmin: boolean
  saving: boolean
  saveError: string
}>()
const emit = defineEmits<{ save: [input: PromotionSettingsInput] }>()

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
      <p class="mb-1 font-semibold text-ink">Ofertas deste anúncio</p>
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
            <th scope="col" class="py-1.5 font-semibold">Até</th>
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
            <td class="py-1.5 text-[11px]">{{ o.finish_date ? dateTimeShort(o.finish_date) : '' }}</td>
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
        <input v-model="form.max_margin_pct" type="number" step="0.1" class="input mt-1 h-9 w-full" placeholder="Sem teto" :disabled="!isAdmin" />
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
