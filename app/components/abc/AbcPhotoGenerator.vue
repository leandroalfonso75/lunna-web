<script setup lang="ts">
import { ArrowPathIcon, ChevronLeftIcon, ChevronRightIcon, CheckCircleIcon, PhotoIcon, StarIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
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

interface Photo { id: number; kind: 'gerada' | 'referencia'; position: number; approved: boolean; ml_picture_id: string | null; cost_usd: number | null; model: string | null }
interface Job { id: number; status: 'gerando' | 'pronto' | 'erro' | 'publicado'; count: number; instructions: string | null; error: string | null; publish_error: string | null; published_at: string | null; published_item_id: string | null; created_at: string; cost_usd: number; photos: Photo[] }
interface Alternative { item_id: string; status: string; pictures: number }

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
// anúncio de catálogo: o ML não deixa trocar as fotos; publica no tradicional do mesmo produto
const catalogListing = ref(false)
const alternatives = ref<Alternative[]>([])
const publishTarget = ref(props.itemId)

// Galeria final (pedido do usuário em 04/11/2026): a ordem das fotos no anúncio, a 1ª é a capa. Tokens "ml:<id>" (foto
// atual do anúncio de destino) e "new:<id>" (imagem gerada aprovada).
const targetPictures = ref<{ id: string; url: string }[]>([])
const order = ref<string[]>([])
const originalCover = ref<string | null>(null)
const checkingCover = ref(false)
const coverWarning = ref<{ token: string; previous: string[]; reasons: string[] } | null>(null)
const coverOk = ref<string | null>(null)
let poll: ReturnType<typeof setInterval> | undefined

const generated = computed(() => (job.value?.photos ?? []).filter((p) => p.kind === 'gerada'))
// já publicada = o pedido foi publicado e a imagem tem id no ML (ter id sozinho só quer dizer que subiu)
const isPublished = (p: Photo) => job.value?.status === 'publicado' && !!p.ml_picture_id
const approved = computed(() => generated.value.filter((p) => p.approved && !isPublished(p)))
const query = () => ({ account_id: session.selectedAccountId })

async function load() {
  loading.value = true
  try {
    const res = await $api<{ pictures: { id: string; url: string }[]; jobs: Job[]; ai_configured: boolean; catalog_listing: boolean; alternatives: Alternative[] }>(`/api/items/${props.itemId}/photos`, { query: query() })
    pictures.value = res.pictures
    aiConfigured.value = res.ai_configured
    catalogListing.value = res.catalog_listing
    alternatives.value = res.alternatives ?? []
    publishTarget.value = (res.catalog_listing && res.alternatives?.[0]?.item_id) || props.itemId
    await loadTargetPictures()
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

async function loadTargetPictures() {
  const res = await $api<{ pictures: { id: string; url: string }[] }>(`/api/items/${publishTarget.value}/photos`, { query: query() }).catch(() => null)
  targetPictures.value = res?.pictures ?? []
  originalCover.value = targetPictures.value[0] ? `ml:${targetPictures.value[0].id}` : null
  order.value = [...targetPictures.value.map((p) => `ml:${p.id}`), ...approved.value.map((p) => `new:${p.id}`)]
  coverOk.value = null
}

// aprovou/reprovou: a nova entra no fim, a reprovada sai; o resto da ordem fica como o usuário deixou
watch(() => approved.value.map((p) => p.id).join(','), () => {
  const fresh = approved.value.map((p) => `new:${p.id}`)
  order.value = [...order.value.filter((t) => t.startsWith('ml:') || fresh.includes(t)), ...fresh.filter((t) => !order.value.includes(t))]
})
watch(publishTarget, () => void loadTargetPictures())

function thumb(token: string) {
  if (token.startsWith('new:')) return images[Number(token.slice(4))] ?? ''
  return targetPictures.value.find((p) => `ml:${p.id}` === token)?.url ?? ''
}

function move(index: number, delta: number) {
  const to = index + delta
  if (to < 0 || to >= order.value.length) return
  const previous = [...order.value]
  const next = [...order.value]
  const [item] = next.splice(index, 1)
  next.splice(to, 0, item as string)
  order.value = next
  confirmPublish.value = false
  if (to === 0 || index === 0) void checkCover(previous)
}

function makeCover(index: number) {
  if (index === 0) return
  const previous = [...order.value]
  const next = [...order.value]
  const [item] = next.splice(index, 1)
  order.value = [item as string, ...next]
  confirmPublish.value = false
  void checkCover(previous)
}

/** Capa nova (diferente da atual do anúncio): confere pela IA se segue o padrão do ML; fora dele, avisa. */
async function checkCover(previous: string[]) {
  const token = order.value[0]
  coverOk.value = null
  if (!token || token === originalCover.value || !job.value) return
  checkingCover.value = true
  try {
    const res = await $api<{ ok: boolean; reasons: string[] }>(`/api/photo_jobs/${job.value.id}/check_cover`, {
      method: 'POST', query: query(), body: { ref: token, item_id: publishTarget.value }
    })
    if (order.value[0] !== token) return
    if (res.ok) coverOk.value = token
    else coverWarning.value = { token, previous, reasons: res.reasons }
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível conferir a capa agora.'))
  } finally {
    checkingCover.value = false
  }
}

function cancelCover() {
  if (coverWarning.value) order.value = coverWarning.value.previous
  coverWarning.value = null
}

/** "Publicar mesmo assim" no aviso da capa: é a confirmação; publica direto. */
async function publishAnyway() {
  coverWarning.value = null
  confirmPublish.value = true
  await publish()
}

async function publish() {
  if (!job.value) return
  if (!confirmPublish.value) {
    confirmPublish.value = true
    return
  }
  publishing.value = true
  try {
    const res = await $api<{ message: string; job: Job }>(`/api/photo_jobs/${job.value.id}/publish`, {
      method: 'POST', query: query(), body: { confirm: true, target_item_id: publishTarget.value, order: order.value }
    })
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
          <span v-else-if="job.status === 'publicado'" class="font-semibold text-success">Publicadas no anúncio {{ job.published_item_id ?? itemId }} em {{ new Date(job.published_at ?? '').toLocaleString('pt-BR') }}.</span>
          <span v-else class="text-ink-2">Escolha as que quer publicar.</span>
          <span v-if="job.cost_usd" class="text-ink-3">· custo na OpenRouter: US$ {{ job.cost_usd.toFixed(3) }}</span>
          <button type="button" class="btn-link ml-auto" @click="newRequest">Novo pedido</button>
        </div>
        <p v-if="job.error" class="rounded-card bg-danger-soft p-2 text-[13px] text-danger">{{ job.error }}</p>
        <p v-if="job.publish_error" class="rounded-card bg-danger-soft p-2 text-[13px] text-danger">{{ job.publish_error }}</p>
        <div class="grid grid-cols-2 gap-3 md:grid-cols-3">
          <figure v-for="p in generated" :key="p.id" class="overflow-hidden rounded-card border-2" :class="p.approved ? 'border-success' : 'border-line'" data-test="foto-gerada">
            <img v-if="images[p.id]" :src="images[p.id]" alt="" class="aspect-square w-full object-cover" />
            <div v-else class="aspect-square w-full animate-pulse bg-surface-2" />
            <figcaption class="flex items-center gap-2 p-2 text-[12px]">
              <span v-if="isPublished(p)" class="font-semibold text-success">Publicada</span>
              <button v-else-if="session.isAdmin" type="button" :class="p.approved ? 'btn-primary' : 'btn-secondary'" class="h-7 px-2 text-[12px]" data-test="foto-aprovar" @click="approve(p)">
                {{ p.approved ? '✓ Aprovada' : 'Aprovar' }}
              </button>
              <span v-if="p.cost_usd !== null" class="text-ink-3" :title="p.model ?? ''">US$ {{ p.cost_usd.toFixed(3) }}</span>
              <a v-if="images[p.id]" :href="images[p.id]" :download="`${itemId}-${p.position + 1}.png`" class="btn-link ml-auto">Baixar</a>
            </figcaption>
          </figure>
        </div>
        <p v-if="catalogListing" class="rounded-card border border-warning bg-warning-soft p-2 text-[13px] text-ink" data-test="fotos-catalogo">
          {{ itemId }} é <strong>anúncio de catálogo</strong>: o Mercado Livre mostra as fotos do produto do catálogo e não deixa trocá-las.
          <template v-if="alternatives.length">As fotos vão para o anúncio tradicional do mesmo produto, escolhido abaixo.</template>
          <template v-else>Não há anúncio tradicional deste produto para receber as fotos; você pode baixá-las.</template>
        </p>
        <div v-if="session.isAdmin && job.status !== 'gerando' && job.status !== 'publicado' && approved.length && (!catalogListing || alternatives.length)" class="space-y-2 border-t border-line pt-3" data-test="fotos-ordem">
          <p class="text-[13px] font-semibold text-ink">
            Ordem das fotos no anúncio {{ publishTarget }}
            <span class="font-normal text-ink-3">· a 1ª é a capa; use as setas ou "Tornar capa" ({{ order.length }} de 10)</span>
          </p>
          <ol class="flex gap-2 overflow-x-auto pb-1">
            <li v-for="(t, i) in order" :key="t" class="w-28 shrink-0 overflow-hidden rounded-card border-2" :class="i === 0 ? 'border-primary' : 'border-line'" data-test="fotos-ordem-item">
              <div class="relative">
                <img v-if="thumb(t)" :src="thumb(t)" alt="" class="aspect-square w-full object-cover" />
                <div v-else class="aspect-square w-full animate-pulse bg-surface-2" />
                <span class="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 text-[11px] font-bold text-white">{{ i + 1 }}</span>
                <span v-if="i === 0" class="absolute right-1 top-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">CAPA</span>
                <span v-if="t.startsWith('new:')" class="absolute bottom-1 left-1 rounded-full bg-success px-1.5 text-[10px] font-bold text-white">NOVA</span>
              </div>
              <div class="flex items-center justify-between p-1">
                <button type="button" class="btn-link p-0.5" :disabled="i === 0" aria-label="Mover para a esquerda" @click="move(i, -1)"><ChevronLeftIcon class="h-4 w-4" /></button>
                <button v-if="i !== 0" type="button" class="btn-link p-0.5 text-[11px]" data-test="fotos-tornar-capa" @click="makeCover(i)"><StarIcon class="inline h-3.5 w-3.5" /> Capa</button>
                <button type="button" class="btn-link p-0.5" :disabled="i === order.length - 1" aria-label="Mover para a direita" @click="move(i, 1)"><ChevronRightIcon class="h-4 w-4" /></button>
              </div>
            </li>
          </ol>
          <p v-if="checkingCover" class="flex items-center gap-1 text-[12px] text-ink-3"><ArrowPathIcon class="h-4 w-4 animate-spin" /> Conferindo se a nova capa segue o padrão do Mercado Livre…</p>
          <p v-else-if="coverOk && order[0] === coverOk" class="text-[12px] font-semibold text-success">A nova capa segue o padrão do Mercado Livre (fundo branco, sem texto).</p>
          <p v-if="order.length > 10" class="text-[12px] text-danger">O Mercado Livre aceita até 10 fotos: as que passarem do limite ficam de fora.</p>
        </div>
        <div v-if="coverWarning" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="alertdialog" aria-modal="true" data-test="capa-aviso">
          <div class="card max-w-md space-y-3 p-5">
            <p class="text-[16px] font-semibold text-danger">Capa fora dos padrões do Mercado Livre</p>
            <img v-if="thumb(coverWarning.token)" :src="thumb(coverWarning.token)" alt="" class="mx-auto h-40 w-40 rounded object-cover" />
            <p class="text-[13px] text-ink">A imagem escolhida para capa está fora dos padrões do Mercado Livre e o anúncio pode ser barrado:</p>
            <ul class="list-disc pl-5 text-[13px] text-ink-2">
              <li v-for="(r, k) in coverWarning.reasons" :key="k">{{ r }}</li>
            </ul>
            <div class="flex justify-end gap-2">
              <button type="button" class="btn-secondary h-9" data-test="capa-cancelar" @click="cancelCover">Cancelar</button>
              <button type="button" class="btn-danger h-9" :disabled="publishing" data-test="capa-publicar-mesmo-assim" @click="publishAnyway">Publicar mesmo assim</button>
            </div>
          </div>
        </div>
        <div v-if="session.isAdmin && job.status !== 'gerando' && (!catalogListing || alternatives.length)" class="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <label v-if="alternatives.length" class="flex items-center gap-2 text-[13px]">
            <span class="text-ink-2">Publicar em</span>
            <select v-model="publishTarget" class="input h-9 w-auto" data-test="fotos-destino" @change="confirmPublish = false">
              <option v-for="a in alternatives" :key="a.item_id" :value="a.item_id">{{ a.item_id }} (tradicional, {{ a.pictures }} fotos)</option>
            </select>
          </label>
          <button type="button" :class="confirmPublish ? 'btn-danger' : 'btn-primary'" class="h-9" :disabled="publishing || !approved.length" data-test="fotos-publicar" @click="publish">
            {{ publishing ? 'Publicando…' : confirmPublish ? `Confirmar: publicar ${approved.length} em ${publishTarget}` : `Publicar ${approved.length} imagem(ns) no anúncio ${publishTarget}` }}
          </button>
          <span v-if="confirmPublish" class="text-[12px] text-danger">A galeria do anúncio no Mercado Livre muda na hora, na ordem acima. Clique de novo para confirmar.</span>
          <span v-else class="text-[12px] text-ink-3">As fotos atuais do anúncio continuam; a ordem e a capa são as que estão acima.</span>
        </div>
      </template>
    </div>
  </div>
</template>
