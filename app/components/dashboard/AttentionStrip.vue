<script setup lang="ts">
import { ArrowRightIcon, CheckCircleIcon, ExclamationCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/vue/24/outline'
import { computed, ref } from 'vue'
import type { AttentionItem } from '../../lib/dashboard'

/**
 * "Precisa da sua atenção" (novo layout, 27/11/2026): o que espera o vendedor, do mais urgente ao que pode esperar,
 * cada item com o número, o porquê e um atalho para resolver. Sem nada pendente, um aviso de que está tudo em dia.
 * Tom pelo ícone + texto, nunca só pela cor.
 */
const props = defineProps<{ items: AttentionItem[]; loading?: boolean }>()
// os 4 mais urgentes primeiro; o resto num clique (para os indicadores aparecerem sem rolar)
const FIRST = 4
const expanded = ref(false)
const visible = computed(() => (expanded.value ? props.items : props.items.slice(0, FIRST)))
const ICON = { danger: ExclamationCircleIcon, warning: ExclamationTriangleIcon, info: InformationCircleIcon }
const TONE = { danger: 'bg-danger-soft text-danger', warning: 'bg-warning-soft text-warning', info: 'bg-info-soft text-info' }
</script>

<template>
  <section class="panel p-4" aria-labelledby="atencao-titulo" data-test="atencao">
    <div class="mb-3 flex items-center justify-between gap-2">
      <h2 id="atencao-titulo" class="panel-title">Precisa da sua atenção <span v-if="items.length" class="ml-1 rounded-full bg-danger px-2 py-0.5 text-[13px] font-bold text-white">{{ items.length }}</span></h2>
      <span class="panel-sub hidden sm:block">Do mais urgente ao que pode esperar</span>
    </div>
    <div v-if="loading && !items.length" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div v-for="i in 4" :key="i" class="h-[76px] animate-pulse rounded-card bg-surface-2" />
    </div>
    <p v-else-if="!items.length" class="flex items-center gap-2 rounded-card bg-success-soft px-4 py-3 text-[14px] text-success" data-test="atencao-em-dia">
      <CheckCircleIcon class="h-5 w-5" aria-hidden="true" /> Tudo em dia: nenhuma pergunta, mensagem ou reclamação esperando, e nenhum alerta nos anúncios.
    </p>
    <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <NuxtLink
        v-for="item in visible"
        :key="item.key"
        :to="item.to"
        class="group flex items-start gap-3 rounded-card border border-line p-3 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-panel"
        data-test="atencao-item"
      >
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-card" :class="TONE[item.tone]"><component :is="ICON[item.tone]" class="h-5 w-5" aria-hidden="true" /></span>
        <span class="min-w-0 flex-1">
          <span class="flex items-start gap-2">
            <span class="text-[20px] font-semibold leading-none text-ink" style="font-variant-numeric: tabular-nums">{{ item.count }}</span>
            <span class="text-[14px] font-semibold leading-snug text-ink">{{ item.label }}</span>
          </span>
          <span class="mt-1 line-clamp-2 block text-[13px] text-ink-3">{{ item.detail }}</span>
        </span>
        <ArrowRightIcon class="mt-1 h-4 w-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
      </NuxtLink>
    </div>
    <button v-if="items.length > FIRST" type="button" class="btn-link mt-3" data-test="atencao-mais" @click="expanded = !expanded">
      {{ expanded ? 'Mostrar menos' : `Ver mais ${items.length - FIRST}` }}
    </button>
  </section>
</template>
