<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useToast } from '../../composables/useToast'
import { apiErrorMessage } from '../../lib/apiErrors'
import type { SettingsClient } from '../../lib/settingsClient'
import type { Company } from '../../types/api'

/**
 * Ruling P4-7 (mesma convenção do timeia): o componente recebe o client já
 * construído via prop — nunca importa `lib/apiClient`/`lib/authClient`
 * direto (a página, `configuracoes/index.vue`, é quem chama `useSettings()`).
 */
const props = defineProps<{ settingsApi: SettingsClient }>()
const toast = useToast()

const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const saveError = ref('')

const form = reactive({
  name: '',
  tax_pct: '',
  min_margin_pct: '',
  abc_cut_a: '',
  abc_cut_b: '',
  group_up_pct: '',
  group_down_pct: ''
})

function fillForm(c: Company) {
  form.name = c.name
  form.tax_pct = String(c.tax_pct)
  form.min_margin_pct = String(c.min_margin_pct)
  form.abc_cut_a = String(c.abc_cut_a)
  form.abc_cut_b = String(c.abc_cut_b)
  form.group_up_pct = String(c.group_up_pct)
  form.group_down_pct = String(c.group_down_pct)
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const { company } = await props.settingsApi.getCompany()
    fillForm(company)
  } catch {
    loadError.value = 'Não foi possível carregar os dados da empresa agora. Tente de novo.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

/** Aceita "12,3" ou "12.3" — a API espera um número. */
function parseDecimal(value: string): number {
  return Number(value.replace(',', '.'))
}

async function submit() {
  saveError.value = ''
  saving.value = true
  try {
    const { company } = await props.settingsApi.updateCompany({
      name: form.name,
      tax_pct: parseDecimal(form.tax_pct),
      min_margin_pct: parseDecimal(form.min_margin_pct),
      abc_cut_a: parseDecimal(form.abc_cut_a),
      abc_cut_b: parseDecimal(form.abc_cut_b),
      group_up_pct: parseDecimal(form.group_up_pct),
      group_down_pct: parseDecimal(form.group_down_pct)
    })
    fillForm(company)
    toast.success('Empresa atualizada.')
  } catch (err) {
    saveError.value = apiErrorMessage(err, 'Não foi possível salvar agora. Tente de novo.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div v-if="loading" role="status" class="text-[15px] text-ink-2">Carregando...</div>

    <div v-else-if="loadError" class="card p-6 text-center" role="alert">
      <p class="text-[15px] text-danger">{{ loadError }}</p>
      <button type="button" class="btn-link mt-3" @click="load">Tentar de novo</button>
    </div>

    <form v-else class="card space-y-5 p-6" @submit.prevent="submit">
      <p class="text-[15px] text-ink-2">
        Estes valores afetam o cálculo de lucro, margem e a Curva ABC dos seus anúncios.
      </p>

      <div class="space-y-1.5">
        <label for="empresa-nome" class="field-label">Nome</label>
        <input id="empresa-nome" v-model="form.name" type="text" required class="input" />
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="space-y-1.5">
          <label for="tax-pct" class="field-label">Imposto (%)</label>
          <input id="tax-pct" v-model="form.tax_pct" type="text" inputmode="decimal" class="input" />
        </div>
        <div class="space-y-1.5">
          <label for="min-margin-pct" class="field-label">Margem mínima (%)</label>
          <input id="min-margin-pct" v-model="form.min_margin_pct" type="text" inputmode="decimal" class="input" />
        </div>
        <div class="space-y-1.5">
          <label for="abc-cut-a" class="field-label">Corte curva A (%)</label>
          <input id="abc-cut-a" v-model="form.abc_cut_a" type="text" inputmode="decimal" class="input" />
        </div>
        <div class="space-y-1.5">
          <label for="abc-cut-b" class="field-label">Corte curva B (%)</label>
          <input id="abc-cut-b" v-model="form.abc_cut_b" type="text" inputmode="decimal" class="input" />
        </div>
        <div class="space-y-1.5">
          <label for="group-up-pct" class="field-label">Limite "Vendendo" (%)</label>
          <input id="group-up-pct" v-model="form.group_up_pct" type="text" inputmode="decimal" class="input" />
        </div>
        <div class="space-y-1.5">
          <label for="group-down-pct" class="field-label">Limite "Em queda" (%)</label>
          <input id="group-down-pct" v-model="form.group_down_pct" type="text" inputmode="decimal" class="input" />
        </div>
      </div>

      <p v-if="saveError" role="alert" class="text-[15px] text-danger">{{ saveError }}</p>

      <button type="submit" :disabled="saving" class="btn-primary">{{ saving ? 'Salvando...' : 'Salvar' }}</button>
    </form>
  </div>
</template>
