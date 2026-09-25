<script setup lang="ts">
import { SparklesIcon } from '@heroicons/vue/24/outline'
import { useAiPlan } from '../../composables/useAiPlan'

/**
 * Plano de ação com IA (SPEC §9): "Gerar" → "Parar" (aborta) → "Gerar de
 * novo", resultado em memória por anúncio enquanto a página está aberta
 * (`useAiPlan` é module-scope, chaveado por `item_id`).
 */
const props = defineProps<{ itemId: string }>()

const ai = useAiPlan()
const state = ai.stateFor(props.itemId)

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
    <button type="button" class="btn-primary" @click="onClick">
      <SparklesIcon class="h-4 w-4" aria-hidden="true" />
      {{ buttonLabel() }}
    </button>

    <div v-if="state.text" class="mt-3 whitespace-pre-wrap rounded-card border border-line bg-surface-2 p-3 text-[13px] text-ink">
      {{ state.text }}
    </div>

    <p v-if="state.status === 'error'" role="alert" class="mt-2 text-[13px] text-danger">{{ state.error }}</p>

    <p v-if="state.status === 'done'" class="mt-2 text-[12px] text-ink-3">
      Plano gerado a partir dos dados deste anúncio. Revise antes de aplicar.
    </p>
  </div>
</template>
