<script setup lang="ts">
import AiPlanPanel from './AiPlanPanel.vue'
import { brl, int, pct } from '../../lib/format'
import { SUGGESTION_PRIORITY_CLASS, SUGGESTION_PRIORITY_LABEL } from '../../lib/suggestionPriority'
import type { AbcItemDetail, AbcRow, ThreeState } from '../../types/painel'

defineProps<{
  row: AbcRow
  detail: AbcItemDetail | undefined
  loading: boolean
  loadError: boolean
}>()

defineEmits<{ retry: [] }>()

/** Classe de cor para as linhas de lucro/margem — só reflete `margin_state` e
 * `profit_state` (já decididos pela API); o front não decide se a margem está ruim. */
function marginClass(state: ThreeState | null, profitState: ThreeState | null = null): string {
  if (state === 'bad' || profitState === 'bad') return 'text-danger'
  if (state === 'warn') return 'text-warning'
  return 'text-ink'
}
</script>

<template>
  <div v-if="loading" class="space-y-2">
    <div class="h-4 w-1/2 animate-pulse rounded bg-surface-2" />
    <div class="h-24 animate-pulse rounded bg-surface-2" />
  </div>

  <div v-else-if="loadError" class="text-center">
    <p class="text-[14px] text-danger">Não foi possível carregar o detalhe deste anúncio.</p>
    <button type="button" class="btn-link mt-2" @click="$emit('retry')">Tentar de novo</button>
  </div>

  <div v-else-if="detail" class="space-y-5 text-[13px]">
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="card p-4">
        <p class="mb-2 font-semibold text-ink">Indicadores 30d</p>

        <div class="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-1">
          <span />
          <span class="text-right text-[11px] font-medium uppercase tracking-wide text-ink-3">Atual</span>
          <span class="text-right text-[11px] font-medium uppercase tracking-wide text-ink-3">Anterior</span>

          <span class="text-ink-2">Visitas</span>
          <span class="text-right text-ink" data-numeric>{{ int(detail.indicators.visits) }}</span>
          <span class="text-right text-ink-3" data-numeric>{{ int(detail.indicators.prev_visits) }}</span>

          <span class="text-ink-2">Vendas</span>
          <span class="text-right text-ink" data-numeric>{{ int(detail.indicators.units) }}</span>
          <span class="text-right text-ink-3" data-numeric>{{ int(detail.indicators.prev_units) }}</span>
        </div>

        <dl class="mt-2 border-t border-line pt-1">
          <div class="def-row"><dt>Conversão</dt><dd data-numeric>{{ pct(detail.indicators.conversion) }}</dd></div>
          <div class="def-row"><dt>Participação</dt><dd data-numeric>{{ pct(detail.indicators.share_pct) }}</dd></div>
          <div class="def-row"><dt>Acumulado</dt><dd data-numeric>{{ pct(detail.indicators.cum_pct) }}</dd></div>
        </dl>
      </div>

      <div class="card p-4">
        <p class="mb-2 font-semibold text-ink">Resultado do mês</p>
        <dl>
          <div class="def-row"><dt>Faturamento</dt><dd data-numeric>{{ brl(detail.month.revenue) }}</dd></div>
          <div class="def-row"><dt>Tarifas</dt><dd data-numeric>{{ brl(detail.month.fees) }}</dd></div>
          <div class="def-row"><dt>Frete</dt><dd data-numeric>{{ brl(detail.month.shipping) }}</dd></div>
          <div class="def-row"><dt>Imposto</dt><dd data-numeric>{{ brl(detail.month.tax) }}</dd></div>
          <div class="def-row"><dt>Custo</dt><dd data-numeric>{{ detail.month.cost !== null ? brl(detail.month.cost) : '—' }}</dd></div>
          <div class="def-row mt-1 border-t border-line pt-2 text-[14px] font-semibold" :class="marginClass(detail.month.margin_state, detail.month.profit_state)">
            <dt>{{ detail.month.profit_is_before_cost ? 'Lucro antes do custo' : 'Lucro líquido do mês' }}</dt>
            <dd data-numeric>{{ brl(detail.month.profit) }} <span class="font-normal">({{ detail.month.margin_pct !== null ? pct(detail.month.margin_pct) : '—' }})</span></dd>
          </div>
        </dl>
      </div>

      <div class="card p-4">
        <p class="mb-2 font-semibold text-ink">Por unidade</p>
        <dl>
          <div class="def-row">
            <dt>Preço</dt>
            <dd data-numeric>
              <span v-if="detail.unit.full_price" class="mr-1 font-normal text-ink-3 line-through">{{ brl(detail.unit.full_price) }}</span>
              {{ brl(detail.unit.price) }}
            </dd>
          </div>
          <div class="def-row"><dt>Tarifa</dt><dd data-numeric>{{ brl(detail.unit.fee) }}</dd></div>
          <div class="def-row"><dt>Frete</dt><dd data-numeric>{{ brl(detail.unit.shipping) }}</dd></div>
          <div class="def-row"><dt>Imposto</dt><dd data-numeric>{{ brl(detail.unit.tax) }}</dd></div>
          <div class="def-row"><dt>Custo</dt><dd data-numeric>{{ detail.unit.cost !== null ? brl(detail.unit.cost) : '—' }}</dd></div>
          <div class="def-row mt-1 border-t border-line pt-2 text-[14px] font-semibold" :class="marginClass(detail.unit.margin_state, detail.unit.profit_state)">
            <dt>{{ detail.month.profit_is_before_cost ? 'Lucro antes do custo' : 'Lucro' }}</dt>
            <dd data-numeric>{{ brl(detail.unit.profit) }} <span class="font-normal">({{ detail.unit.margin_pct !== null ? pct(detail.unit.margin_pct) : '—' }})</span></dd>
          </div>
        </dl>
      </div>

      <div class="card p-4">
        <p class="mb-2 font-semibold text-ink">Cadastro</p>
        <dl>
          <div class="def-row"><dt>Estoque</dt><dd data-numeric>{{ int(detail.listing.stock) }}</dd></div>
          <div class="def-row"><dt>Tipo</dt><dd>{{ detail.listing.listing_type_label ?? '—' }}</dd></div>
          <div class="def-row"><dt>Fotos</dt><dd data-numeric>{{ detail.listing.pictures }}</dd></div>
          <div class="def-row"><dt>Vídeo</dt><dd>{{ detail.listing.has_video ? 'Sim' : 'Não' }}</dd></div>
          <div class="def-row"><dt>Descrição</dt><dd data-numeric>{{ detail.listing.description_len }} caract.</dd></div>
          <div class="def-row"><dt>Título</dt><dd data-numeric>{{ detail.listing.title_len }}/60</dd></div>
          <div class="def-row"><dt>Qualidade</dt><dd>{{ detail.listing.quality_score !== null ? `${detail.listing.quality_score}/100` : 'não calculada' }}</dd></div>
        </dl>
      </div>
    </div>

    <div>
      <p class="mb-2 font-semibold text-ink">O que fazer para vender mais</p>
      <p v-if="!detail.suggestions.length" class="text-ink-3">Nada pendente para este anúncio.</p>
      <ul v-else class="space-y-2">
        <li v-for="(s, i) in detail.suggestions" :key="i" class="flex items-start gap-3 rounded-card border border-line p-3">
          <span class="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="SUGGESTION_PRIORITY_CLASS[s.priority]">
            {{ SUGGESTION_PRIORITY_LABEL[s.priority] }}
          </span>
          <div class="min-w-0">
            <p class="text-[11px] font-medium uppercase tracking-wide text-ink-3">{{ s.area }}</p>
            <p class="font-medium text-ink">{{ s.title }}</p>
            <p class="text-ink-2">{{ s.why }}</p>
          </div>
        </li>
      </ul>
    </div>

    <div class="card p-4" :class="detail.price.low ? 'border-danger bg-danger-soft' : ''">
      <p class="mb-2 font-semibold text-ink">Referência de preço do Mercado Livre</p>

      <p v-if="detail.price.kind === 'loading'" class="text-ink-3">Calculando referência de preço…</p>
      <p v-else-if="detail.price.kind === 'none'" class="text-ink-3">Sem referência de preço para este anúncio.</p>

      <template v-else>
        <p class="text-ink-2">{{ detail.price.status_text }}</p>

        <template v-if="detail.price.kind === 'suggestion'">
          <div class="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span class="text-[24px] font-semibold text-ink" data-numeric>{{ brl(detail.price.suggested) }}</span>
            <span
              v-if="detail.price.diff_pct !== null"
              class="text-[13px] font-medium"
              :class="(detail.price.diff_pct ?? 0) < 0 ? 'text-danger' : 'text-success'"
              data-numeric
            >
              {{ detail.price.diff_pct > 0 ? '+' : '' }}{{ pct(detail.price.diff_pct) }}
            </span>
            <span v-if="detail.price.lowest !== null" class="text-[13px] text-ink-3">menor visto: {{ brl(detail.price.lowest) }}</span>
          </div>

          <dl v-if="detail.price.fee !== null" class="mt-2">
            <div class="def-row"><dt>Tarifa no sugerido</dt><dd data-numeric>{{ brl(detail.price.fee) }}</dd></div>
            <div class="def-row"><dt>Frete no sugerido</dt><dd data-numeric>{{ brl(detail.price.shipping) }}</dd></div>
            <div class="def-row"><dt>Imposto no sugerido</dt><dd data-numeric>{{ brl(detail.price.tax) }}</dd></div>
            <div v-if="detail.price.profit !== null" class="def-row">
              <dt>Lucro no sugerido</dt>
              <dd data-numeric>{{ brl(detail.price.profit) }} ({{ detail.price.margin_pct !== null ? pct(detail.price.margin_pct) : '—' }})</dd>
            </div>
            <div v-else-if="detail.price.max_cost !== null" class="def-row">
              <dt>Custo máximo p/ margem mínima</dt>
              <dd data-numeric>{{ brl(detail.price.max_cost) }}</dd>
            </div>
          </dl>

          <p v-if="detail.price.message" class="mt-2 text-[13px] font-semibold text-danger">{{ detail.price.message }}</p>
        </template>

        <div v-if="detail.price.competitors.length" class="mt-3">
          <p class="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-3">Concorrentes comparados</p>
          <table class="w-full text-[13px]">
            <tbody>
              <tr v-for="(c, i) in detail.price.competitors" :key="i" class="border-t border-line first:border-t-0">
                <td class="whitespace-nowrap py-1 pr-3 font-medium text-ink" data-numeric>{{ brl(c.price) }}</td>
                <td class="py-1 text-ink-2">{{ c.title }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>

    <div class="flex flex-wrap gap-4">
      <a :href="detail.links.public" target="_blank" rel="noopener" class="btn-link">Ver anúncio publicado</a>
      <a :href="detail.links.seller_panel" target="_blank" rel="noopener" class="btn-link">Ver no painel do vendedor</a>
    </div>

    <AiPlanPanel :item-id="row.id" />
  </div>
</template>
