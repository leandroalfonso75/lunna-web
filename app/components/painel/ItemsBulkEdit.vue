<script setup lang="ts">
import { ClipboardDocumentListIcon, DocumentTextIcon, PencilSquareIcon, PhotoIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { computed, onMounted, ref } from 'vue'
import { apiErrorMessage } from '../../lib/apiErrors'
import { useSessionStore } from '../../stores/session'
import AbcDescriptionEditor from '../abc/AbcDescriptionEditor.vue'
import AbcPhotoGenerator from '../abc/AbcPhotoGenerator.vue'
import type { SameSkuItem } from '../abc/AbcSameSkuChoice.vue'
import AbcSpecsEditor from '../abc/AbcSpecsEditor.vue'

/**
 * Anúncios › "Editar anúncios selecionados" (pedido do usuário em 24/11/2026). Só um anúncio, ou vários com o(s) mesmo(s)
 * SKU(s) (a API confere em GET /api/items/bulk_edit). Edita ficha técnica (completa, com "Sugerir características"),
 * descrição (com "Sugerir descrição") e imagens (geradas com IA, como na Curva ABC). O primeiro selecionado é o principal:
 * os editores leem e sugerem a partir dele, e a publicação vale também para os outros (já marcados na confirmação).
 */
const props = defineProps<{ itemIds: string[] }>()
const emit = defineEmits<{ close: []; changed: [] }>()

interface GroupItem { item_id: string; title: string | null; sku: string | null; status: string | null; listing_type_id: string | null; catalog_listing: boolean; skus: string[] }
interface Group { ok: boolean; message: string | null; primary: GroupItem | null; others: GroupItem[]; skus: string[] }

const { $api } = useNuxtApp()
const session = useSessionStore()

const loading = ref(true)
const group = ref<Group | null>(null)
const error = ref('')
const variations = ref(0)
const editing = ref<'ficha' | 'descricao' | 'fotos' | null>(null)

const sameSku = computed<SameSkuItem[]>(() => (group.value?.others ?? []).map((o) => ({ item_id: o.item_id, sku: o.sku, title: o.title, status: o.status, listing_type_id: o.listing_type_id })))
const all = computed(() => (group.value?.primary ? [group.value.primary, ...group.value.others] : []))
const typeLabel = (t: string | null) => (t === 'gold_pro' ? 'Premium' : t === 'gold_special' ? 'Clássico' : t ?? '')

onMounted(async () => {
  try {
    group.value = await $api<Group>('/api/items/bulk_edit', { query: { account_id: session.selectedAccountId, 'item_ids[]': props.itemIds } })
    // variações do anúncio pai (para "aplicar às outras variações"): lidas em segundo plano, sem segurar a tela
    const primary = group.value.primary?.item_id
    if (primary) {
      void $api<{ count: number }>(`/api/items/${primary}/variations`, { query: { account_id: session.selectedAccountId } })
        .then((res) => { variations.value = res?.count ?? 0 }).catch(() => {})
    }
  } catch (err) {
    const data = (err as { data?: Group })?.data
    error.value = data?.message || apiErrorMessage(err, 'Não foi possível conferir os anúncios selecionados.')
  } finally {
    loading.value = false
  }
})

function changed() {
  emit('changed')
}
</script>

<template>
  <div v-if="!editing" class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" data-test="editar-selecionados" @click.self="emit('close')">
    <div class="card my-10 w-full max-w-2xl space-y-4 p-5 text-[13px]">
      <header class="flex items-start gap-3">
        <PencilSquareIcon class="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="text-[17px] font-semibold text-ink">Editar {{ itemIds.length > 1 ? `${itemIds.length} anúncios` : 'anúncio' }}</p>
          <p v-if="group?.skus.length" class="text-ink-3">SKU: {{ group.skus.join(', ') }}</p>
        </div>
        <button type="button" class="btn-link" aria-label="Fechar" @click="emit('close')"><XMarkIcon class="h-5 w-5" /></button>
      </header>

      <p v-if="loading" class="text-ink-3">Conferindo os anúncios selecionados…</p>

      <div v-else-if="error" class="space-y-3">
        <p class="rounded-card border border-warning bg-warning-soft p-3 text-ink" role="alert" data-test="editar-bloqueado">{{ error }}</p>
        <div class="flex justify-end"><button type="button" class="btn-secondary h-9" @click="emit('close')">Entendi</button></div>
      </div>

      <template v-else-if="group?.primary">
        <ul class="divide-y divide-line rounded-card border border-line" data-test="editar-lista">
          <li v-for="(i, index) in all" :key="i.item_id" class="flex items-start gap-2 px-3 py-2">
            <span class="pill-neutral shrink-0 text-[11px]">{{ index === 0 ? 'principal' : 'também' }}</span>
            <span class="min-w-0">
              <span class="block truncate font-medium text-ink" :title="i.title ?? ''">{{ i.title }}</span>
              <span class="text-[12px] text-ink-3">{{ i.item_id }} · {{ typeLabel(i.listing_type_id) }}<template v-if="i.status && i.status !== 'active'"> · {{ i.status === 'paused' ? 'pausado' : i.status }}</template><template v-if="i.catalog_listing"> · catálogo</template></span>
            </span>
          </li>
        </ul>
        <p v-if="group.others.length" class="text-[12px] text-ink-2">
          O Lunna lê e sugere a partir do principal ({{ group.primary.item_id }}). Ao publicar, a alteração vale também para os outros {{ group.others.length }} (dá para desmarcar na confirmação).
        </p>
        <p v-if="!session.isAdmin" class="text-[12px] text-ink-3">Só administradores publicam no Mercado Livre; você pode ver e pedir sugestões.</p>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button type="button" class="card flex flex-col items-start gap-1 p-4 text-left hover:border-primary" data-test="editar-ficha" @click="editing = 'ficha'">
            <ClipboardDocumentListIcon class="h-6 w-6 text-primary" aria-hidden="true" />
            <span class="font-semibold text-ink">Ficha técnica</span>
            <span class="text-[12px] text-ink-3">Altere as características e complete as que faltam. Com "Sugerir características".</span>
          </button>
          <button type="button" class="card flex flex-col items-start gap-1 p-4 text-left hover:border-primary" data-test="editar-descricao" @click="editing = 'descricao'">
            <DocumentTextIcon class="h-6 w-6 text-primary" aria-hidden="true" />
            <span class="font-semibold text-ink">Descrição</span>
            <span class="text-[12px] text-ink-3">Reescreva a descrição. Com "Sugerir descrição" a partir das dúvidas dos compradores.</span>
          </button>
          <button type="button" class="card flex flex-col items-start gap-1 p-4 text-left hover:border-primary" data-test="editar-fotos" @click="editing = 'fotos'">
            <PhotoIcon class="h-6 w-6 text-primary" aria-hidden="true" />
            <span class="font-semibold text-ink">Imagens</span>
            <span class="text-[12px] text-ink-3">Gere fotos novas com IA a partir das do anúncio, aprove e escolha a ordem e a capa.</span>
          </button>
        </div>
      </template>
    </div>
  </div>

  <template v-if="group?.primary">
    <AbcSpecsEditor v-if="editing === 'ficha'" :item-id="group.primary.item_id" :variations="variations" full :same-sku="sameSku" preselect-same-sku @close="editing = null" @changed="changed" />
    <AbcDescriptionEditor v-if="editing === 'descricao'" :item-id="group.primary.item_id" :variations="variations" :same-sku="sameSku" preselect-same-sku @close="editing = null" @changed="changed" />
    <AbcPhotoGenerator v-if="editing === 'fotos'" :item-id="group.primary.item_id" :title="group.primary.title ?? ''" :suggested-count="3" :also-item-ids="group.others.map((o) => o.item_id)" @close="editing = null" />
  </template>
</template>
