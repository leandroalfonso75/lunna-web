<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import type { PromotionAutomation } from '../../types/promotions'

/**
 * Regras da automação de Promoções (rotina das 03:00 e lote), logo abaixo dos cards: permitir reduzir a margem ao
 * buscar a mínima (com tolerância em pontos percentuais) e incluir anúncios de catálogo. Só administradores mudam.
 */
const props = defineProps<{ automation: PromotionAutomation; isAdmin: boolean; saving: boolean }>()
const emit = defineEmits<{ save: [patch: Partial<PromotionAutomation>] }>()

const form = reactive({ allowDrop: false, tolerance: '' as string | number, includeCatalog: false })
const error = ref('')
watch(() => props.automation, (a) => {
  form.allowDrop = a.allow_margin_drop
  form.tolerance = a.margin_drop_tolerance === null ? '' : String(a.margin_drop_tolerance)
  form.includeCatalog = a.include_catalog
}, { immediate: true })

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
</script>

<template>
  <div class="card grid grid-cols-1 gap-4 p-4 text-[13px] md:grid-cols-2" data-test="automacao">
    <div>
      <label class="flex items-start gap-2">
        <input v-model="form.allowDrop" type="checkbox" class="mt-0.5" :disabled="!isAdmin || saving" data-test="permitir-reducao" @change="!form.allowDrop && saveDrop()" />
        <span>
          <span class="font-semibold text-ink">Permitir reduzir o preço mesmo com redução da margem</span>
          <span class="block text-[12px] text-ink-3">
            A automação busca a margem mais perto da mínima, mas, sem esta opção, não troca de oferta quando isso reduz o lucro por unidade.
          </span>
        </span>
      </label>
      <div v-if="form.allowDrop" class="mt-2 flex flex-wrap items-end gap-2 pl-6">
        <label class="block">
          <span class="block text-[11px] text-ink-3">Redução máxima da margem (pontos percentuais)</span>
          <input v-model="form.tolerance" type="number" step="0.1" min="0" class="input h-8 w-[120px] text-[12px]" :disabled="!isAdmin || saving" placeholder="ex.: 3" data-test="tolerancia" />
        </label>
        <button v-if="isAdmin" type="button" class="btn-primary h-8 px-3 text-[12px]" :disabled="saving" @click="saveDrop">Salvar</button>
        <p class="w-full text-[11px] text-ink-3">Ex.: com 3, uma margem de 20% pode ir até 17% (sem passar da mínima).</p>
        <p v-if="error" class="w-full text-[11px] text-danger" role="alert">{{ error }}</p>
      </div>
    </div>
    <div>
      <label class="flex items-start gap-2">
        <input v-model="form.includeCatalog" type="checkbox" class="mt-0.5" :disabled="!isAdmin || saving" data-test="incluir-catalogo" @change="emit('save', { include_catalog: form.includeCatalog })" />
        <span>
          <span class="font-semibold text-ink">Incluir anúncios de catálogo na automatização</span>
          <span class="block text-[12px] text-ink-3">
            Será verificado uma hora depois de eventual alteração se o anúncio está "ganhando" o catálogo. Caso não esteja ganhando, será retornado ao
            preço anterior e será realizada uma nova verificação após uma hora. Permanecendo sem ganhar o catálogo, será enviada uma notificação para
            análise manual.
          </span>
        </span>
      </label>
    </div>
  </div>
</template>
