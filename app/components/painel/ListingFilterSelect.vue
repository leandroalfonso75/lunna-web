<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

/**
 * Filtro da página Anúncios acima das abas (24–25/11/2026): uma lista de opções e "Personalizado", que abre um campo só de
 * números (o que não for dígito é apagado na hora; aplica depois de uma pausa na digitação). O valor emitido é o que vai
 * para a API (ex.: "90", "none") ou null sem filtro.
 */
const props = defineProps<{
  inputId: string
  label: string
  options: readonly { value: string; label: string }[]
  /** Texto depois do campo personalizado (ex.: "dias", "vendas ou mais"). */
  customUnit: string
  customPlaceholder?: string
  maxDigits?: number
  maxValue?: number
  /** Resumo mostrado com o filtro ativo, a partir do valor emitido. */
  summary: (value: string) => string
  testId: string
}>()
const model = defineModel<string | null>({ default: null })

const choice = ref('')
const customText = ref('')
const customValue = ref<string | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined

function toValue(digits: string): string | null {
  const n = Number(digits)
  if (!digits || !(n >= 1)) return null
  return String(props.maxValue ? Math.min(n, props.maxValue) : n)
}

function onCustomInput(event: Event) {
  const input = event.target as HTMLInputElement
  const digits = input.value.replace(/\D/g, '').slice(0, props.maxDigits ?? 6)
  if (input.value !== digits) input.value = digits
  customText.value = digits
  clearTimeout(timer)
  timer = setTimeout(() => { customValue.value = toValue(digits) }, 400)
}

const value = computed<string | null>(() => (choice.value === 'custom' ? customValue.value : choice.value || null))
watch(value, (v) => { model.value = v })
watch(choice, (c) => { if (c === 'custom') customValue.value = toValue(customText.value) })

function clear() {
  choice.value = ''
  customText.value = ''
  customValue.value = null
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" :data-test="testId">
    <slot name="icon" />
    <label :for="inputId" class="text-[13px] font-medium text-ink-2">{{ label }}</label>
    <select :id="inputId" v-model="choice" class="input h-9 w-auto" :data-test="`${testId}-periodo`">
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <template v-if="choice === 'custom'">
      <input
        :value="customText" type="text" inputmode="numeric" pattern="[0-9]*" :maxlength="maxDigits ?? 6" autocomplete="off"
        class="input h-9 w-24 text-right" :placeholder="customPlaceholder" :aria-label="`${label}: valor personalizado`" :data-test="`${testId}-dias`"
        @input="onCustomInput"
      />
      <span class="text-[13px] text-ink-2">{{ customUnit }}</span>
    </template>
    <button v-if="choice" type="button" class="btn-link text-[12px]" :data-test="`${testId}-limpar`" @click="clear">Limpar</button>
    <span v-if="value" class="text-[12px] text-ink-3" :data-test="`${testId}-resumo`">{{ summary(value) }}</span>
  </div>
</template>
