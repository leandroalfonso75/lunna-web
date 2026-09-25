<script setup lang="ts">
import { int } from '../../lib/format'
import type { TopSeller } from '../../types/painel'

defineProps<{ items: TopSeller[] }>()
</script>

<template>
  <div class="card p-4">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 class="section-title">Mais vendidos</h2>
      <div v-if="items.length" class="flex items-center gap-3 text-[12px] text-ink-2">
        <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-sm bg-primary" aria-hidden="true" /> Semana atual</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-sm bg-ink-3" aria-hidden="true" /> Semana anterior</span>
      </div>
    </div>

    <p v-if="!items.length" class="text-[14px] text-ink-3">Ninguém vendeu nas duas últimas semanas.</p>

    <ul v-else class="space-y-3">
      <li v-for="item in items" :key="item.id">
        <NuxtLink :to="`/anuncios?id=${item.id}`" class="block rounded-card px-1 py-1 hover:bg-surface-2">
          <div class="flex items-center justify-between gap-2">
            <p class="min-w-0 truncate text-[14px] text-ink">{{ item.title }}</p>
            <p class="shrink-0 text-[13px] font-medium text-ink-2" data-numeric>{{ int(item.units_week) }} un.</p>
          </div>
          <div class="mt-1 flex items-center gap-1">
            <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div class="h-full rounded-full bg-primary" :style="{ width: `${item.bar_pct}%` }" />
            </div>
            <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div class="h-full rounded-full bg-ink-3" :style="{ width: `${item.bar_prev_pct}%` }" />
            </div>
          </div>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
