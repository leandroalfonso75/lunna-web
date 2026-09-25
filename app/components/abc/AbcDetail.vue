<script setup lang="ts">
import AiPlanPanel from './AiPlanPanel.vue'
import { brl, int, pct } from '../../lib/format'
import type { AbcItemDetail, AbcRow } from '../../types/painel'

const props = defineProps<{
  row: AbcRow
  detail: AbcItemDetail | undefined
  loading: boolean
  loadError: boolean
  hasCosts: boolean
}>()

defineEmits<{ retry: [] }>()

function profitLabel(): string {
  return props.hasCosts ? 'Lucro líquido do mês' : 'Lucro antes do custo'
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
      <div>
        <p class="mb-1 font-semibold text-ink">Indicadores 30d</p>
        <p class="text-ink-2">Visitas: {{ int(detail.indicators.visits) }} (antes {{ int(detail.indicators.prev_visits) }})</p>
        <p class="text-ink-2">Vendas: {{ int(detail.indicators.units) }} (antes {{ int(detail.indicators.prev_units) }})</p>
        <p class="text-ink-2">Conversão: {{ pct(detail.indicators.conversion) }}</p>
        <p class="text-ink-2">Participação: {{ pct(detail.indicators.share_pct) }} · acumulado {{ pct(detail.indicators.cum_pct) }}</p>
      </div>

      <div>
        <p class="mb-1 font-semibold text-ink">{{ profitLabel() }}</p>
        <p class="text-ink-2">Faturamento: {{ brl(detail.month.revenue) }}</p>
        <p class="text-ink-2">Tarifas: {{ brl(detail.month.fees) }} · Frete: {{ brl(detail.month.shipping) }} · Imposto: {{ brl(detail.month.tax) }}</p>
        <p class="text-ink-2">Custo: {{ detail.month.cost !== null ? brl(detail.month.cost) : '—' }}</p>
        <p class="font-medium" :class="detail.month.margin_state === 'bad' ? 'text-danger' : 'text-ink'">
          Lucro: {{ brl(detail.month.profit) }} · Margem: {{ detail.month.margin_pct !== null ? pct(detail.month.margin_pct) : '—' }}
        </p>
      </div>

      <div>
        <p class="mb-1 font-semibold text-ink">Por unidade</p>
        <p class="text-ink-2">Preço: {{ brl(detail.unit.price) }} <span v-if="detail.unit.full_price">(de {{ brl(detail.unit.full_price) }})</span></p>
        <p class="text-ink-2">Tarifa: {{ brl(detail.unit.fee) }} · Frete: {{ brl(detail.unit.shipping) }} · Imposto: {{ brl(detail.unit.tax) }}</p>
        <p class="text-ink-2">Custo: {{ detail.unit.cost !== null ? brl(detail.unit.cost) : '—' }}</p>
        <p class="font-medium" :class="detail.unit.margin_state === 'bad' ? 'text-danger' : 'text-ink'">
          Lucro: {{ brl(detail.unit.profit) }} · Margem: {{ detail.unit.margin_pct !== null ? pct(detail.unit.margin_pct) : '—' }}
        </p>
      </div>

      <div>
        <p class="mb-1 font-semibold text-ink">Cadastro</p>
        <p class="text-ink-2">Estoque: {{ int(detail.listing.stock) }} · {{ detail.listing.listing_type_label ?? '—' }}</p>
        <p class="text-ink-2">Fotos: {{ detail.listing.pictures }} · Vídeo: {{ detail.listing.has_video ? 'sim' : 'não' }}</p>
        <p class="text-ink-2">Descrição: {{ detail.listing.description_len }} caracteres</p>
        <p class="text-ink-2">Título: {{ detail.listing.title_len }}/60</p>
        <p class="text-ink-2">Qualidade: {{ detail.listing.quality_score !== null ? `${detail.listing.quality_score}/100` : 'O Mercado Livre não calculou' }}</p>
      </div>
    </div>

    <div>
      <p class="mb-2 font-semibold text-ink">O que fazer para vender mais</p>
      <p v-if="!detail.suggestions.length" class="text-ink-3">Nada pendente para este anúncio.</p>
      <ul v-else class="space-y-1.5">
        <li v-for="(s, i) in detail.suggestions" :key="i" class="flex items-start gap-2">
          <span
            class="mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold"
            :class="s.priority === 1 ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-ink-2'"
          >
            {{ s.priority === 1 ? 'Urgente' : `P${s.priority}` }}
          </span>
          <span class="text-ink-2"><span class="font-medium text-ink">{{ s.area }}:</span> {{ s.title }} — {{ s.why }}</span>
        </li>
      </ul>
    </div>

    <div class="card p-4" :class="detail.price.low ? 'border-danger bg-danger-soft' : ''">
      <p class="mb-1 font-semibold text-ink">Referência de preço do Mercado Livre</p>

      <p v-if="detail.price.kind === 'loading'" class="text-ink-3">Calculando referência de preço…</p>
      <p v-else-if="detail.price.kind === 'none'" class="text-ink-3">Sem referência de preço para este anúncio.</p>
      <template v-else>
        <p class="text-ink-2">{{ detail.price.status_text }}</p>
        <template v-if="detail.price.kind === 'suggestion'">
          <p class="text-ink-2">
            Sugerido: {{ brl(detail.price.suggested) }}
            <span v-if="detail.price.diff_pct !== null">({{ pct(detail.price.diff_pct) }})</span>
            <span v-if="detail.price.lowest !== null"> · menor visto: {{ brl(detail.price.lowest) }}</span>
          </p>
          <p v-if="detail.price.fee !== null" class="text-ink-2">
            Tarifa: {{ brl(detail.price.fee) }} · Frete: {{ brl(detail.price.shipping) }} · Imposto: {{ brl(detail.price.tax) }}
          </p>
          <p v-if="detail.price.profit !== null" class="text-ink-2">
            Lucro no sugerido: {{ brl(detail.price.profit) }} · Margem: {{ detail.price.margin_pct !== null ? pct(detail.price.margin_pct) : '—' }}
          </p>
          <p v-else-if="detail.price.max_cost !== null" class="text-ink-2">Custo máximo para manter a margem mínima: {{ brl(detail.price.max_cost) }}</p>
          <p v-if="detail.price.message" class="font-medium text-danger">{{ detail.price.message }}</p>
        </template>
        <ul v-if="detail.price.competitors.length" class="mt-1 space-y-0.5 text-ink-3">
          <li v-for="(c, i) in detail.price.competitors" :key="i">{{ brl(c.price) }} — {{ c.title }}</li>
        </ul>
      </template>
    </div>

    <div class="flex flex-wrap gap-4">
      <a :href="detail.links.public" target="_blank" rel="noopener" class="btn-link">Ver anúncio publicado</a>
      <a :href="detail.links.seller_panel" target="_blank" rel="noopener" class="btn-link">Ver no painel do vendedor</a>
    </div>

    <AiPlanPanel :item-id="row.id" />
  </div>
</template>
