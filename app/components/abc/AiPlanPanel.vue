<script setup lang="ts">
import { SparklesIcon } from '@heroicons/vue/24/outline'
import { computed, onMounted } from 'vue'
import { useAiPlan } from '../../composables/useAiPlan'
import { useSessionStore } from '../../stores/session'

/**
 * Plano de ação com IA (SPEC §9): "Gerar" → "Parar" → "Gerar de novo". A
 * geração roda no servidor e a tela faz polling; o último plano fica salvo e
 * é recarregado ao abrir o anúncio (`useAiPlan` é module-scope, chaveado por
 * `item_id`).
 *
 * DECISOES.md §10: cada empresa configura a própria chave/modelo da
 * OpenRouter em Configurações › Empresa — sem isso o botão fica desabilitado.
 */
const props = defineProps<{ itemId: string }>()

const ai = useAiPlan()
const state = ai.stateFor(props.itemId)
const session = useSessionStore()

// Só no cliente: mostra o plano salvo (ou retoma o acompanhamento de um em geração).
onMounted(() => ai.load(props.itemId))

const aiConfigured = computed(() => session.company?.ai_configured ?? false)

function onClick() {
  if (state.status === 'loading') ai.stop(props.itemId)
  else ai.generate(props.itemId)
}

function buttonLabel(): string {
  if (state.status === 'loading') return 'Parar'
  if (state.status === 'done' || state.status === 'error') return 'Gerar de novo'
  return 'Plano de ação detalhado com IA'
}
</script>

<template>
  <div class="border-t border-line pt-4">
    <div class="flex flex-wrap items-center gap-3">
      <button type="button" class="btn-primary" :disabled="!aiConfigured" @click="onClick">
        <SparklesIcon class="h-4 w-4" aria-hidden="true" />
        {{ buttonLabel() }}
      </button>
      <span v-if="state.status === 'loading'" role="status" class="inline-flex items-center gap-1.5 text-[13px] text-ink-3">
        <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />
        Gerando…
      </span>
      <span v-else-if="aiConfigured && session.company?.ai_model" class="text-[13px] text-ink-3">
        Modelo: {{ session.company.ai_model }}
      </span>
    </div>

    <p v-if="!aiConfigured && session.isAdmin" data-test="ai-nao-configurada" class="mt-2 text-[13px] text-ink-3">
      Configure a OpenRouter em
      <NuxtLink to="/configuracoes?aba=empresa" class="btn-link">Configurações › Empresa</NuxtLink>
      para gerar planos.
    </p>
    <p v-else-if="!aiConfigured" data-test="ai-nao-configurada" class="mt-2 text-[13px] text-ink-3">
      Peça a um administrador para configurar a OpenRouter.
    </p>

    <!-- Largura de leitura (~72ch) para não estirar o texto corrido na tela toda. -->
    <div
      v-if="state.text"
      class="mt-3 max-w-[72ch] whitespace-pre-wrap rounded-card border border-line bg-surface-2 p-3 text-[13px] leading-relaxed text-ink"
    >
      {{ state.text }}<span
        v-if="state.status === 'loading'"
        class="inline-block w-[2px] animate-pulse bg-ink-3 align-middle"
        style="height: 1em"
        aria-hidden="true"
      /></div>

    <p v-if="state.status === 'error'" role="alert" class="mt-2 text-[13px] text-danger">{{ state.error }}</p>

    <p v-if="state.status === 'done'" class="mt-2 max-w-[72ch] text-[12px] text-ink-3">
      Plano gerado a partir dos dados deste anúncio. Revise antes de aplicar. A IA não altera nada no Mercado Livre.
    </p>
  </div>
</template>
