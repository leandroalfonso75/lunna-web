<script setup lang="ts">
import { ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { computed, ref, watch, watchEffect } from 'vue'
import OlistProductRow from '../components/produtos/OlistProductRow.vue'
import RemoveProductsDialog from '../components/produtos/RemoveProductsDialog.vue'
import { useOlistProducts } from '../composables/useOlistProducts'
import { useSessionStore } from '../stores/session'
import { usePageHeader } from '../composables/usePageHeader'
import { dateTimeShort, int } from '../lib/format'

/**
 * `/produtos` — produtos cadastrados no Olist ERP, guardados no banco do Lunna
 * (atualizados a cada 3 min; "Atualizar agora" força na hora). Somente leitura
 * por enquanto: preço e estoque ainda não são editados por aqui.
 */
const header = usePageHeader()
const olist = useOlistProducts()
const session = useSessionStore()

// Seleção para as ações em lote (só administradores). Variação vai junto com o pai.
const selected = ref<Set<number>>(new Set())
const action = ref<'excluir' | 'restaurar'>('excluir')
const dialogOpen = ref(false)
const removing = ref(false)
const pageIds = computed(() => olist.products.value.map((p) => p.id))
const allOnPage = computed(() => pageIds.value.length > 0 && pageIds.value.every((id) => selected.value.has(id)))

function toggle(id: number) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}
function toggleAll() {
  selected.value = allOnPage.value ? new Set() : new Set(pageIds.value)
}
async function runAction() {
  if (!selected.value.size) return
  if (action.value === 'excluir') {
    dialogOpen.value = true
    return
  }
  removing.value = true
  const ok = await olist.restoreProducts([...selected.value])
  removing.value = false
  if (ok) selected.value = new Set()
}
async function confirmRemove(keepInErp: boolean) {
  removing.value = true
  const ok = await olist.removeProducts([...selected.value], keepInErp)
  removing.value = false
  dialogOpen.value = false
  if (ok) selected.value = new Set()
}
// trocar de página, busca, filtro ou visão limpa a seleção (só vale o que está na tela)
watch([olist.page, olist.q, olist.status, olist.hidden], () => { selected.value = new Set() })
// na visão dos ocultos a única ação é Restaurar
watch(olist.hidden, (h) => { action.value = h ? 'restaurar' : 'excluir' })

watchEffect(() => {
  header.state.title = 'Produtos'
  header.state.subtitle = 'Olist ERP'
  header.state.sync = null
  header.state.generatedAt = null
  header.state.refreshing = olist.syncing.value
  header.state.onRefresh = olist.connected.value ? olist.refreshNow : null
})
</script>

<template>
  <div class="page space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="page-title">Produtos</h1>
        <p class="page-subtitle max-w-2xl">Produtos cadastrados no Olist ERP, com preços, custo e estoque (Olist, Full no Mercado Livre e total). Produtos com variações mostram a seta ao lado do nome.</p>
        <p v-if="olist.connected.value" class="mt-2 text-[13px] text-ink-2" data-test="produtos-sync" role="status">
          <template v-if="olist.syncing.value">Atualizando agora…</template>
          <template v-else-if="olist.lastSyncedAt.value">
            Atualizado às {{ dateTimeShort(olist.lastSyncedAt.value) }} · automático a cada 3 minutos
          </template>
          <template v-else>Ainda sem sincronização.</template>
        </p>
      </div>
      <button
        v-if="olist.connected.value"
        type="button"
        class="btn-secondary shrink-0"
        data-test="atualizar-produtos"
        :disabled="olist.syncing.value"
        @click="olist.refreshNow()"
      >
        <ArrowPathIcon class="h-4 w-4" :class="{ 'animate-spin': olist.syncing.value }" aria-hidden="true" />
        Atualizar agora
      </button>
    </header>

    <div v-if="olist.olist.value && !olist.connected.value" class="card p-8 text-center" data-test="olist-desconectado">
      <p class="text-[15px] font-semibold text-ink">O Olist ERP ainda não está conectado.</p>
      <p class="mt-1 text-[13px] text-ink-3">
        {{ olist.olist.value.status === 'reauth_required' ? 'O acesso salvo expirou (o Olist renova por no máximo 1 dia) e precisa ser autorizado de novo.' : 'Conecte a conta do Olist para ver os produtos.' }}
      </p>
      <button v-if="session.isAdmin" type="button" class="btn-primary mt-4" data-test="reconectar-olist" @click="olist.reconnect()">
        Reconectar ao Olist
      </button>
      <p v-else class="mt-2 text-[13px] text-ink-3">Peça a um administrador para reconectar.</p>
    </div>

    <template v-else-if="olist.olist.value">
      <p
        v-if="olist.olist.value.costs?.status === 'forbidden'"
        class="rounded-card border border-warning bg-warning-soft px-3 py-2 text-[13px] text-warning"
        role="status"
        data-test="custo-indisponivel"
      >
        O custo (PEPS) está indisponível: o Olist bloqueou a leitura do histórico de movimentações de estoque (acesso negado), mesmo com o aplicativo autorizado.
        Confira se o usuário do Olist que autorizou tem permissão para ver o histórico do Controle de Estoque e, se continuar, peça ao suporte do Olist para liberar esse acesso ao aplicativo.
      </p>
      <div class="card flex flex-wrap items-center gap-3 p-3">
        <div class="relative min-w-[240px] flex-1">
          <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <input
            v-model="olist.q.value"
            type="search"
            class="input pl-9"
            placeholder="Buscar por nome, SKU ou GTIN"
            aria-label="Buscar produtos"
            data-test="produtos-busca"
          />
        </div>
        <select v-model="olist.status.value" class="input w-auto" aria-label="Situação" data-test="produtos-situacao">
          <option value="">Todas as situações</option>
          <option value="A">Ativos</option>
          <option value="I">Inativos</option>
          <option value="E">Excluídos</option>
        </select>
        <span class="text-[13px] text-ink-3" data-test="produtos-total">{{ int(olist.total.value) }} {{ olist.hidden.value ? (olist.total.value === 1 ? 'oculto' : 'ocultos') : 'produtos' }}</span>
        <button
          v-if="session.isAdmin && (olist.hiddenCount.value || olist.hidden.value)"
          type="button"
          class="btn-link ml-auto text-[13px]"
          data-test="produtos-ver-ocultos"
          @click="olist.hidden.value = !olist.hidden.value"
        >
          {{ olist.hidden.value ? '← Voltar para a lista' : `Ver ocultos (${int(olist.hiddenCount.value)})` }}
        </button>
      </div>
      <p v-if="olist.hidden.value" class="rounded-card border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink-2" data-test="produtos-aviso-ocultos">
        Produtos removidos da lista. Selecione e use "Restaurar" para trazê-los de volta. Quem foi excluído também no ERP volta como "Excluído" (o cadastro não é recriado no Olist).
      </p>

      <div v-if="session.isAdmin && selected.size" class="card flex flex-wrap items-center gap-3 border-primary p-3 text-[13px]" data-test="produtos-acoes">
        <span class="font-semibold text-ink">{{ selected.size }} {{ selected.size === 1 ? 'selecionado' : 'selecionados' }}</span>
        <label class="flex items-center gap-2">
          <span class="text-ink-2">Ação</span>
          <select v-model="action" class="input w-auto" data-test="produtos-acao">
            <option v-if="!olist.hidden.value" value="excluir">Excluir</option>
            <option v-else value="restaurar">Restaurar</option>
          </select>
        </label>
        <button type="button" class="btn-primary h-9" data-test="produtos-aplicar-acao" :disabled="removing" @click="runAction">Aplicar</button>
        <button type="button" class="btn-link" @click="selected = new Set()">Limpar seleção</button>
      </div>

      <div v-if="olist.error.value" class="card p-6 text-center" role="alert">
        <p class="text-[15px] text-danger">{{ olist.error.value }}</p>
      </div>

      <div v-else class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1100px] border-collapse text-[13px]">
            <thead class="bg-surface-2">
              <tr class="border-b border-line text-left text-ink-2">
                <th scope="col" class="w-8 px-2 py-2">
                  <input v-if="session.isAdmin" type="checkbox" :checked="allOnPage" aria-label="Selecionar todos desta página" data-test="produtos-selecionar-todos" @change="toggleAll" />
                </th>
                <th scope="col" class="px-3 py-2 font-semibold">SKU</th>
                <th scope="col" class="px-3 py-2 font-semibold">Produto</th>
                <th scope="col" class="px-3 py-2 font-semibold">Situação</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold">Preço</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold">Promocional</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold">Custo</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold">Estoque Olist<span class="block text-[11px] font-normal text-ink-3">disponível</span></th>
                <th scope="col" class="px-3 py-2 text-right font-semibold">Estoque Full<span class="block text-[11px] font-normal text-ink-3">Mercado Livre</span></th>
                <th scope="col" class="px-3 py-2 text-right font-semibold">Estoque total<span class="block text-[11px] font-normal text-ink-3">Olist + Full</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="olist.loading.value">
                <td colspan="10" class="px-3 py-10 text-center text-ink-3" role="status">Carregando produtos…</td>
              </tr>
              <tr v-else-if="!olist.products.value.length">
                <td colspan="10" class="px-3 py-10 text-center text-ink-3">
                  {{ olist.q.value || olist.status.value ? 'Nenhum produto com esses filtros.' : 'Nenhum produto sincronizado ainda. Clique em “Atualizar agora”.' }}
                </td>
              </tr>
              <OlistProductRow
                v-for="p in olist.products.value"
                v-else
                :key="p.id"
                :product="p"
                :selectable="session.isAdmin"
                :selected="selected.has(p.id)"
                @toggle="toggle"
              />
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="olist.pages.value > 1" class="flex items-center justify-center gap-3">
        <button type="button" class="btn-secondary" :disabled="olist.page.value === 0" @click="olist.goTo(olist.page.value - 1)">← Anteriores</button>
        <span class="text-[13px] text-ink-3">Página {{ olist.page.value + 1 }} de {{ int(olist.pages.value) }}</span>
        <button type="button" class="btn-secondary" :disabled="olist.page.value >= olist.pages.value - 1" @click="olist.goTo(olist.page.value + 1)">Próximos →</button>
      </div>
    </template>

    <div v-else-if="olist.error.value" class="card p-6 text-center text-danger" role="alert">{{ olist.error.value }}</div>
    <div v-else class="card p-10 text-center text-ink-3" role="status">Carregando…</div>

    <RemoveProductsDialog
      v-if="dialogOpen"
      :count="selected.size"
      :integrated="olist.connected.value"
      :busy="removing"
      @confirm="confirmRemove"
      @cancel="dialogOpen = false"
    />
  </div>
</template>
