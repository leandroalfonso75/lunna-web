<script setup lang="ts">
import { brl, int, pct } from '../../lib/format'
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
const ACTION_HINT: Record<string, string> = { editar_preco: 'ajustar o preço da atual', aderir: 'entrar nesta', manter: '' }

function offerLine(o: PromotionOfferShort | null) {
  if (!o) return null
  return { title: o.name || o.label, price: o.price, margin: o.margin_pct, profit: o.profit, valid: o.valid, action: o.action }
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
            {{ row.item_id }} · {{ row.sku ?? 'sem SKU' }}<template v-if="row.stock !== null"> · {{ int(row.stock) }} em estoque</template>
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
        <p v-if="key === 'best' && ACTION_HINT[offerLine(row[key])!.action] && row.gain" class="text-[11px] text-ink-3">{{ ACTION_HINT[offerLine(row[key])!.action] }}</p>
      </template>
      <template v-else-if="key === 'best' && row.review?.blocked_best">
        <p class="truncate text-ink-3 line-through" :title="row.review.blocked_best.name || row.review.blocked_best.label">{{ row.review.blocked_best.name || row.review.blocked_best.label }}</p>
        <p class="text-[11px] text-danger" data-numeric :title="row.review.blocked_best.shortfall">
          {{ brl(row.review.blocked_best.price) }} · {{ pct(row.review.blocked_best.margin_pct) }} · barrada
        </p>
      </template>
      <span v-else class="text-ink-3">—</span>
    </td>
    <td class="px-2 py-2 text-right align-top font-medium" data-numeric :class="row.gain && row.gain > 0 ? 'text-success' : 'text-ink-3'">
      {{ row.gain ? `+${brl(row.gain)}` : '—' }}
    </td>
    <td class="px-2 py-2 align-top">
      <span :class="tone(row.status.tone)">{{ row.status.label }}</span>
      <span v-if="row.review" class="block text-[11px] text-ink-3" :title="row.review.suggestion ?? row.review.reasons.map((r) => `${r.reason} (${r.offers})`).join(' · ')">
        {{ row.review.label }}
      </span>
    </td>
  </tr>
</template>
