<script setup lang="ts">
import { CalendarDaysIcon } from '@heroicons/vue/24/outline'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import CatalogTable from '../components/painel/CatalogTable.vue'
import EmptyAccountState from '../components/painel/EmptyAccountState.vue'
import ItemsTable from '../components/painel/ItemsTable.vue'
import PageHeader from '../components/painel/PageHeader.vue'
import { useSessionStore } from '../stores/session'

/**
 * `/anuncios` (SPEC §7.7): tabela completa de anúncios com filtros (`ItemsTable.vue`, dona do cabeçalho) e a aba
 * Catálogo (pedido do usuário em 08/11/2026): anúncios de catálogo, sincronização com tradicional e ganhando/perdendo.
 * Acima das abas (pedido do usuário em 24/11/2026): "Anúncios criados há mais de" 30, 60, 90, 180, 365 dias ou um número
 * de dias informado (só números). Vale para as duas abas; o filtro é aplicado na API (`created_older_than`).
 */
const session = useSessionStore()
const tab = ref<'todos' | 'catalogo'>('todos')
const TABS = [{ value: 'todos', label: 'Todos' }, { value: 'catalogo', label: 'Catálogo' }] as const

const PERIODS = [
  { value: '', label: 'Qualquer data' },
  { value: '30', label: '30 dias' },
  { value: '60', label: '60 dias' },
  { value: '90', label: '90 dias' },
  { value: '180', label: '180 dias' },
  { value: '365', label: '365 dias' },
  { value: 'custom', label: 'Personalizado' }
] as const
const MAX_DAYS = 36500

const period = ref<string>('')
const customText = ref('')
/** Dias efetivos do personalizado, aplicados depois de uma pausa na digitação. */
const customDays = ref<number | null>(null)
let customTimer: ReturnType<typeof setTimeout> | undefined

const toDays = (digits: string) => (digits && Number(digits) >= 1 ? Math.min(Number(digits), MAX_DAYS) : null)

/** Campo personalizado: só números (o que não for dígito é removido na hora). */
function onCustomInput(event: Event) {
  const input = event.target as HTMLInputElement
  const digits = input.value.replace(/\D/g, '').slice(0, 5)
  if (input.value !== digits) input.value = digits
  customText.value = digits
  clearTimeout(customTimer)
  customTimer = setTimeout(() => { customDays.value = toDays(digits) }, 400)
}

const createdOlderThan = computed<number | null>(() => {
  if (period.value === 'custom') return customDays.value
  return period.value ? Number(period.value) : null
})

watch(period, (value) => {
  if (value === 'custom') customDays.value = toDays(customText.value)
})

function clearPeriod() {
  period.value = ''
  customText.value = ''
  customDays.value = null
}

onBeforeUnmount(() => clearTimeout(customTimer))
</script>

<template>
  <EmptyAccountState v-if="!session.selectedAccount" />
  <div v-else class="page space-y-6">
    <PageHeader />

    <div class="flex flex-wrap items-center gap-2" data-test="filtro-criacao">
      <CalendarDaysIcon class="h-5 w-5 text-ink-3" aria-hidden="true" />
      <label for="criados-ha" class="text-[13px] font-medium text-ink-2">Anúncios criados há mais de</label>
      <select id="criados-ha" v-model="period" class="input h-9 w-auto" data-test="filtro-criacao-periodo">
        <option v-for="p in PERIODS" :key="p.value" :value="p.value">{{ p.label }}</option>
      </select>
      <template v-if="period === 'custom'">
        <input
          :value="customText" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="5" autocomplete="off"
          class="input h-9 w-24 text-right" placeholder="ex.: 45" aria-label="Número de dias" data-test="filtro-criacao-dias"
          @input="onCustomInput"
        />
        <span class="text-[13px] text-ink-2">dias</span>
      </template>
      <button v-if="period" type="button" class="btn-link text-[12px]" data-test="filtro-criacao-limpar" @click="clearPeriod">Limpar</button>
      <span v-if="createdOlderThan" class="text-[12px] text-ink-3" data-test="filtro-criacao-resumo">mostrando só os criados há mais de {{ createdOlderThan }} dias</span>
    </div>

    <div class="flex gap-1 border-b border-line" role="tablist" aria-label="Abas de anúncios">
      <button
        v-for="t in TABS" :key="t.value"
        type="button" role="tab" :aria-selected="tab === t.value"
        class="-mb-px border-b-2 px-4 py-2 text-[14px] font-medium"
        :class="tab === t.value ? 'border-primary text-primary' : 'border-transparent text-ink-2 hover:text-ink'"
        :data-test="`aba-${t.value}`"
        @click="tab = t.value"
      >{{ t.label }}</button>
    </div>
    <ItemsTable v-show="tab === 'todos'" :created-older-than="createdOlderThan" />
    <CatalogTable v-if="tab === 'catalogo'" :created-older-than="createdOlderThan" />
  </div>
</template>
