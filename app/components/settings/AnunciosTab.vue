<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast } from '../../composables/useToast'
import { apiErrorMessage } from '../../lib/apiErrors'
import type { SettingsClient } from '../../lib/settingsClient'
import { useSessionStore } from '../../stores/session'
import type { Company } from '../../types/api'

/**
 * Aba Anúncios de Configurações: base de cálculo do custo de Ads por unidade (gasto do anúncio ÷ unidades vendidas nos
 * últimos 7, 15 ou 30 dias fechados), usada nas colunas "Custo Ads" e "Lucro pós Ads" da seção Anúncios e na margem pós
 * Ads das Promoções. Salva na hora por `PATCH /api/company`.
 */
const props = defineProps<{ settingsApi: SettingsClient }>()
const toast = useToast()
const session = useSessionStore()
const saving = ref(false)
const OPTIONS: { value: 7 | 15 | 30; label: string }[] = [
  { value: 7, label: 'Últimos 7 dias' }, { value: 15, label: 'Últimos 15 dias' }, { value: 30, label: 'Últimos 30 dias' }
]
const current = computed(() => session.company?.ads_cost_days ?? 15)

async function save(days: 7 | 15 | 30) {
  if (saving.value || days === current.value) return
  saving.value = true
  try {
    const { company } = await props.settingsApi.updateCompany({ ads_cost_days: days })
    session.setCompany(company as Company)
    toast.success(`Custo de Ads passa a usar os últimos ${days} dias.`)
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível salvar agora. Tente de novo.'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-4" data-test="aba-anuncios-conteudo">
    <div>
      <h3 class="section-title">Custo de Ads por anúncio</h3>
      <p class="page-subtitle text-[13px]">
        Base de cálculo do custo de Ads por unidade: o gasto do anúncio em Product Ads dividido pelas unidades que ele vendeu no mesmo período
        (só dias fechados). Vale para as colunas "Custo Ads" e "Lucro pós Ads" de Anúncios e para a margem pós Ads das Promoções.
      </p>
    </div>
    <fieldset class="card space-y-2 p-4 text-[14px]" :disabled="!session.isAdmin || saving">
      <legend class="sr-only">Período do custo de Ads</legend>
      <label v-for="o in OPTIONS" :key="o.value" class="flex items-center gap-2">
        <input type="radio" name="ads-cost-days" :value="o.value" :checked="current === o.value" :data-test="`ads-dias-${o.value}`" @change="save(o.value)" />
        <span>{{ o.label }}</span>
        <span v-if="current === o.value" class="text-[12px] text-ink-3">(em uso)</span>
      </label>
      <p class="text-[12px] text-ink-3">Anúncio sem gasto no período, ou com gasto e nenhuma venda, fica com custo de Ads zero por unidade.</p>
    </fieldset>
  </div>
</template>
