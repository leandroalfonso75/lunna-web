<script setup lang="ts">
import { ClipboardDocumentIcon, ClockIcon } from '@heroicons/vue/24/outline'
import { computed, ref, watch } from 'vue'
import { dateShort } from '../../lib/format'
import type { ContestClaim, ContestStatus } from '../../types/claims'

/**
 * Cartão do assistente de contestação: grupo e força do argumento, prazo dos 60 dias, provas reunidas dos dados do
 * ML e o texto sugerido (editável) para o vendedor colar na contestação no Mercado Livre. O Lunna não envia nada:
 * só guarda o andamento (pendente/contestada/aceita/negada) e o texto usado.
 */
const props = defineProps<{ claim: ContestClaim; canEdit: boolean; saving: boolean }>()
const emit = defineEmits<{ save: [claimId: number, status: ContestStatus, text: string] }>()

const saved = () => props.claim.contest.text || props.claim.draft
const text = ref(saved())
const status = ref<ContestStatus>(props.claim.contest.status)
watch(() => props.claim.contest, (c) => { status.value = c.status })
const edited = computed(() => text.value !== saved())
const copied = ref(false)

const STATUS_LABEL: Record<ContestStatus, string> = {
  pendente: 'Pendente', contestada: 'Contestada (aguardando o ML)', aceita: 'Aceita pelo ML', negada: 'Negada pelo ML'
}
const STRENGTH: Record<string, string> = { alta: 'pill-success', média: 'pill-warning', baixa: 'pill-neutral' }
const urgency = computed(() => {
  if (props.claim.days_left <= 3) return 'border-danger bg-danger-soft text-danger'
  if (props.claim.days_left <= 7) return 'border-warning bg-warning-soft text-warning'
  return 'border-line bg-surface-2 text-ink-2'
})
const daysText = computed(() => {
  const d = props.claim.days_left
  if (d <= 0) return 'último dia para contestar'
  return `${d} dia${d === 1 ? '' : 's'} para contestar`
})

async function copy() {
  try {
    await navigator.clipboard.writeText(text.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    copied.value = false
  }
}
function restore() { text.value = props.claim.draft }
function save(next?: ContestStatus) {
  if (next) status.value = next
  emit('save', props.claim.claim_id, status.value, text.value)
}
</script>

<template>
  <article class="card overflow-hidden" data-test="contestar-cartao">
    <header class="flex flex-wrap items-start gap-3 border-b border-line p-3">
      <div class="min-w-0 flex-1">
        <p class="flex flex-wrap items-center gap-2">
          <span class="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold uppercase text-white" data-test="contestar-grupo">{{ claim.group_label }}</span>
          <span class="pill" :class="STRENGTH[claim.strength] ?? 'pill-neutral'">argumento {{ claim.strength }}</span>
          <span class="text-[12px] text-ink-3">#{{ claim.claim_id }} · aberta em {{ dateShort(claim.opened_at) }}</span>
          <span v-if="claim.contest.status !== 'pendente'" class="pill pill-neutral">{{ STATUS_LABEL[claim.contest.status] }}</span>
        </p>
        <p class="truncate text-[13px] text-ink" :title="claim.title ?? ''">{{ claim.title ?? 'Venda fora do Lunna' }}</p>
        <p class="text-[12px] text-ink-3">
          <template v-if="claim.order_id">Venda #{{ claim.order_id }} · </template>{{ claim.sku ?? 'sem SKU' }}<template v-if="claim.logistic"> · {{ claim.logistic }}</template> · motivo: {{ claim.reason }}
        </p>
      </div>
      <div class="rounded-card border px-3 py-1.5 text-right" :class="urgency" data-test="contestar-prazo">
        <p class="flex items-center justify-end gap-1 text-[13px] font-bold"><ClockIcon class="h-4 w-4" aria-hidden="true" />{{ daysText }}</p>
        <p class="text-[11px]">até {{ dateShort(claim.deadline) }}</p>
      </div>
    </header>

    <p v-if="claim.open_with_mediator" class="mx-3 mt-3 rounded-card bg-warning-soft p-2 text-[12px] text-warning">
      A mediação ainda está aberta. O Mercado Livre costuma analisar a contestação depois que ela termina; conteste quando encerrar, ainda dentro do prazo.
    </p>

    <div class="grid gap-3 p-3 md:grid-cols-2">
      <div class="text-[12px]">
        <p class="mb-1 font-semibold text-ink">Provas reunidas</p>
        <ul class="list-disc space-y-0.5 pl-4 text-ink-2" data-test="contestar-provas">
          <li v-for="(e, i) in claim.evidence" :key="i">{{ e }}</li>
        </ul>
      </div>
      <div class="space-y-2 text-[12px]">
        <p class="flex items-center gap-2 font-semibold text-ink">
          Texto sugerido <span class="font-normal text-ink-3">(revise antes de usar)</span>
          <button v-if="text !== claim.draft" type="button" class="btn-link ml-auto text-[11px]" @click="restore">Voltar ao sugerido</button>
        </p>
        <textarea v-model="text" rows="9" class="input w-full text-[12px]" data-test="contestar-texto" />
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn-secondary h-8" data-test="contestar-copiar" @click="copy">
            <ClipboardDocumentIcon class="h-4 w-4" aria-hidden="true" /> {{ copied ? 'Copiado!' : 'Copiar texto' }}
          </button>
          <a v-if="claim.link" :href="claim.link" target="_blank" rel="noopener" class="btn-link text-[12px]">Abrir a venda no Mercado Livre</a>
        </div>
      </div>
    </div>

    <footer class="flex flex-wrap items-center gap-2 border-t border-line p-3 text-[12px]">
      <template v-if="canEdit">
        <label class="flex items-center gap-2">
          <span class="text-ink-2">Andamento</span>
          <select v-model="status" class="input h-8 w-auto" :disabled="saving" data-test="contestar-status">
            <option v-for="(label, k) in STATUS_LABEL" :key="k" :value="k">{{ label }}</option>
          </select>
        </label>
        <button
          type="button"
          class="btn-primary h-8"
          :disabled="saving || (status === claim.contest.status && !edited)"
          data-test="contestar-salvar"
          @click="save()"
        >{{ saving ? 'Salvando…' : 'Salvar' }}</button>
        <button v-if="claim.contest.status === 'pendente'" type="button" class="btn-link" :disabled="saving" data-test="contestar-marcar" @click="save('contestada')">Marcar como contestada</button>
      </template>
      <span v-else class="text-ink-3">Só administradores registram o andamento.</span>
      <span v-if="claim.contest.contested_at" class="ml-auto text-ink-3">contestada em {{ dateShort(claim.contest.contested_at) }}<template v-if="claim.contest.user"> por {{ claim.contest.user }}</template></span>
      <span v-else class="ml-auto text-ink-3">O Lunna não envia a contestação: cole o texto no Mercado Livre e registre aqui.</span>
    </footer>
  </article>
</template>
