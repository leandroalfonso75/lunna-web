<script setup lang="ts">
import { brl, dateTimeShort } from '../../lib/format'
import type { RecentSale } from '../../types/painel'

defineProps<{ sales: RecentSale[] }>()
</script>

<template>
  <div class="card p-4">
    <h2 class="section-title mb-3">Últimas vendas</h2>

    <p v-if="!sales.length" class="text-[14px] text-ink-3">Nenhuma venda ainda.</p>

    <ul v-else class="divide-y divide-line">
      <li v-for="(sale, i) in sales" :key="`${sale.item_id}-${sale.at}-${i}`" class="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
        <div class="min-w-0">
          <p class="text-[13px] text-ink-3" data-numeric>{{ dateTimeShort(sale.at) }}</p>
          <p class="truncate text-[14px] text-ink">
            <span v-if="sale.quantity > 1" class="font-medium text-primary">{{ sale.quantity }}× </span>{{ sale.title }}
          </p>
        </div>
        <p class="shrink-0 text-[14px] font-medium text-ink" data-numeric>{{ brl(sale.total) }}</p>
      </li>
    </ul>
  </div>
</template>
