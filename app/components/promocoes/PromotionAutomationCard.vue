<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { PromotionAutomation } from '../../types/promotions'

/**
 * Regras da automação de Promoções, logo abaixo dos cards: a rotina automática (liga/desliga, modo, horário e dias da
 * semana), qual lucro vale para a margem (antes ou pós Ads), o alvo do preço (mínima ou máxima), se pode subir o preço
 * final, se pode reduzir a margem (com tolerância), a oferta relâmpago e os anúncios de catálogo. Só administradores
 * mudam; cada mudança é salva na hora.
 */
const props = defineProps<{ automation: PromotionAutomation; isAdmin: boolean; saving: boolean }>()
const emit = defineEmits<{ save: [patch: Partial<PromotionAutomation>] }>()

const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: h, label: `${String(h).padStart(2, '0')}:00` }))
/** Dias da semana como a API guarda (0 = domingo … 6 = sábado), na ordem da tela: segunda a domingo. */
const DAYS = [
  { value: 1, label: 'Segunda-feira' }, { value: 2, label: 'Terça-feira' }, { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' }, { value: 5, label: 'Sexta-feira' }, { value: 6, label: 'Sábado' }, { value: 0, label: 'Domingo' }
]

const form = reactive({
  enabled: false, mode: 'simulation' as 'simulation' | 'apply', hour: 3, days: [] as number[],
  basis: 'after_ads' as 'after_ads' | 'before_ads', target: 'min' as 'min' | 'max', allowIncrease: false,
  allowDrop: false, tolerance: '' as string | number, allowLightning: false, includeCatalog: false
})
const error = ref('')
watch(() => props.automation, (a) => {
  form.enabled = a.routine_enabled
  form.mode = a.routine_mode
  form.hour = a.schedule_hour
  form.days = [...a.schedule_days]
  form.basis = a.margin_basis
  form.target = a.price_target
  form.allowIncrease = a.allow_price_increase
  form.allowDrop = a.allow_margin_drop
  form.tolerance = a.margin_drop_tolerance === null ? '' : String(a.margin_drop_tolerance)
  form.allowLightning = a.allow_lightning
  form.includeCatalog = a.include_catalog
}, { immediate: true })

const locked = computed(() => !props.isAdmin || props.saving)
const everyDay = computed(() => form.days.length === 7)

function toggleEveryDay(on: boolean) {
  form.days = on ? DAYS.map((d) => d.value) : []
  emit('save', { schedule_days: [...form.days] })
}
function toggleDay(day: number, on: boolean) {
  form.days = on ? [...new Set([...form.days, day])] : form.days.filter((d) => d !== day)
  emit('save', { schedule_days: [...form.days] })
}

function saveDrop() {
  error.value = ''
  if (!form.allowDrop) return emit('save', { allow_margin_drop: false })
  const tol = Number(String(form.tolerance).replace(',', '.'))
  if (!(tol > 0) || tol > 50) {
    error.value = 'Informe a tolerância em pontos percentuais (entre 0,1 e 50).'
    return
  }
  emit('save', { allow_margin_drop: true, margin_drop_tolerance: tol })
}

const scheduleText = computed(() => {
  const hour = HOURS[form.hour]?.label ?? '--:--'
  if (!form.days.length) return 'nenhum dia escolhido: a rotina não roda'
  const days = everyDay.value ? 'todos os dias' : DAYS.filter((d) => form.days.includes(d.value)).map((d) => d.label.replace('-feira', '')).join(', ')
  return `${days}, às ${hour}`
})
</script>

<template>
  <div class="card automation space-y-5 p-5 text-[13px]" data-test="automacao">
    <div class="automation-top">
      <!-- rotina automática -->
      <section class="space-y-3 rounded-card bg-surface-2/50 p-4" data-test="rotina">
        <div class="flex flex-wrap items-center gap-3">
          <label class="switch" :class="locked ? 'opacity-60' : ''">
            <input v-model="form.enabled" type="checkbox" class="sr-only" :disabled="locked" data-test="rotina-ligar" @change="emit('save', { routine_enabled: form.enabled })" />
            <span class="switch-track" aria-hidden="true"><span class="switch-thumb" /></span>
            <span class="font-semibold text-ink">Rotina automática {{ form.enabled ? 'ligada' : 'desligada' }}</span>
          </label>
          <div class="flex items-center gap-1 rounded-full bg-surface p-0.5 text-[12px]" role="radiogroup" aria-label="Modo da rotina">
            <button type="button" role="radio" :aria-checked="form.mode === 'simulation'" class="rounded-full px-3 py-1 transition-colors" :disabled="locked"
              :class="form.mode === 'simulation' ? 'bg-primary-soft font-semibold text-primary' : 'text-ink-2'" @click="form.mode = 'simulation'; emit('save', { routine_mode: 'simulation' })">
              Simulação
            </button>
            <button type="button" role="radio" :aria-checked="form.mode === 'apply'" class="rounded-full px-3 py-1 transition-colors" :disabled="locked" data-test="modo-aplicar"
              :class="form.mode === 'apply' ? 'bg-primary-soft font-semibold text-primary' : 'text-ink-2'" @click="form.mode = 'apply'; emit('save', { routine_mode: 'apply' })">
              Aplicação real
            </button>
          </div>
        </div>
        <p class="text-[12px] text-ink-3">
          A rotina relê a Central do Mercado Livre e só faz duas coisas: entra numa promoção se o anúncio ficou sem nenhuma, e troca quando surge uma campanha
          do Mercado Livre mais atraente que a atual. Em simulação, só registra o que faria.
        </p>
        <div class="flex flex-wrap items-end gap-x-4 gap-y-2">
          <label class="block">
            <span class="block text-[11px] text-ink-3">Horário</span>
            <select v-model.number="form.hour" class="input h-8 w-[100px] text-[12px]" :disabled="locked" data-test="rotina-hora" @change="emit('save', { schedule_hour: form.hour })">
              <option v-for="h in HOURS" :key="h.value" :value="h.value">{{ h.label }}</option>
            </select>
          </label>
          <fieldset class="min-w-0 flex-1">
            <legend class="text-[11px] text-ink-3">Dias</legend>
            <div class="flex flex-wrap gap-x-3 gap-y-1">
              <label class="flex items-center gap-1.5 font-medium text-ink">
                <input type="checkbox" :checked="everyDay" :disabled="locked" data-test="rotina-todos-dias" @change="toggleEveryDay(($event.target as HTMLInputElement).checked)" />
                Todos os dias
              </label>
              <label v-for="d in DAYS" :key="d.value" class="flex items-center gap-1.5 text-ink-2">
                <input type="checkbox" :checked="form.days.includes(d.value)" :disabled="locked" @change="toggleDay(d.value, ($event.target as HTMLInputElement).checked)" />
                {{ d.label }}
              </label>
            </div>
          </fieldset>
        </div>
        <p class="text-[11px] text-ink-3">Roda {{ scheduleText }} (horário de Brasília); o computador ou o servidor precisa estar ligado nessa hora.</p>
      </section>

      <!-- regras de margem e preço -->
      <section class="space-y-3" data-test="regras">
        <fieldset>
          <legend class="font-semibold text-ink">Margem mínima e máxima calculadas sobre</legend>
          <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <label class="flex items-center gap-1.5"><input v-model="form.basis" type="radio" value="after_ads" :disabled="locked" data-test="base-pos-ads" @change="emit('save', { margin_basis: 'after_ads' })" /> Lucro pós Ads</label>
            <label class="flex items-center gap-1.5"><input v-model="form.basis" type="radio" value="before_ads" :disabled="locked" @change="emit('save', { margin_basis: 'before_ads' })" /> Lucro antes do Ads</label>
          </div>
          <p class="text-[12px] text-ink-3">Os dois lucros aparecem na lista; esta escolha define qual vale para os limites.</p>
        </fieldset>
        <fieldset>
          <legend class="font-semibold text-ink">O preço final da promoção deve ficar mais perto da</legend>
          <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <label class="flex items-center gap-1.5"><input v-model="form.target" type="radio" value="min" :disabled="locked" data-test="alvo-minima" @change="emit('save', { price_target: 'min' })" /> Margem mínima</label>
            <label class="flex items-center gap-1.5"><input v-model="form.target" type="radio" value="max" :disabled="locked" @change="emit('save', { price_target: 'max' })" /> Margem máxima</label>
          </div>
          <p class="text-[12px] text-ink-3">A outra margem continua valendo como barreira.</p>
        </fieldset>
        <label class="flex items-start gap-2">
          <input v-model="form.allowIncrease" type="checkbox" class="mt-0.5" :disabled="locked" data-test="permitir-aumento" @change="emit('save', { allow_price_increase: form.allowIncrease })" />
          <span>
            <span class="font-semibold text-ink">Permitir o aumento do preço para adesão de nova promoção, desde que respeitada a margem máxima</span>
            <span class="block text-[12px] text-ink-3">Se não permitir, o Lunna não irá aumentar o valor do preço final enquanto a promoção atual não finalizar.</span>
          </span>
        </label>
      </section>
    </div>

    <div class="automation-bottom border-t border-line pt-5">
      <div>
        <label class="flex items-start gap-2">
          <input v-model="form.allowDrop" type="checkbox" class="mt-0.5" :disabled="locked" data-test="permitir-reducao" @change="!form.allowDrop && saveDrop()" />
          <span>
            <span class="font-semibold text-ink">Permitir reduzir o preço mesmo com redução da margem</span>
            <span class="block text-[12px] text-ink-3">Sem esta opção, a automação não troca de oferta quando isso reduz o lucro por unidade.</span>
          </span>
        </label>
        <div v-if="form.allowDrop" class="mt-2 flex flex-wrap items-end gap-2 pl-6">
          <label class="block">
            <span class="block text-[11px] text-ink-3">Redução máxima da margem (pontos percentuais)</span>
            <input v-model="form.tolerance" type="number" step="0.1" min="0" class="input h-8 w-[120px] text-[12px]" :disabled="locked" placeholder="ex.: 3" data-test="tolerancia" />
          </label>
          <button v-if="isAdmin" type="button" class="btn-primary h-8 px-3 text-[12px]" :disabled="saving" @click="saveDrop">Salvar</button>
          <p class="w-full text-[11px] text-ink-3">Ex.: com 3, uma margem de 20% pode ir até 17% (sem passar da mínima).</p>
          <p v-if="error" class="w-full text-[11px] text-danger" role="alert">{{ error }}</p>
        </div>
      </div>
      <label class="flex items-start gap-2">
        <input v-model="form.allowLightning" type="checkbox" class="mt-0.5" :disabled="locked" data-test="autorizar-relampago" @change="emit('save', { allow_lightning: form.allowLightning })" />
        <span>
          <span class="font-semibold text-ink">Autorizar a adesão de Oferta Relâmpago (se respeitados os limites de margens)</span>
          <span class="block text-[12px] text-ink-3">Sem a autorização, a oferta relâmpago não entra automaticamente; só pela tela.</span>
        </span>
      </label>
      <label class="flex items-start gap-2">
        <input v-model="form.includeCatalog" type="checkbox" class="mt-0.5" :disabled="locked" data-test="incluir-catalogo" @change="emit('save', { include_catalog: form.includeCatalog })" />
        <span>
          <span class="font-semibold text-ink">Incluir anúncios de catálogo na automatização</span>
          <span class="block text-[12px] text-ink-3">
            Se incluir, será verificado uma hora depois de eventual alteração se o anúncio está "ganhando" o catálogo. Caso não esteja ganhando, será retornado
            ao preço anterior e será realizada uma nova verificação após uma hora. Permanecendo sem ganhar o catálogo, será enviada uma notificação para
            análise manual.
          </span>
        </span>
      </label>
    </div>
  </div>
</template>

<style scoped>
/* As colunas dependem da largura do próprio card (container query), não da janela: em coluna estreita, tudo empilha. */
.automation {
  container-type: inline-size;
}
.automation-top,
.automation-bottom {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.25rem;
}
@container (min-width: 820px) {
  .automation-top {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    gap: 2rem;
  }
}
@container (min-width: 1000px) {
  .automation-bottom {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 2rem;
  }
}
@container (min-width: 620px) and (max-width: 999.9px) {
  .automation-bottom {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* Liga/desliga: arrasta para a direita = ligado (azul forte); esquerda = desligado (claro). */
.switch {
  @apply inline-flex cursor-pointer select-none items-center gap-2;
}
.switch-track {
  @apply relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors duration-200;
  background: color-mix(in srgb, var(--ink-3) 35%, var(--surface));
}
.switch-thumb {
  @apply absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200;
}
.switch input:checked + .switch-track {
  background: var(--primary);
}
.switch input:checked + .switch-track .switch-thumb {
  transform: translateX(1.25rem);
}
.switch input:focus-visible + .switch-track {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 35%, transparent);
}
</style>
