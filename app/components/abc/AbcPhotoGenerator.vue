<script setup lang="ts">
import { ArrowPathIcon, CheckCircleIcon, PhotoIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useToast } from '../../composables/useToast'
import { apiErrorMessage } from '../../lib/apiErrors'
import { useSessionStore } from '../../stores/session'

/**
 * Curva ABC > Fotos (pedido do usuário em 04/11/2026): gera fotos novas do anúncio pela OpenRouter, a partir das
 * fotos do próprio anúncio (e de anexos opcionais). O usuário aprova as que quer e publica no anúncio do Mercado
 * Livre (confirmação dupla: muda o anúncio na hora).
 */
const props = defineProps<{ itemId: string; title: string; suggestedCount: number }>()
const emit = defineEmits<{ close: [] }>()

interface Photo { id: number; kind: 'gerada' | 'referencia'; position: number; approved: boolean; ml_picture_id: string | null }
interface Job { id: number; status: 'gerando' | 'pronto' | 'erro' | 'publicado'; count: number; instructions: string | null; error: string | null; publish_error: string | null; published_at: string | null; created_at: string; photos: Photo[] }

const { $api } = useNuxtApp()
const session = useSessionStore()
const toast = useToast()

const loading = ref(true)
const pictures = ref<{ id: string; url: string }[]>([])
const aiConfigured = ref(true)
const job = ref<Job | null>(null)
const images = reactive<Record<number, string>>({})
const form = reactive({ count: Math.min(Math.max(props.suggestedCount, 1), 6), instructions: '', refs: [] as string[], uploads: [] as string[] })
const sending = ref(false)
const publishing = ref(false)
const confirmPublish = ref(false)
let poll: ReturnType<typeof setInterval> | undefined

const generated = computed(() => (job.value?.photos ?? []).filter((p) => p.kind === 'gerada'))
const approved = computed(() => generated.value.filter((p) => p.approved && !p.ml_picture_id))
const query = () => ({ account_id: session.selectedAccountId })

async function load() {
  loading.value = true
  try {
    const res = await $api<{ pictures: { id: string; url: string }[]; jobs: Job[]; ai_configured: boolean }>(`/api/items/${props.itemId}/photos`, { query: query() })
    pictures.value = res.pictures
    aiConfigured.value = res.ai_configured
    form.refs = res.pictures.map((p) => p.url)
    const last = res.jobs[0]
    if (last && last.status !== 'publicado') setJob(last)
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível carregar as fotos do anúncio.'))
  } finally {
    loading.value = false
  }
}

function setJob(j: Job) {
  job.value = j
  for (const p of j.photos.filter((x) => x.kind === 'gerada')) void loadImage(p.id)
  clearInterval(poll)
  if (j.status === 'gerando') poll = setInterval(refresh, 4000)
}

async function refresh() {
  if (!job.value) return
  const res = await $api<{ jobs: Job[] }>(`/api/items/${props.itemId}/photos`, { query: query() }).catch(() => null)
  const j = res?.jobs.find((x) => x.id === job.value?.id)
  if (j) setJob(j)
}

async function loadImage(id: number) {
  if (images[id]) return
  const getBlob = $api as unknown as (path: string, options: Record<string, unknown>) => Promise<Blob>
  const blob = await getBlob(`/api/photo_images/${id}`, { query: query(), responseType: 'blob' }).catch(() => null)
  if (blob) images[id] = URL.createObjectURL(blob)
}

function toggleRef(url: string) {
  form.refs = form.refs.includes(url) ? form.refs.filter((u) => u !== url) : [...form.refs, url]
}

function onFiles(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? []).slice(0, 4)
  for (const f of files) {
    const reader = new FileReader()
    reader.onload = () => form.uploads.push(String(reader.result))
    reader.readAsDataURL(f)
  }
}

async function generate() {
  sending.value = true
  try {
    const j = await $api<Job>(`/api/items/${props.itemId}/photos`, {
      method: 'POST', query: query(),
      body: { count: form.count, instructions: form.instructions, reference_urls: form.refs, uploads: form.uploads }
    })
    form.uploads = []
    setJob(j)
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível pedir a geração.'))
  } finally {
    sending.value = false
  }
}

async function approve(p: Photo) {
  const next = !p.approved
  try {
    await $api(`/api/photo_images/${p.id}`, { method: 'PATCH', query: query(), body: { approved: next } })
    p.approved = next
    confirmPublish.value = false
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível salvar a aprovação.'))
  }
}

async function publish() {
  if (!job.value) return
  if (!confirmPublish.value) {
    confirmPublish.value = true
    return
  }
  publishing.value = true
  try {
    const res = await $api<{ message: string; job: Job }>(`/api/photo_jobs/${job.value.id}/publish`, { method: 'POST', query: query(), body: { confirm: true } })
    toast.success(res.message)
    job.value = res.job
  } catch (err) {
    toast.error(apiErrorMessage(err, 'O Mercado Livre não aceitou a publicação.'))
  } finally {
    publishing.value = false
    confirmPublish.value = false
  }
}

function newRequest() {
  job.value = null
  confirmPublish.value = false
}

onMounted(load)
onBeforeUnmount(() => {
  clearInterval(poll)
  Object.values(images).forEach((u) => URL.revokeObjectURL(u))
})
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" data-test="gerar-fotos" @click.self="emit('close')">
    <div class="card my-6 w-full max-w-4xl space-y-4 p-5">
      <header class="flex items-start gap-3">
        <PhotoIcon class="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="text-[17px] font-semibold text-ink">Gerar fotos para o anúncio</p>
          <p class="truncate text-[13px] text-ink-3">{{ itemId }} · {{ title }}</p>
        </div>
        <button type="button" class="btn-link" aria-label="Fechar" @click="emit('close')"><XMarkIcon class="h-5 w-5" /></button>
      </header>

      <p v-if="loading" class="text-ink-3">Carregando as fotos do anúncio…</p>

      <p v-else-if="!aiConfigured" class="rounded-card border border-warning bg-warning-soft p-3 text-[13px] text-ink">
        Para gerar fotos, cadastre a chave da OpenRouter (campo "Chave da API") em <NuxtLink to="/configuracoes" class="btn-link">Configurações › Empresa</NuxtLink>.
      </p>

      <!-- pedido -->
      <template v-else-if="!job">
        <div>
          <p class="mb-1 text-[13px] font-semibold text-ink">Fotos de referência (do próprio anúncio)</p>
          <p class="mb-2 text-[12px] text-ink-3">A IA usa estas fotos para manter o produto igual ao real. Clique para tirar ou pôr.</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="p in pictures"
              :key="p.id"
              type="button"
              class="relative h-20 w-20 overflow-hidden rounded border-2"
              :class="form.refs.includes(p.url) ? 'border-primary' : 'border-line opacity-40'"
              @click="toggleRef(p.url)"
            >
              <img :src="p.url" alt="" class="h-full w-full object-cover" loading="lazy" />
              <CheckCircleIcon v-if="form.refs.includes(p.url)" class="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-white text-primary" />
            </button>
            <p v-if="!pictures.length" class="text-[12px] text-ink-3">O anúncio não tem fotos; anexe ao menos uma referência.</p>
          </div>
        </div>
        <div class="grid gap-3 md:grid-cols-[160px_1fr]">
          <label class="text-[13px]">
            <span class="mb-1 block font-semibold text-ink">Quantas imagens</span>
            <input v-model.number="form.count" type="number" min="1" max="6" class="input" data-test="fotos-quantidade" />
            <span class="mt-1 block text-[11px] text-ink-3">até 6 por pedido</span>
          </label>
          <label class="text-[13px]">
            <span class="mb-1 block font-semibold text-ink">O que você quer nas fotos (opcional)</span>
            <textarea v-model="form.instructions" rows="3" class="input h-auto py-2" placeholder="Ex.: uma foto com o produto em uso no banheiro, outra mostrando o kit completo." />
          </label>
        </div>
        <label class="block text-[13px]">
          <span class="mb-1 block font-semibold text-ink">Anexar outras referências (opcional)</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" multiple class="text-[12px]" @change="onFiles" />
          <span v-if="form.uploads.length" class="ml-2 text-[12px] text-ink-3">{{ form.uploads.length }} anexo(s)</span>
        </label>
        <div class="flex items-center gap-2">
          <button type="button" class="btn-primary h-9" :disabled="sending || !session.isAdmin || (!form.refs.length && !form.uploads.length) || form.count < 1 || form.count > 6" data-test="fotos-gerar" @click="generate">
            {{ sending ? 'Enviando…' : `Gerar ${form.count} imagem(ns)` }}
          </button>
          <span v-if="!session.isAdmin" class="text-[12px] text-ink-3">Só administradores geram e publicam fotos.</span>
          <span v-else class="text-[12px] text-ink-3">Usa créditos da sua conta na OpenRouter. Nada vai para o Mercado Livre sem você publicar.</span>
        </div>
      </template>

      <!-- resultado -->
      <template v-else>
        <div class="flex flex-wrap items-center gap-2 text-[13px]">
          <span v-if="job.status === 'gerando'" class="flex items-center gap-1 text-ink-2"><ArrowPathIcon class="h-4 w-4 animate-spin" /> Gerando {{ generated.length }} de {{ job.count }}… (cada imagem leva até 40 s)</span>
          <span v-else-if="job.status === 'publicado'" class="font-semibold text-success">Publicadas no anúncio em {{ new Date(job.published_at ?? '').toLocaleString('pt-BR') }}.</span>
          <span v-else class="text-ink-2">Escolha as que quer publicar.</span>
          <button type="button" class="btn-link ml-auto" @click="newRequest">Novo pedido</button>
        </div>
        <p v-if="job.error" class="rounded-card bg-danger-soft p-2 text-[13px] text-danger">{{ job.error }}</p>
        <p v-if="job.publish_error" class="rounded-card bg-danger-soft p-2 text-[13px] text-danger">{{ job.publish_error }}</p>
        <div class="grid grid-cols-2 gap-3 md:grid-cols-3">
          <figure v-for="p in generated" :key="p.id" class="overflow-hidden rounded-card border-2" :class="p.approved ? 'border-success' : 'border-line'" data-test="foto-gerada">
            <img v-if="images[p.id]" :src="images[p.id]" alt="" class="aspect-square w-full object-cover" />
            <div v-else class="aspect-square w-full animate-pulse bg-surface-2" />
            <figcaption class="flex items-center gap-2 p-2 text-[12px]">
              <span v-if="p.ml_picture_id" class="font-semibold text-success">Publicada</span>
              <button v-else-if="session.isAdmin" type="button" :class="p.approved ? 'btn-primary' : 'btn-secondary'" class="h-7 px-2 text-[12px]" data-test="foto-aprovar" @click="approve(p)">
                {{ p.approved ? '✓ Aprovada' : 'Aprovar' }}
              </button>
              <a v-if="images[p.id]" :href="images[p.id]" :download="`${itemId}-${p.position + 1}.png`" class="btn-link ml-auto">Baixar</a>
            </figcaption>
          </figure>
        </div>
        <div v-if="session.isAdmin && job.status !== 'gerando'" class="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <button type="button" :class="confirmPublish ? 'btn-danger' : 'btn-primary'" class="h-9" :disabled="publishing || !approved.length" data-test="fotos-publicar" @click="publish">
            {{ publishing ? 'Publicando…' : confirmPublish ? `Confirmar: publicar ${approved.length} no Mercado Livre` : `Publicar ${approved.length} imagem(ns) no anúncio` }}
          </button>
          <span v-if="confirmPublish" class="text-[12px] text-danger">As fotos entram no fim da galeria do anúncio no Mercado Livre na hora. Clique de novo para confirmar.</span>
          <span v-else class="text-[12px] text-ink-3">As fotos atuais do anúncio continuam; as aprovadas entram no fim (limite de 10).</span>
        </div>
      </template>
    </div>
  </div>
</template>
