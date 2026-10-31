<script setup lang="ts">
import { ref } from 'vue'
import { useToast } from '../../composables/useToast'
import { apiErrorMessage } from '../../lib/apiErrors'
import type { SettingsClient } from '../../lib/settingsClient'
import { useSessionStore } from '../../stores/session'
import type { Company } from '../../types/api'

/**
 * Aba Ads de Configurações: limite máximo de investimento diário em Product Ads (R$), informado pelo usuário. As
 * sugestões de estrutura de campanhas (Ads → Análise) nunca propõem passar dele: indicam o orçamento e o ROAS Objetivo
 * de cada campanha nova e, se preciso, a redução de orçamento de outra campanha. Salva por `PATCH /api/company`.
 */
const props = defineProps<{ settingsApi: SettingsClient }>()
const toast = useToast()
const session = useSessionStore()
const budgetMax = ref<string>(session.company?.ads_daily_budget_max != null ? String(session.company.ads_daily_budget_max).replace('.', ',') : '')
const saving = ref(false)

/** Vazio = sem limite informado. */
async function save() {
  if (saving.value) return
  const raw = budgetMax.value.replace(/\./g, '').replace(',', '.').trim()
  const value = raw === '' ? null : Number(raw)
  if (value !== null && (!Number.isFinite(value) || value < 0)) {
    toast.error('Informe um valor em reais, ou deixe em branco.')
    return
  }
  if (value === (session.company?.ads_daily_budget_max ?? null)) return
  saving.value = true
  try {
    const { company } = await props.settingsApi.updateCompany({ ads_daily_budget_max: value })
    session.setCompany(company as Company)
    toast.success(value === null ? 'Limite diário removido.' : `Limite diário de Ads salvo: R$ ${value.toFixed(2).replace('.', ',')}.`)
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível salvar agora. Tente de novo.'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-4" data-test="aba-ads-conteudo">
    <div>
      <h3 class="section-title">Limite máximo de investimento diário</h3>
      <p class="page-subtitle text-[13px]">
        Valor máximo em R$ a investir por dia em Product Ads: a soma dos orçamentos diários de todas as campanhas ativas.
        As sugestões de estrutura de campanhas (Ads → Análise) respeitam este teto: toda campanha nova vem com o orçamento
        diário e o ROAS Objetivo a preencher e, quando não cabe, a redução de orçamento de outra campanha para adequar.
      </p>
    </div>
    <div class="card flex flex-wrap items-end gap-3 p-4 text-[14px]">
      <label class="block">
        <span class="mb-1 block text-[12px] text-ink-3">Máximo por dia (R$)</span>
        <input v-model="budgetMax" type="text" inputmode="decimal" class="input w-40" placeholder="ex.: 500" :disabled="!session.isAdmin || saving" data-test="ads-limite-diario" @keydown.enter.prevent="save" />
      </label>
      <button type="button" class="btn-primary h-10" :disabled="!session.isAdmin || saving" data-test="ads-limite-salvar" @click="save">Salvar</button>
      <p class="basis-full text-[12px] text-ink-3">Em branco, as sugestões não aplicam teto e a tela de Análise avisa.</p>
    </div>
  </div>
</template>
