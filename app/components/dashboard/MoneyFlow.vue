<script setup lang="ts">
import { computed } from 'vue'
import { brl } from '../../lib/format'
import type { FlowRow } from '../../lib/dashboard'

/**
 * "Para onde vai cada R$ 100 vendido" (novo layout, 27/11/2026): cada parcela do faturamento do período como barra
 * horizontal com o valor e o % ao lado (barras numa cor só, magnitude; o lucro em destaque com a cor da marca).
 * Mostra, de relance, o que mais pesa no resultado.
 */
const props = defineProps<{ rows: FlowRow[]; revenue: number }>()
const maxShare = computed(() => Math.max(1, ...props.rows.map((r) => Math.abs(r.share))))
const pct = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
</script>

<template>
  <ul class="space-y-2.5" data-test="para-onde-vai">
    <li v-for="r in rows" :key="r.key" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
      <span class="truncate text-[14px]" :class="r.kind === 'profit' ? 'font-semibold text-ink' : 'text-ink-2'">{{ r.label }}</span>
      <span class="text-right text-[14px]" style="font-variant-numeric: tabular-nums">
        <span :class="r.kind === 'profit' ? (r.value >= 0 ? 'font-semibold text-ink' : 'font-semibold text-danger') : 'text-ink'">{{ pct(r.share) }}</span>
        <span class="ml-2 text-[13px] text-ink-3">{{ brl(r.value) }}</span>
      </span>
      <div class="col-span-2 h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          class="h-full rounded-full"
          :class="r.kind === 'profit' ? (r.value >= 0 ? 'bg-chart-1' : 'bg-danger') : 'bg-chart-1 opacity-30'"
          :style="{ width: `${Math.max(1.5, (Math.abs(r.share) / maxShare) * 100)}%` }"
        />
      </div>
    </li>
  </ul>
</template>
