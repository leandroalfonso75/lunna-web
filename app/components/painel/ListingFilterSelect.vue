<script setup lang="ts">
import { computed, ref } from 'vue'

/**
 * Filtro da página Anúncios acima das abas (24–25/11/2026): uma lista de opções e "Personalizado", que abre um campo só de
 * números (ou "de"/"até" com `customRange`). O filtro só vale depois de clicar em **Aplicar** (pedido do usuário em
 * 25/11/2026); "Limpar" tira o filtro na hora. O valor emitido é o que vai para a API (ex.: "90", "none", "5-9", "25-")
 * ou null sem filtro.
 */
const props = defineProps<{
  inputId: string
  label: string
  options: readonly { value: string; label: string }[]
  /** Texto depois do campo personalizado (ex.: "dias", "vendas"). */
  customUnit: string
  customPlaceholder?: string
  /** Personalizado com dois campos, "de" e "até" ("até" vazio = sem teto); emite "A-B" ou "A-". */
  customRange?: boolean
  maxDigits?: number
  maxValue?: number
  /** Resumo do filtro aplicado, a partir do valor emitido. */
  summary: (value: string) => string
  testId: string
}>()
const model = defineModel<string | null>({ default: null })

const choice = ref('')
const customText = ref('')
const customTo = ref('')

const digitsOnly = (raw: string) => raw.replace(/\D/g, '').slice(0, props.maxDigits ?? 6)
function onDigits(event: Event, field: 'from' | 'to') {
  const input = event.target as HTMLInputElement
  const digits = digitsOnly(input.value)
  if (input.value !== digits) input.value = digits
  if (field === 'from') customText.value = digits
  else customTo.value = digits
}
const clamp = (n: number) => (props.maxValue ? Math.min(n, props.maxValue) : n)

/** Faixa personalizada com o "até" menor que o "de". */
const rangeInvalid = computed(() => !!(props.customRange && choice.value === 'custom' && customText.value && customTo.value && Number(customTo.value) < Number(customText.value)))

/** O que está escolhido na tela (ainda não aplicado). */
const draft = computed<string | null>(() => {
  if (choice.value !== 'custom') return choice.value || null
  if (props.customRange) {
    if (!customText.value || rangeInvalid.value) return null
    const from = clamp(Number(customText.value))
    if (!customTo.value) return from >= 1 ? `${from}-` : null
    return `${from}-${clamp(Number(customTo.value))}`
  }
  const n = Number(customText.value)
  return customText.value && n >= 1 ? String(clamp(n)) : null
})

const pending = computed(() => draft.value !== (model.value ?? null))
const canApply = computed(() => pending.value && !rangeInvalid.value && !(choice.value === 'custom' && draft.value === null))

function apply() {
  if (canApply.value) model.value = draft.value
}

function clear() {
  choice.value = ''
  customText.value = ''
  customTo.value = ''
  model.value = null
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" :data-test="testId">
    <slot name="icon" />
    <label :for="inputId" class="text-[13px] font-medium text-ink-2">{{ label }}</label>
    <select :id="inputId" v-model="choice" class="input h-9 w-auto" :data-test="`${testId}-periodo`">
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <template v-if="choice === 'custom'">
      <span v-if="customRange" class="text-[13px] text-ink-2">de</span>
      <input
        :value="customText" type="text" inputmode="numeric" pattern="[0-9]*" :maxlength="maxDigits ?? 6" autocomplete="off"
        class="input h-9 w-24 text-right" :placeholder="customPlaceholder" :aria-label="customRange ? `${label}: de` : `${label}: valor personalizado`"
        :data-test="`${testId}-dias`" @input="onDigits($event, 'from')" @keydown.enter="apply"
      />
      <template v-if="customRange">
        <span class="text-[13px] text-ink-2">até</span>
        <input
          :value="customTo" type="text" inputmode="numeric" pattern="[0-9]*" :maxlength="maxDigits ?? 6" autocomplete="off"
          class="input h-9 w-24 text-right" placeholder="sem limite" :aria-label="`${label}: até`"
          :data-test="`${testId}-ate`" @input="onDigits($event, 'to')" @keydown.enter="apply"
        />
      </template>
      <span class="text-[13px] text-ink-2">{{ customUnit }}</span>
    </template>
    <button
      type="button" class="btn-primary h-9 rounded-full px-5" :disabled="!canApply" :data-test="`${testId}-aplicar`"
      @click="apply"
    >Aplicar</button>
    <button v-if="choice || model" type="button" class="btn-link text-[12px]" :data-test="`${testId}-limpar`" @click="clear">Limpar</button>
    <span v-if="rangeInvalid" class="text-[12px] text-danger" :data-test="`${testId}-erro`">o "até" precisa ser maior ou igual ao "de"</span>
    <span v-else-if="pending && (draft || model)" class="text-[12px] text-warning" :data-test="`${testId}-pendente`">clique em Aplicar para filtrar</span>
    <span v-else-if="model" class="text-[12px] text-ink-3" :data-test="`${testId}-resumo`">aplicado: {{ summary(model) }}</span>
  </div>
</template>
