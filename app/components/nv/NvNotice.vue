<script setup lang="ts">
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XCircleIcon } from '@heroicons/vue/24/outline'
import { computed } from 'vue'

/** Aviso do layout novo (27/11/2026): ícone + texto, nunca só cor. tone: info | success | warning | danger. */
const props = withDefaults(defineProps<{ tone?: 'info' | 'success' | 'warning' | 'danger'; title?: string }>(), { tone: 'info' })
const STYLE = {
  info: { cls: 'border-line bg-surface-2 text-ink-2', icon: InformationCircleIcon, ic: 'text-primary' },
  success: { cls: 'border-success bg-success-soft text-ink', icon: CheckCircleIcon, ic: 'text-success' },
  warning: { cls: 'border-warning bg-warning-soft text-ink', icon: ExclamationTriangleIcon, ic: 'text-warning' },
  danger: { cls: 'border-danger bg-danger-soft text-ink', icon: XCircleIcon, ic: 'text-danger' }
}
const s = computed(() => STYLE[props.tone])
</script>

<template>
  <div class="nv flex gap-3 rounded-panel border px-4 py-3 text-[14px]" :class="s.cls" :role="tone === 'danger' ? 'alert' : 'status'">
    <component :is="s.icon" class="h-5 w-5 shrink-0" :class="s.ic" aria-hidden="true" />
    <div class="min-w-0">
      <p v-if="title" class="font-semibold text-ink">{{ title }}</p>
      <slot />
    </div>
  </div>
</template>
