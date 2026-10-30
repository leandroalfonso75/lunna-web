<script setup lang="ts">
import { brl, int, pct } from '../../lib/format'
import { promotionValidity } from '../../lib/promotionValidity'
import type { PromotionItemRow, PromotionOfferShort } from '../../types/promotions'

/**
 * Uma linha de anúncio na lista de Promoções (solta ou dentro de um produto com variações): anúncio, preço cheio,
 * promoção atual, melhor oferta, ganho por unidade e situação (com a regra que barrou, em "Para revisar").
 */
defineProps<{
  row: PromotionItemRow
  isAdmin: boolean
  checked: boolean
  selected: boolean
  /** Dentro de um produto com variações: recuo e sem foto. */
  nested?: boolean
}>()
const emit = defineEmits<{ toggle: []; check: [] }>()

const TONE: Record<string, string> = { ok: 'text-success', warn: 'text-warning', bad: 'text-danger', neutral: 'text-ink-3' }
const tone = (t: string) => TONE[t] ?? 'text-ink-2'
const CATALOG_LABEL: Record<string, string> = { ganhando: 'Ganhando', compartilhando: 'Dividindo o 1º lugar', perdendo: 'Perdendo', sem_dados: 'Sem leitura' }
const CATALOG_TONE: Record<string, string> = {
  ganhando: 'bg-success-soft text-success', compartilhando: 'bg-warning-soft text-warning', perdendo: 'bg-danger-soft text-danger', sem_dados: 'bg-surface-2 text-ink-3'
}
const LISTING: Record<string, string> = { gold_special: 'Clássico', gold_pro: 'Premium', free: 'Grátis' }
const ACTION_HINT: Record<string, string> = { editar_preco: 'ajustar o preço da atual', aderir: 'entrar nesta', manter: '' }

function offerLine(o: PromotionOfferShort | null) {
  if (!o) return null
  return { title: o.name || o.label, price: o.price, margin: o.margin_pct, profit: o.profit, valid: o.valid, action: o.action, validity: promotionValidity(o, true) }
}
</script>

<template>
  <tr class="scroll-mt-12 cursor-pointer border-b border-line hover:bg-surface-2" :class="[nested ? 'bg-surface-2/40' : '', selected ? 'bg-surface-2' : '']" data-test="promo-row" :data-item="row.item_id" @click="emit('toggle')">
    <td class="px-2 py-2 align-top" :class="nested ? 'pl-9' : ''">
      <div class="flex items-start gap-2">
        <input
          v-if="isAdmin"
          type="checkbox"
          class="mt-3 shrink-0"
          :checked="checked"
          :disabled="!row.best"
          :aria-label="`Marcar ${row.item_id}`"
          @click.stop="emit('check')"
        />
        <img v-if="row.thumbnail && !nested" :src="row.thumbnail" alt="" class="h-9 w-9 shrink-0 rounded object-cover" loading="lazy" />
        <div class="min-w-0">
          <p class="truncate font-medium text-ink" :title="row.title">{{ row.title }}</p>
          <p class="truncate text-[11px] text-ink-3">
            {{ row.item_id }} · {{ row.sku ?? 'sem SKU' }}<template v-if="row.stock !== null"> · {{ int(row.stock) }} em estoque</template><template v-if="row.listing_type && LISTING[row.listing_type]"> · {{ LISTING[row.listing_type] }}</template>
            · {{ int(row.sold_30d) }} {{ row.sold_30d === 1 ? 'venda' : 'vendas' }} em 30 dias<template v-if="row.sold_total !== null"> ({{ int(row.sold_total) }} no total)</template>
          </p>
          <p v-if="row.catalog || row.synced_with_catalog" class="text-[11px] font-semibold text-success" data-test="catalogo">
            <template v-if="row.catalog">Catálogo · {{ row.catalog === 'sincronizado' ? 'com sincronização' : 'sem sincronização' }}</template>
            <template v-else>Sincronizado com catálogo</template>
            <span v-if="row.catalog_info" class="ml-1 rounded-full px-1.5" :class="CATALOG_TONE[row.catalog_info.state]" data-test="catalogo-estado">
              {{ CATALOG_LABEL[row.catalog_info.state] }}
            </span>
          </p>
          <p v-if="row.catalog_info?.state === 'perdendo' && row.catalog_info.price_to_win !== null" class="text-[11px] text-ink-2" data-test="catalogo-meta">
            Para ganhar: <strong class="text-danger" data-numeric>{{ brl(row.catalog_info.price_to_win) }}</strong>
            <template v-if="row.catalog_info.reduce_pct"> (−{{ pct(row.catalog_info.reduce_pct) }} sobre {{ brl(row.catalog_info.price_today) }})</template>
            <template v-if="row.catalog_info.suggestion">
              · sugestão: {{ row.catalog_info.suggestion.name || row.catalog_info.suggestion.label }} a {{ brl(row.catalog_info.suggestion.price) }},
              margem <span :class="row.catalog_info.suggestion.valid ? 'text-success' : 'text-danger'">{{ pct(row.catalog_info.suggestion.margin_pct) }}</span>
              <template v-if="!row.catalog_info.suggestion.valid"> ({{ row.catalog_info.suggestion.reason }})</template>
            </template>
            <template v-else> · {{ row.catalog_info.message }}</template>
          </p>
          <p class="text-[11px] text-ink-3">
            <template v-if="row.settings.limit_mode === 'price'">
              valor<template v-if="row.settings.min_price !== null"> mín. {{ brl(row.settings.min_price) }}</template><template v-if="row.settings.max_price !== null"> · máx. {{ brl(row.settings.max_price) }}</template>
            </template>
            <template v-else>
              mín. {{ pct(row.settings.effective_min_pct) }}<template v-if="row.settings.effective_max_pct !== null"> · máx. {{ pct(row.settings.effective_max_pct) }}</template>
              <template v-if="row.settings.min_margin_pct === null && row.settings.max_margin_pct === null"> (geral)</template>
            </template>
            <template v-if="row.ads.unit > 0"> · Ads {{ brl(row.ads.unit) }}/un.</template>
            <template v-if="row.notes"> · <span class="text-primary" :title="row.notes">com regra própria</span></template>
            <template v-if="row.manual"> · <span class="font-semibold text-warning" title="Não automatizar promoções: a rotina e o lote não mexem">não automatizado</span></template>
          </p>
        </div>
      </div>
    </td>
    <td class="px-2 py-2 text-right align-top" data-numeric>{{ brl(row.full_price) }}</td>
    <td v-for="key in (['current', 'best'] as const)" :key="key" class="px-2 py-2 align-top">
      <template v-if="offerLine(row[key])">
        <p class="truncate font-medium text-ink" :title="offerLine(row[key])!.title">{{ offerLine(row[key])!.title }}</p>
        <p class="text-[11px]" data-numeric>
          <span class="text-ink-2">{{ brl(offerLine(row[key])!.price) }}</span>
          · <span :class="offerLine(row[key])!.valid ? 'text-ink' : 'text-danger'">{{ pct(offerLine(row[key])!.margin) }}</span>
          <span class="text-ink-3"> ({{ brl(offerLine(row[key])!.profit) }})</span>
        </p>
        <p v-if="offerLine(row[key])!.validity" class="text-[11px] text-ink-3">{{ offerLine(row[key])!.validity }}</p>
        <p v-if="key === 'best' && ACTION_HINT[offerLine(row[key])!.action] && row.gain" class="text-[11px] text-ink-3">{{ ACTION_HINT[offerLine(row[key])!.action] }}</p>
      </template>
      <template v-else-if="key === 'best' && row.review?.blocked_best">
        <p class="truncate text-ink-3 line-through" :title="row.review.blocked_best.name || row.review.blocked_best.label">{{ row.review.blocked_best.name || row.review.blocked_best.label }}</p>
        <p class="text-[11px] text-danger" data-numeric :title="row.review.blocked_best.shortfall">
          {{ brl(row.review.blocked_best.price) }} · {{ pct(row.review.blocked_best.margin_pct) }} · barrada
        </p>
        <p class="text-[11px] text-ink-3">{{ promotionValidity(row.review.blocked_best, true) }}</p>
        <p v-if="row.review.fitting" class="text-[11px] text-success" data-numeric :title="row.review.fitting.soft_reason ?? ''">
          cabe: {{ row.review.fitting.name || row.review.fitting.label }} a {{ brl(row.review.fitting.price) }} · {{ pct(row.review.fitting.margin_pct) }}<template v-if="row.review.fitting.soft_reason"> (sobe o preço)</template>
        </p>
      </template>
      <template v-else-if="key === 'best' && row.review?.fitting">
        <p class="truncate text-ink-3" :title="row.review.fitting.name || row.review.fitting.label">nenhuma dentro das regras</p>
        <p class="text-[11px] text-success" data-numeric :title="row.review.fitting.soft_reason ?? ''">
          cabe: {{ row.review.fitting.name || row.review.fitting.label }} a {{ brl(row.review.fitting.price) }} · {{ pct(row.review.fitting.margin_pct) }}<template v-if="row.review.fitting.soft_reason"> (sobe o preço)</template>
        </p>
      </template>
      <span v-else class="text-ink-3">—</span>
    </td>
    <td class="px-2 py-2 text-right align-top text-[12px]" data-numeric data-test="lucro-antes-ads">
      <template v-if="row.current?.profit_before_ads !== null && row.current?.profit_before_ads !== undefined">
        <span class="text-ink">{{ brl(row.current.profit_before_ads) }}</span>
        <span class="block text-[11px] text-ink-3">{{ pct(row.current.margin_before_ads_pct) }} hoje</span>
      </template>
      <template v-else-if="row.base">
        <span class="text-ink">{{ brl(row.base.profit_before_ads) }}</span>
        <span class="block text-[11px] text-ink-3">{{ pct(row.base.margin_before_ads_pct) }} sem promoção</span>
      </template>
      <span v-else class="text-ink-3">—</span>
      <span v-if="row.best && row.best.action !== 'manter' && row.best.profit_before_ads !== null" class="block text-[11px] text-ink-3">
        → {{ brl(row.best.profit_before_ads) }} na melhor
      </span>
    </td>
    <td class="px-2 py-2 text-right align-top font-medium" data-numeric :class="row.gain && row.gain > 0 ? 'text-success' : row.gain && row.gain < 0 ? 'text-danger' : 'text-ink-3'">
      {{ row.gain ? `${row.gain > 0 ? '+' : ''}${brl(row.gain)}` : '—' }}
    </td>
    <td class="px-2 py-2 align-top">
      <span :class="tone(row.status.tone)">{{ row.status.label }}</span>
      <span v-if="row.review" class="block text-[11px] text-ink-3" :title="row.review.suggestion ?? row.review.reasons.map((r) => `${r.reason} (${r.offers})`).join(' · ')">
        {{ row.review.label }}
      </span>
    </td>
  </tr>
</template>
