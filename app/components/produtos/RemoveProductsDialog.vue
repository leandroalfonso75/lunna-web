<script setup lang="ts">
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline'
import { nextTick, onMounted, ref } from 'vue'

/**
 * Popup da ação "Excluir" da seção Produtos. Com o ERP integrado pergunta se o cadastro fica no ERP:
 * "Sim" vem marcado e com o foco (Enter confirma mantendo no ERP); "Não" exclui também o cadastro no Olist.
 * Esc ou "Cancelar" fecham sem fazer nada.
 */
const props = defineProps<{ count: number; integrated: boolean; busy: boolean }>()
const emit = defineEmits<{ confirm: [keepInErp: boolean]; cancel: [] }>()

const keep = ref<'sim' | 'nao'>('sim')
const simInput = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  await nextTick()
  simInput.value?.focus()
})

function submit() {
  if (props.busy) return
  emit('confirm', !props.integrated || keep.value === 'sim')
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @keydown.esc="emit('cancel')" @click.self="emit('cancel')">
    <form
      class="card w-full max-w-md space-y-4 p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="remover-titulo"
      data-test="remover-produtos-dialogo"
      @submit.prevent="submit"
    >
      <div>
        <h2 id="remover-titulo" class="text-[17px] font-semibold text-ink">Excluir {{ count }} {{ count === 1 ? 'produto' : 'produtos' }}</h2>
        <p class="mt-1 text-[13px] text-ink-2">
          {{ integrated ? 'Os produtos saem da lista do Lunna. Pretende manter o cadastro do produto no ERP (Olist)?' : 'Os produtos saem da lista do Lunna.' }}
        </p>
      </div>

      <fieldset v-if="integrated" class="space-y-2 text-[14px]">
        <legend class="sr-only">Manter o cadastro no ERP?</legend>
        <label class="flex cursor-pointer items-start gap-2 rounded-card border border-line p-2" :class="keep === 'sim' ? 'border-primary bg-primary-soft' : ''">
          <input ref="simInput" v-model="keep" type="radio" name="manter-erp" value="sim" class="mt-1" data-test="manter-erp-sim" />
          <span><strong>Sim</strong>, manter o cadastro no ERP <span class="block text-[12px] text-ink-3">Só some do Lunna; no Olist nada muda.</span></span>
        </label>
        <label class="flex cursor-pointer items-start gap-2 rounded-card border border-line p-2" :class="keep === 'nao' ? 'border-danger bg-danger-soft' : ''">
          <input v-model="keep" type="radio" name="manter-erp" value="nao" class="mt-1" data-test="manter-erp-nao" />
          <span>
            <strong>Não</strong>, excluir também do ERP
            <span class="mt-1 flex items-start gap-1 text-[12px] text-danger" data-test="nota-nao">
              <ExclamationTriangleIcon class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Ao clicar em Não será excluído automaticamente o cadastro do produto do seu ERP e todas suas informações.
            </span>
          </span>
        </label>
      </fieldset>

      <div class="flex justify-end gap-2">
        <button type="button" class="btn-secondary" :disabled="busy" @click="emit('cancel')">Cancelar</button>
        <button type="submit" :class="integrated && keep === 'nao' ? 'btn-danger' : 'btn-primary'" :disabled="busy" data-test="confirmar-remocao">
          {{ busy ? 'Excluindo…' : integrated && keep === 'nao' ? 'Excluir do Lunna e do ERP' : 'Excluir do Lunna' }}
        </button>
      </div>
    </form>
  </div>
</template>
