<script setup lang="ts">
import { computed } from 'vue'
import { brl, int, pct } from '../../lib/format'
import type { SalesDay, SalesSummary } from '../../types/sales'

const props = defineProps<{ summary: SalesSummary; daily: SalesDay[] }>()

const cards = computed(() => [
  { key: 'orders', label: 'Vendas', value: int(props.summary.orders), hint: props.summary.cancelled ? `${int(props.summary.cancelled)} canceladas (fora dos totais)` : `${int(props.summary.units)} unidades` },
  { key: 'revenue', label: 'Faturamento', value: brl(props.summary.revenue), hint: `Ticket médio ${brl(props.summary.ticket)}` },
  { key: 'profit', label: 'Lucro líquido', value: brl(props.summary.net_profit), hint: props.summary.net_profit_pct === null ? 'Sem custo nos itens' : `${pct(props.summary.net_profit_pct)} do faturamento`, tone: props.summary.net_profit < 0 ? 'text-danger' : 'text-success' },
  { key: 'fees', label: 'Tarifas + frete', value: brl(props.summary.fee + props.summary.shipping_cost), hint: `Tarifa ${brl(props.summary.fee)} · frete ${brl(props.summary.shipping_cost)}` },
  { key: 'tax', label: 'Imposto + despesas', value: brl(props.summary.tax + props.summary.fixed_expenses), hint: `Imposto ${brl(props.summary.tax)} · fixas ${brl(props.summary.fixed_expenses)}` },
  { key: 'cost', label: 'Custo dos produtos', value: brl(props.summary.cost), hint: 'Do Olist (PEPS) pelo SKU' },
  { key: 'ads', label: 'Custo com Ads', value: brl(props.summary.ads_cost), hint: props.summary.orders_ads_pending ? `${int(props.summary.orders_ads_pending)} vendas com Ads ainda pendente` : 'Gasto de Ads dividido entre as vendas' },
  { key: 'after_ads', label: 'Lucro pós Ads', value: brl(props.summary.net_profit_after_ads), hint: props.summary.net_profit_after_ads_pct === null ? 'Sem custo nos itens' : `${pct(props.summary.net_profit_after_ads_pct)} do faturamento`, tone: props.summary.net_profit_after_ads < 0 ? 'text-danger' : 'text-success' }
])

const max = computed(() => Math.max(1, ...props.daily.map((d) => d.revenue)))
const labelEvery = computed(() => Math.max(1, Math.ceil(props.daily.length / 12)))

function dayLabel(date: string): string {
  const [, m, d] = date.split('-')
  return `${d}/${m}`
}
</script>

<template>
  <section class="space-y-4" aria-label="Resumo das vendas">
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div v-for="card in cards" :key="card.key" class="card p-4" :data-test="`kpi-${card.key}`">
        <p class="text-[12px] font-medium text-ink-2">{{ card.label }}</p>
        <p class="mt-1 text-[20px] font-semibold leading-tight" :class="card.tone ?? 'text-ink'" data-numeric>{{ card.value }}</p>
        <p class="mt-1 text-[11px] text-ink-3">{{ card.hint }}</p>
      </div>
    </div>

    <p v-if="summary.orders_without_cost" class="rounded-card border border-warning bg-warning-soft px-3 py-2 text-[13px] text-warning" role="status">
      {{ int(summary.orders_without_cost) }} {{ summary.orders_without_cost === 1 ? 'venda está' : 'vendas estão' }} sem custo de algum item no Olist; o lucro dela não entra no total. O custo vem do SKU em Produtos.
    </p>

    <div class="card p-4">
      <div class="mb-2 flex items-baseline justify-between">
        <p class="text-[13px] font-semibold text-ink">Faturamento por dia</p>
        <p class="text-[11px] text-ink-3">Passe o mouse na barra para ver o dia</p>
      </div>
      <div class="flex h-32 items-end gap-[2px]" role="img" aria-label="Faturamento diário no período">
        <div
          v-for="day in daily"
          :key="day.date"
          class="group relative flex h-full max-w-[4rem] flex-1 items-end"
          :title="`${dayLabel(day.date)}: ${int(day.orders)} vendas · ${brl(day.revenue)} · lucro ${brl(day.net_profit)}`"
        >
          <div class="w-full rounded-t bg-primary opacity-70 group-hover:opacity-100" :style="{ height: `${Math.max(2, (day.revenue / max) * 100)}%` }" />
        </div>
      </div>
      <div class="mt-1 flex gap-[2px] text-[10px] text-ink-3">
        <span v-for="(day, i) in daily" :key="day.date" class="flex-1 overflow-visible whitespace-nowrap">{{ i % labelEvery === 0 ? dayLabel(day.date) : '' }}</span>
      </div>
    </div>
  </section>
</template>
