<script setup lang="ts">
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from '@heroicons/vue/24/outline'
import { brl, int, pct, pp } from '../../lib/format'
import type { Kpi } from '../../types/painel'

defineProps<{ kpis: Kpi[] }>()

function value(kpi: Kpi): string {
  if (kpi.value_type === 'money') return brl(kpi.value)
  if (kpi.value_type === 'pct') return pct(kpi.value)
  return int(kpi.value)
}

function deltaText(kpi: Kpi): string {
  if (!kpi.delta) return ''
  const abs = Math.abs(kpi.delta.value)
  return kpi.delta.unit === 'pp' ? pp(abs) : pct(abs)
}
</script>

<template>
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
    <div v-for="kpi in kpis" :key="kpi.key" class="card p-4">
      <p class="text-[13px] font-medium text-ink-2">{{ kpi.label }}</p>
      <p class="mt-1 text-[22px] font-semibold text-ink" data-numeric>{{ value(kpi) }}</p>
      <p v-if="kpi.sub_label" class="mt-0.5 text-[13px] text-ink-3">{{ kpi.sub_label }}</p>
      <p
        v-if="kpi.delta"
        class="mt-1.5 inline-flex flex-wrap items-center gap-1 text-[13px] font-medium"
        :class="{
          'text-success': kpi.delta.direction === 'up',
          'text-danger': kpi.delta.direction === 'down',
          'text-ink-3': kpi.delta.direction === 'flat'
        }"
      >
        <ArrowUpIcon v-if="kpi.delta.direction === 'up'" class="h-3.5 w-3.5" aria-hidden="true" />
        <ArrowDownIcon v-else-if="kpi.delta.direction === 'down'" class="h-3.5 w-3.5" aria-hidden="true" />
        <MinusIcon v-else class="h-3.5 w-3.5" aria-hidden="true" />
        {{ deltaText(kpi) }}
        <span class="font-normal text-ink-3">vs. semana anterior</span>
      </p>
    </div>
  </div>
</template>
