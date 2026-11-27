<script setup lang="ts">
import { ArrowDownRightIcon, ArrowRightIcon, ArrowUpRightIcon } from '@heroicons/vue/20/solid'
import { computed, resolveComponent, type Component } from 'vue'
import type { Delta } from '../../lib/dashboard'

/**
 * Cartão de indicador do novo layout (27/11/2026): rótulo, valor grande, variação contra o período anterior (seta +
 * cor + texto, nunca só cor; verde = bom, vermelho = ruim, conforme o indicador), detalhe e uma linha de tendência
 * pequena (sem eixos, só a forma). Clicável quando leva a uma seção.
 */
const props = defineProps<{
  label: string
  value: string
  icon?: Component
  delta?: Delta | null
  deltaUnit?: '%' | 'p.p.'
  hint?: string | null
  spark?: number[]
  to?: string
  loading?: boolean
}>()

const linkComponent = resolveComponent('NuxtLink')
const sparkPath = computed(() => {
  const v = props.spark ?? []
  if (v.length < 2) return ''
  const max = Math.max(...v)
  const min = Math.min(...v)
  const span = max - min || 1
  return v.map((p, i) => `${i ? 'L' : 'M'}${((i / (v.length - 1)) * 100).toFixed(1)},${(28 - ((p - min) / span) * 24).toFixed(1)}`).join(' ')
})
const deltaClass = computed(() => (!props.delta || props.delta.good === null ? 'delta-flat' : props.delta.good ? 'delta-up' : 'delta-down'))
const deltaText = computed(() => {
  if (!props.delta) return ''
  const sign = props.delta.pct > 0 ? '+' : ''
  return `${sign}${props.delta.pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${props.deltaUnit === 'p.p.' ? ' p.p.' : '%'}`
})
</script>

<template>
  <component :is="to ? linkComponent : 'div'" :to="to" class="panel group flex flex-col gap-2 p-4 transition-shadow" :class="to ? 'hover:border-primary hover:shadow-lift' : ''" data-test="kpi">
    <div class="flex items-center justify-between gap-2">
      <span class="text-[14px] font-medium text-ink-2">{{ label }}</span>
      <span v-if="icon" class="flex h-8 w-8 items-center justify-center rounded-card bg-primary-soft text-primary"><component :is="icon" class="h-[18px] w-[18px]" aria-hidden="true" /></span>
    </div>
    <div v-if="loading" class="h-8 w-32 animate-pulse rounded bg-surface-2" />
    <p v-else class="kpi-value" data-test="kpi-valor">{{ value }}</p>
    <div class="flex min-h-[22px] items-center gap-2">
      <span v-if="delta && !loading" :class="deltaClass" data-test="kpi-variacao">
        <ArrowUpRightIcon v-if="delta.trend === 'up'" class="h-3.5 w-3.5" aria-hidden="true" />
        <ArrowDownRightIcon v-else-if="delta.trend === 'down'" class="h-3.5 w-3.5" aria-hidden="true" />
        <ArrowRightIcon v-else class="h-3.5 w-3.5" aria-hidden="true" />
        {{ deltaText }}
      </span>
      <span v-if="hint" class="truncate text-[13px] text-ink-3">{{ hint }}</span>
    </div>
    <svg v-if="sparkPath && !loading" viewBox="0 0 100 30" preserveAspectRatio="none" class="h-8 w-full" aria-hidden="true">
      <path :d="sparkPath" fill="none" stroke="var(--chart-1)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" />
    </svg>
  </component>
</template>
