<script setup lang="ts">
import { MagnifyingGlassIcon, SparklesIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { computed, onMounted, ref } from 'vue'
import { useToast } from '../../composables/useToast'
import { apiErrorMessage } from '../../lib/apiErrors'
import { useSessionStore } from '../../stores/session'

/**
 * Curva ABC > "Alterar modelo AGORA" (pedido do usuário em 14/11/2026): o campo Modelo da ficha técnica aceita até 110
 * caracteres no Mercado Livre e entra na busca. Ele recebe palavras-chave (as mais buscadas no ML e no Google) e o modelo
 * real do produto vai em "Modelo detalhado". "Sugerir palavras-chave" (IA, com as buscas da categoria) e "Publicar"
 * (muda no Mercado Livre na hora, com confirmação; só admin).
 */
const props = defineProps<{ itemId: string; variations?: number }>()
const emit = defineEmits<{ close: []; changed: [] }>()

interface Info {
  title: string; model: string | null; detailed_model: string | null; detailed_available: boolean; detailed_per_variation: boolean
  max_length: number; trends: string[]; editable: boolean; reason?: string
}
interface Option { model: string; why: string; length: number }

const { $api } = useNuxtApp()
const session = useSessionStore()
const toast = useToast()
const query = () => ({ account_id: session.selectedAccountId })

const loading = ref(true)
const info = ref<Info | null>(null)
const model = ref('')
const detailed = ref('')
const suggesting = ref(false)
const options = ref<Option[]>([])
const confirming = ref(false)
const publishing = ref(false)
const allVariations = ref(false)

const max = computed(() => info.value?.max_length ?? 110)
const tooLong = computed(() => model.value.trim().length > max.value)
const canPublish = computed(() => !!info.value?.editable && session.isAdmin && !!model.value.trim() && !tooLong.value
  && (model.value.trim() !== (info.value?.model ?? '') || detailed.value.trim() !== (info.value?.detailed_model ?? '')))

onMounted(async () => {
  try {
    info.value = await $api<Info>(`/api/items/${props.itemId}/model`, { query: query() })
    model.value = ''
    detailed.value = info.value.detailed_model ?? info.value.model ?? ''
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível ler o anúncio no Mercado Livre.'))
  } finally {
    loading.value = false
  }
})

async function suggest() {
  suggesting.value = true
  try {
    const res = await $api<{ options: Option[]; detailed_model: string | null }>(`/api/items/${props.itemId}/model/suggest`, { method: 'POST', query: query() })
    options.value = res.options
    if (res.detailed_model && !detailed.value.trim()) detailed.value = res.detailed_model
    if (!res.options.length) toast.error('A IA não devolveu sugestões. Tente de novo.')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível sugerir palavras-chave agora.'))
  } finally {
    suggesting.value = false
  }
}

async function publish() {
  publishing.value = true
  try {
    const res = await $api<{ message: string; variations?: { ok: boolean }[] | null }>(`/api/items/${props.itemId}/model`, {
      method: 'POST', query: query(),
      body: { model: model.value.trim(), detailed_model: detailed.value.trim(), confirm: true, apply_to_variations: allVariations.value }
    })
    if (res.variations?.some((v) => !v.ok)) toast.error(res.message)
    else toast.success(res.message)
    emit('changed')
    emit('close')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'O Mercado Livre não aceitou o novo Modelo.'))
  } finally {
    publishing.value = false
    confirming.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" data-test="alterar-modelo" @click.self="emit('close')">
    <div class="card my-6 w-full max-w-3xl space-y-4 p-5 text-[13px]">
      <header class="flex items-start gap-3">
        <MagnifyingGlassIcon class="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="text-[17px] font-semibold text-ink">Modelo com palavras-chave</p>
          <p class="text-ink-3">{{ itemId }}<template v-if="info"> · {{ info.title }}</template></p>
        </div>
        <button type="button" class="btn-link" aria-label="Fechar" @click="emit('close')"><XMarkIcon class="h-5 w-5" /></button>
      </header>

      <p v-if="loading" class="text-ink-3">Lendo o anúncio no Mercado Livre…</p>

      <template v-else-if="info">
        <div class="rounded-card bg-surface-2 p-3">
          <p class="text-[11px] font-medium uppercase tracking-wide text-ink-3">Hoje</p>
          <p class="text-ink" data-test="modelo-atual">Modelo: <span class="font-medium">{{ info.model || '(vazio)' }}</span></p>
          <p v-if="info.detailed_available" class="text-ink">Modelo detalhado: <span class="font-medium">{{ info.detailed_model || '(vazio)' }}</span></p>
        </div>

        <p class="text-[12px] text-ink-2">
          O Mercado Livre aceita até {{ max }} caracteres no campo Modelo e usa esse texto na busca. Em vez do código do produto,
          coloque as palavras que o comprador digita (de preferência as que não estão no título). O modelo de verdade vai em "Modelo detalhado".
        </p>

        <p v-if="!info.editable" class="rounded-card border border-warning bg-warning-soft p-3 text-ink" data-test="modelo-bloqueado">{{ info.reason }}</p>

        <template v-else>
          <div v-if="info.trends.length" data-test="modelo-buscas">
            <p class="mb-1 font-semibold text-ink">Mais buscadas na categoria (Mercado Livre)</p>
            <p class="flex flex-wrap gap-1">
              <span v-for="t in info.trends.slice(0, 20)" :key="t" class="rounded-full bg-surface-2 px-2 py-0.5 text-[12px] text-ink-2">{{ t }}</span>
            </p>
          </div>

          <div>
            <div class="flex flex-wrap items-end gap-2">
              <label class="min-w-0 flex-1">
                <span class="mb-1 block font-semibold text-ink">Novo Modelo (palavras-chave)</span>
                <input v-model="model" type="text" class="input w-full" :maxlength="max + 20" placeholder="Escreva ou aplique uma sugestão" data-test="modelo-novo">
              </label>
              <button type="button" class="btn-secondary h-9" :disabled="suggesting" data-test="modelo-sugerir" @click="suggest">
                <SparklesIcon class="h-4 w-4" aria-hidden="true" /> {{ suggesting ? 'Sugerindo…' : 'Sugerir palavras-chave' }}
              </button>
            </div>
            <p class="mt-1 text-[12px]" :class="tooLong ? 'text-danger' : 'text-ink-3'" data-numeric>{{ model.trim().length }}/{{ max }} caracteres</p>
          </div>

          <ul v-if="options.length" class="space-y-2" data-test="modelo-sugestoes">
            <li v-for="(o, i) in options" :key="i" class="flex items-start gap-3 rounded-card border border-line p-3">
              <div class="min-w-0 flex-1">
                <p class="font-medium text-ink">{{ o.model }}</p>
                <p class="text-[12px] text-ink-3">{{ o.length }} caracteres<template v-if="o.why"> · {{ o.why }}</template></p>
              </div>
              <button type="button" class="btn-secondary h-8 shrink-0 text-[12px]" data-test="modelo-aplicar" @click="model = o.model">Aplicar sugestão</button>
            </li>
          </ul>

          <label v-if="info.detailed_available" class="block">
            <span class="mb-1 block font-semibold text-ink">Modelo detalhado (o modelo real do produto)</span>
            <input v-model="detailed" type="text" class="input w-full" maxlength="255" placeholder="Ex.: SC-13" data-test="modelo-detalhado">
            <span v-if="info.detailed_per_variation" class="mt-1 block text-[12px] text-ink-3">Vai em todas as variações deste anúncio.</span>
          </label>
          <p v-else class="text-[12px] text-ink-3">Esta categoria não tem o campo "Modelo detalhado".</p>

          <footer class="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <label v-if="variations && session.isAdmin" class="inline-flex w-full items-start gap-2 text-[12px] text-ink-2" data-test="modelo-todas-variacoes">
              <input v-model="allVariations" type="checkbox" class="mt-0.5">
              <span>Aplicar também às outras {{ variations }} variações deste anúncio</span>
            </label>
            <template v-if="!confirming">
              <button type="button" class="btn-primary h-9" :disabled="!canPublish" data-test="modelo-publicar" @click="confirming = true">Publicar no Mercado Livre</button>
              <span v-if="!session.isAdmin" class="text-[12px] text-ink-3">Só administradores publicam no Mercado Livre.</span>
            </template>
            <template v-else>
              <span class="text-ink">O Modelo{{ detailed.trim() && info.detailed_available ? ' e o Modelo detalhado mudam' : ' muda' }} no Mercado Livre agora{{ allVariations && variations ? `, neste anúncio e nas outras ${variations} variações` : '' }}. Confirmar?</span>
              <button type="button" class="btn-primary h-9" :disabled="publishing" data-test="modelo-confirmar" @click="publish">{{ publishing ? 'Publicando…' : 'Sim, publicar' }}</button>
              <button type="button" class="btn-secondary h-9" :disabled="publishing" @click="confirming = false">Cancelar</button>
            </template>
          </footer>
        </template>
      </template>
    </div>
  </div>
</template>
