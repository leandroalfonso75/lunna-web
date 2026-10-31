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
const budgetMax = ref<string>(session.company?.ads_daily_budget_max != null ? String(session.company.ads_daily_budget_max) : '')
const savingBudget = ref(false)

/** Limite máximo de investimento diário (R$); vazio = não informado. */
async function saveBudget() {
  if (savingBudget.value) return
  const raw = budgetMax.value.replace(',', '.').trim()
  const value = raw === '' ? null : Number(raw)
  if (value !== null && (!Number.isFinite(value) || value < 0)) {
    toast.error('Informe um valor em reais, ou deixe em branco.')
    return
  }
  if (value === (session.company?.ads_daily_budget_max ?? null)) return
  savingBudget.value = true
  try {
    const { company } = await props.settingsApi.updateCompany({ ads_daily_budget_max: value })
    session.setCompany(company as Company)
    toast.success(value === null ? 'Limite diário removido.' : `Limite diário de Ads salvo: R$ ${value.toFixed(2).replace('.', ',')}.`)
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível salvar agora. Tente de novo.'))
  } finally {
    savingBudget.value = false
  }
}

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

    <div>
      <h3 class="section-title">Limite de investimento diário</h3>
      <p class="page-subtitle text-[13px]">
        Teto da soma dos orçamentos diários das campanhas de Product Ads. As sugestões de estrutura de campanhas (aba Análise de Ads)
        nunca propõem passar deste valor: o que não cabe só entra com realocação de verba.
      </p>
    </div>
    <div class="card flex flex-wrap items-end gap-3 p-4 text-[14px]">
      <label class="block">
        <span class="mb-1 block text-[12px] text-ink-3">Máximo por dia (R$)</span>
        <input v-model="budgetMax" type="text" inputmode="decimal" class="input w-40" placeholder="ex.: 500" :disabled="!session.isAdmin || savingBudget" data-test="ads-limite-diario" @keydown.enter.prevent="saveBudget" />
      </label>
      <button type="button" class="btn-primary h-10" :disabled="!session.isAdmin || savingBudget" data-test="ads-limite-salvar" @click="saveBudget">Salvar</button>
      <p class="basis-full text-[12px] text-ink-3">Em branco, as sugestões não aplicam teto e a tela avisa.</p>
    </div>
  </div>
</template>
