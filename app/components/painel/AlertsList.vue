<script setup lang="ts">
import { ChevronRightIcon } from '@heroicons/vue/24/outline'
import type { Alert } from '../../types/painel'

defineProps<{ alerts: Alert[] }>()
</script>

<template>
  <div class="card p-4">
    <h2 class="section-title mb-3">Precisa de atenção</h2>

    <p v-if="!alerts.length" class="text-[14px] text-ink-3">Nenhum alerta agora.</p>

    <ul v-else class="space-y-2">
      <li v-for="alert in alerts" :key="alert.key">
        <NuxtLink
          :to="`/anuncios?alert=${alert.key}`"
          class="flex items-center justify-between gap-3 rounded-card px-2 py-2 hover:bg-surface-2"
        >
          <div class="min-w-0">
            <p class="text-[14px] font-medium text-ink">{{ alert.title }}</p>
            <p class="text-[13px] text-ink-3">{{ alert.description }}</p>
          </div>
          <span class="flex shrink-0 items-center gap-1.5">
            <span
              class="rounded-full px-2 py-0.5 text-[13px] font-semibold"
              :class="{
                'bg-danger-soft text-danger': alert.severity === 'bad',
                'bg-warning-soft text-warning': alert.severity === 'warn',
                'bg-info-soft text-info': alert.severity === 'info'
              }"
            >
              {{ alert.count }}
            </span>
            <ChevronRightIcon class="h-4 w-4 text-ink-3" aria-hidden="true" />
          </span>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
