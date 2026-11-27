<script setup lang="ts">
import { ArrowRightIcon, ChevronDownIcon, ChevronRightIcon, SparklesIcon } from '@heroicons/vue/20/solid'
import { computed } from 'vue'
import { brl, int, pct } from '../../../lib/format'
import { marginTone, rowAction, statusBadge } from '../../../lib/promotionStatus'
import { promotionValidity } from '../../../lib/promotionValidity'
import type { PromotionItemRow } from '../../../types/promotions'

/**
 * Linha de um anúncio em Promoções no layout novo (27/11/2026). Mostra o mesmo que a linha do layout atual
 * (`PromotionRow.vue`), reorganizado: anúncio | hoje | melhor opção | ganho | situação | ação principal visível.
 * A ação da linha abre o painel do anúncio já com a confirmação na tela: nada é aplicado sem confirmar.
 */
const props = defineProps<{
  row: PromotionItemRow
  isAdmin: boolean
  checked: boolean
  selected: boolean
  nested?: boolean
  reviewBusy?: boolean
  /** Este anúncio está falando com o Mercado Livre agora. */
  busy?: boolean
}>()
const emit = defineEmits<{ toggle: []; check: []; review: [dismissed: boolean]; act: [kind: 'best' | 'fitting'] }>()

const CATALOG_LABEL: Record<string, string> = { ganhando: 'Ganhando', compartilhando: 'Dividindo o 1º lugar', perdendo: 'Perdendo', sem_dados: 'Sem leitura' }
const CATALOG_BADGE: Record<string, string> = { ganhando: 'badge-success', compartilhando: 'badge-warning', perdendo: 'badge-danger', sem_dados: 'badge-neutral' }
const LISTING: Record<string, string> = { gold_special: 'Clássico', gold_pro: 'Premium', free: 'Grátis' }
const ACTION_HINT: Record<string, string> = { editar_preco: 'ajusta o preço da atual', aderir: 'entra nesta', manter: '' }

const badge = computed(() => statusBadge(props.row.status))
const action = computed(() => rowAction(props.row, props.isAdmin))
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
const signed = (v: number) => `${v > 0 ? '+' : ''}${brl(v)}`
const name = (o: { name: string | null; label: string }) => o.name || o.label
</script>

<template>
  <tr
    class="group scroll-mt-24 cursor-pointer transition-colors hover:bg-surface-2"
    :class="selected ? 'bg-primary-soft' : nested ? 'row-nested' : ''"
    data-test="promo-row"
    :data-item="row.item_id"
    @click="emit('toggle')"
  >
    <!-- anúncio -->
    <td :class="nested ? 'pl-10' : ''">
      <div class="flex items-start gap-3">
        <input
          v-if="isAdmin"
          type="checkbox"
          class="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]"
          :checked="checked"
          :disabled="!row.best"
          :aria-label="`Marcar ${row.item_id}`"
          @click.stop="emit('check')"
        />
        <img v-if="row.thumbnail && !nested" :src="row.thumbnail" alt="" class="h-14 w-14 shrink-0 rounded-[10px] border border-line object-cover" loading="lazy" />
        <div class="min-w-0">
          <p class="line-clamp-2 text-[15px] font-semibold leading-snug text-ink" :title="row.title">{{ row.title }}</p>
          <p class="mt-0.5 truncate text-[13px] text-ink-2">
            {{ row.item_id }} · {{ row.sku ?? 'sem SKU' }}<template v-if="row.stock !== null"> · {{ int(row.stock) }} em estoque</template><template v-if="row.listing_type && LISTING[row.listing_type]"> · {{ LISTING[row.listing_type] }}</template>
          </p>
          <p class="truncate text-[13px] text-ink-3">
            {{ int(row.sold_30d) }} {{ row.sold_30d === 1 ? 'venda' : 'vendas' }} em 30 dias<template v-if="row.sold_total !== null"> ({{ int(row.sold_total) }} no total)</template>
            ·
            <template v-if="row.settings.limit_mode === 'price'">
              valor<template v-if="row.settings.min_price !== null"> mín. {{ brl(row.settings.min_price) }}</template><template v-if="row.settings.max_price !== null"> · máx. {{ brl(row.settings.max_price) }}</template>
            </template>
            <template v-else>
              margem mín. {{ pct(row.settings.effective_min_pct) }}<template v-if="row.settings.effective_max_pct !== null"> · máx. {{ pct(row.settings.effective_max_pct) }}</template><template v-if="row.settings.min_margin_pct === null && row.settings.max_margin_pct === null"> (geral)</template>
            </template>
            <template v-if="row.ads.unit > 0"> · Ads {{ brl(row.ads.unit) }}/un.</template>
          </p>
          <div v-if="row.catalog || row.synced_with_catalog || row.notes || row.manual" class="mt-1.5 flex flex-wrap gap-1.5">
            <span v-if="row.catalog || row.synced_with_catalog" class="badge-success" data-test="catalogo">
              <template v-if="row.catalog">Catálogo · {{ row.catalog === 'sincronizado' ? 'com sincronização' : 'sem sincronização' }}</template>
              <template v-else>Sincronizado com catálogo</template>
            </span>
            <span v-if="row.catalog_info" :class="CATALOG_BADGE[row.catalog_info.state]" data-test="catalogo-estado">{{ CATALOG_LABEL[row.catalog_info.state] }}</span>
            <span v-if="row.notes" class="badge-info" :title="row.notes">Regra própria</span>
            <span v-if="row.manual" class="badge-warning" title="Não automatizar promoções: a rotina e o lote não mexem">Não automatizado</span>
          </div>
          <p v-if="row.catalog_info?.state === 'perdendo' && row.catalog_info.price_to_win !== null" class="mt-1 text-[13px] text-ink-2" data-test="catalogo-meta">
            Para ganhar: <strong class="text-danger" data-numeric>{{ brl(row.catalog_info.price_to_win) }}</strong>
            <template v-if="row.catalog_info.reduce_pct"> (−{{ pct(row.catalog_info.reduce_pct) }} sobre {{ brl(row.catalog_info.price_today) }})</template>
            <template v-if="row.catalog_info.suggestion">
              · sugestão: {{ name(row.catalog_info.suggestion) }} a {{ brl(row.catalog_info.suggestion.price) }}, margem
              <span :class="row.catalog_info.suggestion.valid ? 'text-success' : 'text-danger'">{{ pct(row.catalog_info.suggestion.margin_pct) }}</span>
              <template v-if="!row.catalog_info.suggestion.valid"> ({{ row.catalog_info.suggestion.reason }})</template>
            </template>
            <template v-else> · {{ row.catalog_info.message }}</template>
          </p>
        </div>
      </div>
    </td>

    <!-- hoje -->
    <td data-test="coluna-hoje">
      <template v-if="row.current">
        <p class="truncate text-[13px] font-medium text-ink-2" :title="name(row.current)">{{ name(row.current) }}</p>
        <p class="text-[17px] font-bold leading-tight text-ink" data-numeric>{{ brl(row.current.price) }}</p>
        <p class="text-[13px] font-semibold" :class="marginTone(row.current.valid, row.current.margin_pct)" data-numeric>
          {{ pct(row.current.margin_pct) }} <span class="font-normal text-ink-3">· {{ brl(row.current.profit) }}</span>
        </p>
        <p v-if="promotionValidity(row.current, true)" class="text-[12px] text-ink-3">{{ promotionValidity(row.current, true) }}</p>
      </template>
      <template v-else>
        <p class="text-[13px] font-medium text-ink-2">Sem promoção</p>
        <p class="text-[17px] font-bold leading-tight text-ink" data-numeric>{{ brl(row.full_price) }}</p>
        <p v-if="row.base" class="text-[13px] font-semibold" :class="marginTone(true, row.base.margin_pct)" data-numeric>
          {{ pct(row.base.margin_pct) }} <span class="font-normal text-ink-3">· {{ brl(row.base.profit) }}</span>
        </p>
      </template>
      <p class="mt-0.5 text-[12px] leading-snug text-ink-3" data-test="lucro-antes-ads">
        cheio {{ brl(row.full_price) }}
        <template v-if="row.current?.profit_before_ads !== null && row.current?.profit_before_ads !== undefined"> · antes do Ads {{ brl(row.current.profit_before_ads) }} ({{ pct(row.current.margin_before_ads_pct) }})</template>
        <template v-else-if="row.base"> · antes do Ads {{ brl(row.base.profit_before_ads) }} ({{ pct(row.base.margin_before_ads_pct) }})</template>
      </p>
    </td>

    <!-- melhor opção -->
    <td data-test="coluna-melhor">
      <template v-if="row.best">
        <p class="truncate text-[13px] font-medium text-ink-2" :title="name(row.best)">{{ name(row.best) }}</p>
        <p class="text-[17px] font-bold leading-tight text-ink" data-numeric>{{ brl(row.best.price) }}</p>
        <p class="text-[13px] font-semibold" :class="marginTone(row.best.valid, row.best.margin_pct)" data-numeric>
          {{ pct(row.best.margin_pct) }} <span class="font-normal text-ink-3">· {{ brl(row.best.profit) }}</span>
        </p>
        <p class="text-[12px] text-ink-3">
          <template v-if="promotionValidity(row.best, true)">{{ promotionValidity(row.best, true) }}</template>
          <template v-if="ACTION_HINT[row.best.action] && row.gain"> · {{ ACTION_HINT[row.best.action] }}</template>
          <template v-if="row.best.action !== 'manter' && row.best.profit_before_ads !== null"> · antes do Ads {{ brl(row.best.profit_before_ads) }}</template>
        </p>
      </template>
      <template v-else-if="row.review?.blocked_best">
        <p class="truncate text-[13px] text-ink-3 line-through" :title="name(row.review.blocked_best)">{{ name(row.review.blocked_best) }}</p>
        <p class="text-[14px] font-semibold text-danger" data-numeric :title="row.review.blocked_best.shortfall">
          {{ brl(row.review.blocked_best.price) }} · {{ pct(row.review.blocked_best.margin_pct) }} · barrada
        </p>
        <p class="text-[12px] text-ink-3">{{ promotionValidity(row.review.blocked_best, true) }}</p>
        <p v-if="row.review.fitting" class="mt-1 text-[13px] font-semibold text-success" data-numeric :title="row.review.fitting.soft_reason ?? ''">
          Cabível: {{ brl(row.review.fitting.price) }} · {{ pct(row.review.fitting.margin_pct) }}
          <span class="block truncate text-[12px] font-normal text-ink-3">{{ name(row.review.fitting) }}<template v-if="row.review.fitting.soft_reason"> (sobe o preço)</template></span>
        </p>
      </template>
      <template v-else-if="row.review?.fitting">
        <p class="text-[13px] text-ink-3">Nenhuma dentro das regras</p>
        <p class="text-[14px] font-semibold text-success" data-numeric :title="row.review.fitting.soft_reason ?? ''">
          Cabível: {{ brl(row.review.fitting.price) }} · {{ pct(row.review.fitting.margin_pct) }}
        </p>
        <p class="truncate text-[12px] text-ink-3">{{ name(row.review.fitting) }}<template v-if="row.review.fitting.soft_reason"> (sobe o preço)</template></p>
      </template>
      <span v-else class="text-ink-3">—</span>
    </td>

    <!-- ganho -->
    <td class="text-right">
      <!-- baixar até o alvo (27/11/2026): não é ganho; o lucro por unidade cai para vender mais barato -->
      <template v-if="row.status.key === 'baixar_alvo' && row.gain">
        <span class="inline-block rounded-[8px] bg-surface-2 px-2 py-1 text-[15px] font-bold text-ink-2" data-numeric data-test="reducao-alvo">{{ signed(row.gain) }}</span>
        <span class="mt-0.5 block text-[12px] text-ink-3">para vender mais barato</span>
      </template>
      <span v-else-if="row.gain" class="inline-block rounded-[8px] px-2 py-1 text-[15px] font-bold" :class="row.gain > 0 ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'" data-numeric>
        {{ signed(row.gain) }}
      </span>
      <span v-else class="text-ink-3">—</span>
    </td>

    <!-- situação -->
    <td>
      <span :class="badge.cls" class="!whitespace-normal"><component :is="badge.icon" class="h-3.5 w-3.5" aria-hidden="true" />{{ row.status.label }}</span>
      <p v-if="row.review_round" class="mt-1 text-[12px] font-medium text-ink-2" data-test="rodada-revisar" :title="row.review_round.note ?? undefined">
        {{ row.review_round.label }}<template v-if="row.review_round.note"> · {{ row.review_round.note }}</template>
      </p>
      <p v-if="row.status.key === 'programado' && row.scheduled" class="mt-1 text-[12px] font-medium text-ink-2" data-test="programado">
        {{ row.scheduled.name || row.scheduled.label }}<template v-if="row.scheduled.price"> a {{ brl(row.scheduled.price) }}</template> a partir de {{ shortDate(row.scheduled.effective_at) }}
      </p>
      <p v-else-if="row.status.key === 'minima_inalcancavel' && row.unreachable" class="mt-1 text-[12px] text-ink-2" data-test="inalcancavel"
         title="Nem o preço cheio atinge a margem mínima: a automação deixa na oferta mais perto dela. Reveja o preço ou o custo.">
        mínima {{ pct(row.unreachable.min_pct) }} · preço cheio {{ row.unreachable.full_price_margin !== null ? pct(row.unreachable.full_price_margin) : '—' }}
        <template v-if="row.unreachable.loss"> · prejuízo em qualquer oferta: fica como está</template>
        <template v-else-if="row.unreachable.closest"> · mais perto: {{ name(row.unreachable.closest) }} {{ pct(row.unreachable.closest.margin_pct ?? 0) }}</template>
      </p>
      <p v-else-if="row.review" class="mt-1 text-[12px] text-ink-3" :title="row.review.suggestion ?? row.review.reasons.map((r) => `${r.reason} (${r.offers})`).join(' · ')">
        {{ row.review.label }}
      </p>
    </td>

    <!-- ação -->
    <td class="text-right">
      <div class="flex flex-col items-end gap-1.5">
        <button v-if="action === 'best'" type="button" class="nbtn-primary nbtn-sm" :disabled="busy" data-test="linha-aplicar-melhor" @click.stop="emit('act', 'best')">
          <span v-if="busy" class="nbtn-spin" aria-hidden="true" /><SparklesIcon v-else class="h-4 w-4" aria-hidden="true" />
          {{ busy ? 'Aplicando…' : 'Aplicar melhor' }}
        </button>
        <button v-else-if="action === 'lower'" type="button" class="nbtn-secondary nbtn-sm" :disabled="busy" data-test="linha-baixar-alvo"
          title="Abre a confirmação: o lucro por unidade cai, dentro da tolerância de redução" @click.stop="emit('act', 'best')">
          <span v-if="busy" class="nbtn-spin" aria-hidden="true" />
          {{ busy ? 'Aplicando…' : 'Baixar preço' }}
        </button>
        <button v-else-if="action === 'fitting'" type="button" class="nbtn-success nbtn-sm" :disabled="busy" data-test="linha-aplicar-cabivel" @click.stop="emit('act', 'fitting')">
          <span v-if="busy" class="nbtn-spin" aria-hidden="true" />
          {{ busy ? 'Aplicando…' : 'Aplicar cabível' }}
        </button>
        <button v-else-if="action === 'review'" type="button" class="nbtn-warning nbtn-sm" data-test="linha-revisar" @click.stop="emit('toggle')">
          Revisar <ArrowRightIcon class="h-4 w-4" aria-hidden="true" />
        </button>
        <button v-else type="button" class="nbtn-ghost nbtn-sm" :aria-expanded="selected" data-test="linha-detalhes" @click.stop="emit('toggle')">
          {{ selected ? 'Fechar' : 'Detalhes' }}
          <ChevronDownIcon v-if="selected" class="h-4 w-4" aria-hidden="true" /><ChevronRightIcon v-else class="h-4 w-4" aria-hidden="true" />
        </button>
        <button v-if="isAdmin && row.status.key === 'para_revisar' && !row.manual" type="button" class="text-[12px] font-semibold text-ink-2 underline-offset-2 hover:text-primary hover:underline" :disabled="reviewBusy"
          :data-test="row.review_dismissed ? 'voltar-revisar' : 'ciente'"
          :title="row.review_dismissed ? 'Volta o anúncio para a guia Para revisar' : 'Tira o anúncio de Para revisar sem mudar nada nele (ele volta se sair da revisão e entrar de novo)'"
          @click.stop="emit('review', !row.review_dismissed)">
          {{ row.review_dismissed ? 'Voltar para revisar' : 'Ciente, nada a fazer' }}
        </button>
      </div>
    </td>
  </tr>
</template>

<style scoped>
.row-nested {
  background: color-mix(in srgb, var(--surface-2) 45%, var(--surface));
}
</style>
