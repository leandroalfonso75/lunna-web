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

/**
 * ROAS Objetivo do Ads por conta do Mercado Livre (pedido do usuário em 10/11/2026): ligado, a Análise de Ads trata
 * como ação a família abaixo desse alvo (mesmo com lucro), nunca sugere baixar o ROAS Objetivo de campanha abaixo dele e
 * as campanhas novas sugeridas partem dele. Salvo por `PATCH /api/ml_accounts/:id`.
 */
const { $api } = useNuxtApp()
const roasEnabled = ref<boolean>(!!session.selectedAccount?.ads_roas_target_enabled)
const roasTarget = ref<string>(session.selectedAccount?.ads_roas_target != null ? String(session.selectedAccount.ads_roas_target).replace('.', ',') : '')
const savingRoas = ref(false)

async function saveRoas(enabled = roasEnabled.value) {
  const account = session.selectedAccount
  if (!account || savingRoas.value) return
  const raw = roasTarget.value.replace(',', '.').trim()
  const value = raw === '' ? null : Number(raw)
  if (enabled && (value === null || !Number.isFinite(value) || value < 1 || value > 100)) {
    toast.error('Informe um ROAS Objetivo entre 1 e 100 para ligar.')
    roasEnabled.value = !!account.ads_roas_target_enabled
    return
  }
  savingRoas.value = true
  try {
    const res = await $api<{ ml_account: typeof account }>(`/api/ml_accounts/${account.id}`, {
      method: 'PATCH', body: { ads_roas_target_enabled: enabled, ads_roas_target: value }
    })
    session.setAccounts(session.mlAccounts.map((a) => (a.id === account.id ? { ...a, ...res.ml_account } : a)))
    roasEnabled.value = !!res.ml_account.ads_roas_target_enabled
    toast.success(enabled ? `ROAS Objetivo ${String(value).replace('.', ',')} ligado para ${account.nickname}.` : `ROAS Objetivo desligado para ${account.nickname}.`)
  } catch (err) {
    roasEnabled.value = !!account.ads_roas_target_enabled
    toast.error(apiErrorMessage(err, 'Não foi possível salvar agora. Tente de novo.'))
  } finally {
    savingRoas.value = false
  }
}

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

    <div>
      <h3 class="section-title">ROAS Objetivo</h3>
      <p class="page-subtitle text-[13px]">
        Quanto você quer de venda para cada R$ 1 investido em Ads nesta conta ({{ session.selectedAccount?.nickname ?? '—' }}).
        Ligado, a Análise de Ads passa a mostrar como ação as campanhas abaixo desse alvo (mesmo dando lucro), não sugere
        baixar o ROAS Objetivo de nenhuma campanha abaixo dele e as campanhas novas sugeridas já partem dele.
        Ex.: 25 = gastar no máximo R$ 4 em Ads a cada R$ 100 vendidos.
      </p>
    </div>
    <div class="card flex flex-wrap items-end gap-4 p-4 text-[14px]" data-test="ads-roas-objetivo">
      <label class="flex items-center gap-2">
        <input
          v-model="roasEnabled" type="checkbox" class="h-4 w-4" :disabled="!session.isAdmin || savingRoas" data-test="ads-roas-ligar"
          @change="saveRoas(roasEnabled)"
        >
        <span class="font-medium text-ink">{{ roasEnabled ? 'Ligado' : 'Desligado' }}</span>
      </label>
      <label class="block">
        <span class="mb-1 block text-[12px] text-ink-3">ROAS Objetivo</span>
        <input v-model="roasTarget" type="text" inputmode="decimal" class="input w-28" placeholder="ex.: 25" :disabled="!session.isAdmin || savingRoas" data-test="ads-roas-valor" @keydown.enter.prevent="saveRoas()" />
      </label>
      <button type="button" class="btn-primary h-10" :disabled="!session.isAdmin || savingRoas" data-test="ads-roas-salvar" @click="saveRoas()">Salvar</button>
      <p v-if="roasTarget && Number(roasTarget.replace(',', '.')) > 0" class="basis-full text-[12px] text-ink-3">
        ROAS {{ roasTarget }} = no máximo R$ {{ (100 / Number(roasTarget.replace(',', '.'))).toFixed(2).replace('.', ',') }} em Ads a cada R$ 100 vendidos (ACOS {{ (100 / Number(roasTarget.replace(',', '.'))).toFixed(1).replace('.', ',') }}%).
      </p>
    </div>
  </div>
</template>
