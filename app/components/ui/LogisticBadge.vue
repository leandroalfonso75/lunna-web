<script setup lang="ts">
import { computed } from 'vue'

/**
 * Forma de envio como figura (pedido do usuário em 14/11/2026), igual à seção Vendas: Full, Agência e Flex (letras azuis).
 * Aceita o tipo do ML (`fulfillment`, `xd_drop_off`, `drop_off`, `self_service`) ou o rótulo (Full, Agência, Flex).
 * Outras formas (Coleta etc.) ficam em texto.
 */
const props = withDefaults(defineProps<{ type?: string | null; label?: string | null; size?: 'sm' | 'md' }>(), { type: null, label: null, size: 'sm' })

const BY_TYPE: Record<string, { src: string; alt: string }> = {
  fulfillment: { src: '/logistica/full.png', alt: 'Full' },
  xd_drop_off: { src: '/logistica/agencia.png', alt: 'Agência' },
  drop_off: { src: '/logistica/agencia.png', alt: 'Agência' },
  self_service: { src: '/logistica/flex.svg', alt: 'Flex' }
}
const BY_LABEL: Record<string, string> = { full: 'fulfillment', agencia: 'drop_off', 'agência': 'drop_off', flex: 'self_service' }

const badge = computed(() => {
  if (props.type && BY_TYPE[props.type]) return BY_TYPE[props.type]
  const key = BY_LABEL[(props.label ?? '').trim().toLowerCase()]
  return key ? BY_TYPE[key] : null
})
</script>

<template>
  <img v-if="badge" :src="badge.src" :alt="badge.alt" :title="badge.alt" class="inline-block w-auto shrink-0 align-middle" :class="size === 'md' ? 'h-5' : 'h-4'" data-test="logistic-badge" />
  <span v-else-if="label" class="text-[11px] text-ink-3">{{ label }}</span>
</template>
