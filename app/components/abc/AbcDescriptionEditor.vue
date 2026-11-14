<script setup lang="ts">
import { DocumentTextIcon, SparklesIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { computed, onMounted, ref } from 'vue'
import { useToast } from '../../composables/useToast'
import { apiErrorMessage } from '../../lib/apiErrors'
import { useSessionStore } from '../../stores/session'

/**
 * Curva ABC > "Alterar descrição AGORA" (pedido do usuário em 14/11/2026): mostra a descrição atual, "Sugerir descrição"
 * (a IA reescreve de forma mais chamativa, com as dúvidas dos compradores) e "Publicar" (muda no Mercado Livre na hora,
 * com confirmação; só admin). Texto puro: o Mercado Livre não aceita HTML, links, e-mail nem telefone.
 */
const props = defineProps<{ itemId: string; variations?: number }>()
const emit = defineEmits<{ close: []; changed: [] }>()

interface Info { title: string; current: string; length: number; max_length: number; questions: string[]; editable: boolean; reason?: string }

const { $api } = useNuxtApp()
const session = useSessionStore()
const toast = useToast()
const query = () => ({ account_id: session.selectedAccountId })

const loading = ref(true)
const info = ref<Info | null>(null)
const text = ref('')
const highlights = ref<string[]>([])
const suggesting = ref(false)
const confirming = ref(false)
const publishing = ref(false)
const allVariations = ref(false)

const length = computed(() => text.value.trim().length)
const canPublish = computed(() => !!info.value?.editable && session.isAdmin && length.value >= 50 && text.value.trim() !== info.value?.current.trim())

onMounted(async () => {
  try {
    info.value = await $api<Info>(`/api/items/${props.itemId}/description`, { query: query() })
    text.value = info.value.current
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível ler o anúncio no Mercado Livre.'))
  } finally {
    loading.value = false
  }
})

async function suggest() {
  suggesting.value = true
  try {
    const res = await $api<{ text: string; highlights: string[] }>(`/api/items/${props.itemId}/description/suggest`, { method: 'POST', query: query() })
    text.value = res.text
    highlights.value = res.highlights
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível sugerir uma descrição agora.'))
  } finally {
    suggesting.value = false
  }
}

async function publish() {
  publishing.value = true
  try {
    const res = await $api<{ message: string; variations?: { ok: boolean }[] | null }>(`/api/items/${props.itemId}/description`, {
      method: 'POST', query: query(), body: { text: text.value.trim(), confirm: true, apply_to_variations: allVariations.value }
    })
    if (res.variations?.some((v) => !v.ok)) toast.error(res.message)
    else toast.success(res.message)
    emit('changed')
    emit('close')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'O Mercado Livre não aceitou a nova descrição.'))
  } finally {
    publishing.value = false
    confirming.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" data-test="alterar-descricao" @click.self="emit('close')">
    <div class="card my-6 w-full max-w-3xl space-y-4 p-5 text-[13px]">
      <header class="flex items-start gap-3">
        <DocumentTextIcon class="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="text-[17px] font-semibold text-ink">Alterar descrição</p>
          <p class="text-ink-3">{{ itemId }}<template v-if="info"> · {{ info.title }}</template></p>
        </div>
        <button type="button" class="btn-link" aria-label="Fechar" @click="emit('close')"><XMarkIcon class="h-5 w-5" /></button>
      </header>

      <p v-if="loading" class="text-ink-3">Lendo o anúncio no Mercado Livre…</p>

      <template v-else-if="info">
        <p v-if="!info.editable" class="rounded-card border border-warning bg-warning-soft p-3 text-ink" data-test="descricao-bloqueada">{{ info.reason }}</p>

        <template v-else>
          <div class="flex flex-wrap items-center gap-2">
            <p class="flex-1 text-[12px] text-ink-2">
              Hoje a descrição tem {{ info.length }} caracteres. A sugestão abre com o principal benefício, lista os diferenciais,
              explica o uso e responde às dúvidas dos compradores<template v-if="info.questions.length"> ({{ info.questions.length }} perguntas deste anúncio)</template>.
            </p>
            <button type="button" class="btn-secondary h-9" :disabled="suggesting" data-test="descricao-sugerir" @click="suggest">
              <SparklesIcon class="h-4 w-4" aria-hidden="true" /> {{ suggesting ? 'Escrevendo…' : 'Sugerir descrição' }}
            </button>
          </div>

          <ul v-if="highlights.length" class="list-disc space-y-0.5 pl-5 text-[12px] text-ink-2" data-test="descricao-melhorias">
            <li v-for="h in highlights" :key="h">{{ h }}</li>
          </ul>

          <label class="block">
            <span class="mb-1 block font-semibold text-ink">Descrição (texto puro)</span>
            <textarea v-model="text" rows="16" class="input w-full font-sans leading-relaxed" data-test="descricao-texto" />
            <span class="mt-1 block text-[12px] text-ink-3" data-numeric>{{ length }} caracteres · sem HTML, links, e-mail ou telefone</span>
          </label>

          <footer class="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <label v-if="variations && session.isAdmin" class="inline-flex w-full items-start gap-2 text-[12px] text-ink-2" data-test="descricao-todas-variacoes">
              <input v-model="allVariations" type="checkbox" class="mt-0.5">
              <span>Aplicar também às outras {{ variations }} variações deste anúncio</span>
            </label>
            <template v-if="!confirming">
              <button type="button" class="btn-primary h-9" :disabled="!canPublish" data-test="descricao-publicar" @click="confirming = true">Publicar descrição</button>
              <span v-if="!session.isAdmin" class="text-[12px] text-ink-3">Só administradores publicam no Mercado Livre.</span>
            </template>
            <template v-else>
              <span class="text-ink">A descrição muda no Mercado Livre agora{{ allVariations && variations ? `, neste anúncio e nas outras ${variations} variações` : '' }}. Confirmar?</span>
              <button type="button" class="btn-primary h-9" :disabled="publishing" data-test="descricao-confirmar" @click="publish">{{ publishing ? 'Publicando…' : 'Sim, publicar' }}</button>
              <button type="button" class="btn-secondary h-9" :disabled="publishing" @click="confirming = false">Cancelar</button>
            </template>
          </footer>
        </template>
      </template>
    </div>
  </div>
</template>
