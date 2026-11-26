<script setup lang="ts">
import { ArrowLeftIcon, CubeIcon, RectangleStackIcon, Squares2X2Icon } from '@heroicons/vue/24/outline'
import { ref, watchEffect } from 'vue'
import CatalogProductEditor from '../../../components/produtos/CatalogProductEditor.vue'
import { useToast } from '../../../composables/useToast'
import { usePageHeader } from '../../../composables/usePageHeader'
import { apiErrorMessage } from '../../../lib/apiErrors'
import { catalogClient, type CatalogKind, type CatalogProduct } from '../../../lib/catalogProducts'
import { useSessionStore } from '../../../stores/session'

/**
 * `/produtos/ia/novo` — escolhe o tipo e cria o rascunho; `/produtos/ia/:id` — edita o produto do Lunna
 * ("Criar Produto com IA", 26/11/2026).
 */
const route = useRoute()
const router = useRouter()
const header = usePageHeader()
const session = useSessionStore()
const toast = useToast()
const { $api } = useNuxtApp()
const client = catalogClient($api as never)

const product = ref<CatalogProduct | null>(null)
const loading = ref(false)
const creating = ref(false)

async function load(id: string) {
  loading.value = true
  try {
    product.value = await client.get(id)
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Produto não encontrado.'))
  } finally {
    loading.value = false
  }
}

watchEffect(() => {
  const id = String(route.params.id)
  if (id !== 'novo' && String(product.value?.id) !== id) void load(id)
  if (id === 'novo') product.value = null
})

async function choose(kind: CatalogKind) {
  creating.value = true
  try {
    const p = await client.create(kind)
    product.value = p
    await router.replace(`/produtos/ia/${p.id}`)
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível criar o rascunho.'))
  } finally {
    creating.value = false
  }
}

const KINDS = [
  { kind: 'simple' as const, title: 'Simples', text: 'Um produto, um SKU. Ex.: um secador, um batom.', icon: CubeIcon },
  { kind: 'variations' as const, title: 'Com variações', text: 'O mesmo produto em cores, voltagens, tamanhos ou tons, cada um com seu SKU. Uma variação pode ser um kit.', icon: Squares2X2Icon },
  { kind: 'kit' as const, title: 'Kit', text: 'Conjunto de produtos que você já tem (SKUs), vendido como um só.', icon: RectangleStackIcon }
]

watchEffect(() => {
  header.state.title = 'Criar Produto com IA'
  header.state.subtitle = 'Produtos'
  header.state.sync = null
  header.state.generatedAt = null
  header.state.refreshing = false
  header.state.onRefresh = null
})
</script>

<template>
  <div class="page space-y-5">
    <NuxtLink to="/produtos" class="btn-link inline-flex items-center gap-1 text-[13px]"><ArrowLeftIcon class="h-4 w-4" /> Produtos</NuxtLink>

    <template v-if="route.params.id === 'novo'">
      <header>
        <h1 class="page-title">Criar Produto com IA</h1>
        <p class="page-subtitle max-w-2xl">O produto é cadastrado no Lunna. Depois de pronto, você poderá exportá-lo para o ERP. Promoção, tipo de anúncio e envio ficam para a publicação do anúncio.</p>
      </header>
      <p v-if="!session.isAdmin" class="card p-6 text-center text-ink-3">Só administradores cadastram produtos.</p>
      <div v-else class="grid gap-4 md:grid-cols-3" data-test="produto-tipos">
        <button v-for="k in KINDS" :key="k.kind" type="button" class="card flex flex-col items-start gap-2 p-5 text-left transition hover:border-primary" :disabled="creating" :data-test="`tipo-${k.kind}`" @click="choose(k.kind)">
          <component :is="k.icon" class="h-7 w-7 text-primary" />
          <span class="text-[16px] font-semibold text-ink">{{ k.title }}</span>
          <span class="text-[13px] text-ink-2">{{ k.text }}</span>
        </button>
      </div>
    </template>

    <p v-else-if="loading && !product" class="card p-10 text-center text-ink-3" role="status">Carregando…</p>
    <CatalogProductEditor v-else-if="product" :product="product" @saved="product = $event" @deleted="router.push('/produtos')" />
  </div>
</template>
