<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast } from '../../composables/useToast'
import { apiErrorMessage } from '../../lib/apiErrors'
import type { SettingsClient } from '../../lib/settingsClient'
import { useSessionStore } from '../../stores/session'
import type { Company, CompanyUpdatePayload } from '../../types/api'
import type { PromotionAutomation } from '../../types/promotions'
import PromotionAutomationCard from '../promocoes/PromotionAutomationCard.vue'

/**
 * Aba Promoções de Configurações: as regras da automação da seção Promoções (rotina, horário e dias, base da margem,
 * alvo do preço, aumento, redução, relâmpago e catálogo). Os valores vêm da empresa da sessão e cada mudança é salva
 * na hora por `PATCH /api/company`.
 */
const props = defineProps<{ settingsApi: SettingsClient }>()
const toast = useToast()
const session = useSessionStore()
const saving = ref(false)

const automation = computed<PromotionAutomation | null>(() => {
  const c = session.company
  if (!c) return null
  return {
    routine_enabled: c.promo_routine_enabled ?? false,
    routine_mode: c.promo_routine_mode ?? 'simulation',
    schedule_hour: c.promo_schedule_hour ?? 3,
    schedule_days: c.promo_schedule_days ?? [0, 1, 2, 3, 4, 5, 6],
    margin_basis: c.promo_margin_basis ?? 'after_ads',
    price_target: c.promo_price_target ?? 'min',
    allow_price_increase: c.promo_allow_price_increase ?? false,
    allow_margin_drop: c.promo_allow_margin_drop ?? false,
    margin_drop_tolerance: c.promo_margin_drop_tolerance ?? null,
    allow_lightning: c.promo_allow_lightning ?? false,
    include_catalog: c.promo_include_catalog ?? false
  }
})

const KEYS: Record<keyof PromotionAutomation, keyof CompanyUpdatePayload> = {
  routine_enabled: 'promo_routine_enabled', routine_mode: 'promo_routine_mode', schedule_hour: 'promo_schedule_hour',
  schedule_days: 'promo_schedule_days', margin_basis: 'promo_margin_basis', price_target: 'promo_price_target',
  allow_price_increase: 'promo_allow_price_increase', allow_margin_drop: 'promo_allow_margin_drop',
  margin_drop_tolerance: 'promo_margin_drop_tolerance', allow_lightning: 'promo_allow_lightning', include_catalog: 'promo_include_catalog'
}

async function save(patch: Partial<PromotionAutomation>) {
  if (saving.value) return
  saving.value = true
  try {
    const payload: CompanyUpdatePayload = {}
    for (const [k, v] of Object.entries(patch)) (payload as Record<string, unknown>)[KEYS[k as keyof PromotionAutomation]] = v
    const { company } = await props.settingsApi.updateCompany(payload)
    session.setCompany(company as Company)
    toast.success('Promoções: regra salva.')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível salvar agora. Tente de novo.'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-4" data-test="aba-promocoes-conteudo">
    <div>
      <h3 class="section-title">Automação das promoções</h3>
      <p class="page-subtitle text-[13px]">
        Regras que a seção Promoções usa na rotina automática e no lote. Cada mudança é salva na hora.
        <NuxtLink to="/promocoes" class="btn-link">Ir para Promoções</NuxtLink>
      </p>
    </div>
    <PromotionAutomationCard v-if="automation" :automation="automation" :is-admin="session.isAdmin" :saving="saving" @save="save" />
  </div>
</template>
