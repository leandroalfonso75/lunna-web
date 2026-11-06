<script setup lang="ts">
import { PlusIcon } from '@heroicons/vue/24/outline'
import { computed, reactive, ref } from 'vue'
import { useToast } from '../../composables/useToast'
import { apiErrorMessage } from '../../lib/apiErrors'
import { brl } from '../../lib/format'
import { useSessionStore } from '../../stores/session'
import type { FinanceEntry } from '../../types/finance'

/**
 * Lançamentos manuais do Financeiro (outras receitas na aba Receita, outras despesas na aba Despesas): lista do
 * período e formulário para incluir, alterar e excluir (só administradores). Cada mudança recarrega o financeiro.
 */
const props = defineProps<{ kind: 'receita' | 'despesa'; entries: FinanceEntry[]; categories: string[] }>()
const emit = defineEmits<{ changed: [] }>()

const { $api } = useNuxtApp()
const session = useSessionStore()
const toast = useToast()

const open = ref(false)
const saving = ref(false)
const editing = ref<number | null>(null)
const confirmDelete = ref<number | null>(null)
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const form = reactive({ date: today, category: '', description: '', amount: '', notes: '' })
const total = computed(() => props.entries.reduce((s, e) => s + e.amount, 0))
/** "AAAA-MM-DD" → "DD/MM" sem reinterpretar fuso (a data do lançamento é só um dia). */
const dayLabel = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const title = computed(() => (props.kind === 'receita' ? 'Outras receitas (lançadas)' : 'Outras despesas (lançadas)'))

function startNew() {
  editing.value = null
  Object.assign(form, { date: today, category: props.categories[0] ?? '', description: '', amount: '', notes: '' })
  open.value = true
}
function startEdit(e: FinanceEntry) {
  editing.value = e.id
  Object.assign(form, { date: e.date, category: e.category, description: e.description, amount: String(e.amount).replace('.', ','), notes: e.notes ?? '' })
  open.value = true
}
async function save() {
  const amount = Number(form.amount.replace(/\./g, '').replace(',', '.'))
  if (!form.description.trim() || !(amount > 0)) {
    toast.error('Informe a descrição e um valor maior que zero.')
    return
  }
  saving.value = true
  try {
    const body = { entry_type: props.kind, date: form.date, category: form.category, description: form.description.trim(), amount, notes: form.notes.trim() || null }
    if (editing.value) await $api(`/api/finance/entries/${editing.value}`, { method: 'PATCH', query: { account_id: session.selectedAccountId }, body })
    else await $api('/api/finance/entries', { method: 'POST', query: { account_id: session.selectedAccountId }, body })
    toast.success(editing.value ? 'Lançamento alterado.' : 'Lançamento incluído.')
    open.value = false
    emit('changed')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível salvar o lançamento.'))
  } finally {
    saving.value = false
  }
}
async function remove(id: number) {
  if (confirmDelete.value !== id) {
    confirmDelete.value = id
    return
  }
  try {
    await $api(`/api/finance/entries/${id}`, { method: 'DELETE', query: { account_id: session.selectedAccountId } })
    toast.success('Lançamento excluído.')
    emit('changed')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível excluir.'))
  } finally {
    confirmDelete.value = null
  }
}
</script>

<template>
  <div class="card p-4" :data-test="`lancamentos-${kind}`">
    <div class="mb-2 flex flex-wrap items-center gap-3">
      <h2 class="section-title">{{ title }}</h2>
      <span class="text-[12px] text-ink-3">no período · total {{ brl(total) }}</span>
      <button v-if="session.isAdmin" type="button" class="btn-primary ml-auto h-8 text-[12px]" :data-test="`incluir-${kind}`" @click="startNew">
        <PlusIcon class="h-4 w-4" aria-hidden="true" /> Incluir {{ kind }}
      </button>
    </div>
    <p class="mb-2 text-[12px] text-ink-3">
      {{ kind === 'receita' ? 'Receitas que não passam pelo Mercado Livre (rendimentos, vendas em outro canal, créditos). Entram no DRE como "Outras receitas".' : 'Despesas que o Mercado Livre não cobra (embalagens, contador, software, pessoal). Entram no DRE como "Outras despesas".' }}
    </p>

    <form v-if="open" class="mb-3 grid gap-2 rounded-card border border-line bg-surface-2 p-3 text-[13px] md:grid-cols-5" @submit.prevent="save">
      <label><span class="field-label">Data</span><input v-model="form.date" type="date" class="input h-9" required /></label>
      <label><span class="field-label">Categoria</span>
        <select v-model="form.category" class="input h-9"><option v-for="c in categories" :key="c" :value="c">{{ c }}</option></select>
      </label>
      <label class="md:col-span-2"><span class="field-label">Descrição</span><input v-model="form.description" type="text" class="input h-9" maxlength="120" required /></label>
      <label><span class="field-label">Valor (R$)</span><input v-model="form.amount" type="text" inputmode="decimal" class="input h-9" placeholder="0,00" required /></label>
      <label class="md:col-span-4"><span class="field-label">Observação (opcional)</span><input v-model="form.notes" type="text" class="input h-9" maxlength="200" /></label>
      <div class="flex items-end gap-2">
        <button type="submit" class="btn-primary h-9" :disabled="saving" data-test="salvar-lancamento">{{ saving ? 'Salvando…' : editing ? 'Salvar' : 'Incluir' }}</button>
        <button type="button" class="btn-link" :disabled="saving" @click="open = false">Cancelar</button>
      </div>
    </form>

    <p v-if="!entries.length" class="text-[13px] text-ink-3">Nenhum lançamento no período.</p>
    <table v-else class="w-full text-[12px]">
      <thead><tr class="border-b border-line text-ink-2"><th class="py-1 text-left font-semibold">Data</th><th class="py-1 text-left font-semibold">Categoria</th><th class="py-1 text-left font-semibold">Descrição</th><th class="py-1 text-right font-semibold">Valor</th><th v-if="session.isAdmin" class="w-32 py-1" /></tr></thead>
      <tbody>
        <tr v-for="e in entries" :key="e.id" class="border-b border-line" data-test="lancamento">
          <td class="py-1.5">{{ dayLabel(e.date) }}</td>
          <td class="py-1.5 text-ink-2">{{ e.category }}</td>
          <td class="py-1.5 text-ink">{{ e.description }}<span v-if="e.notes" class="text-ink-3"> · {{ e.notes }}</span></td>
          <td class="py-1.5 text-right" data-numeric>{{ brl(e.amount) }}</td>
          <td v-if="session.isAdmin" class="py-1.5 text-right">
            <button type="button" class="btn-link" @click="startEdit(e)">Alterar</button>
            <button type="button" class="btn-link ml-2" :class="confirmDelete === e.id ? 'text-danger' : ''" @click="remove(e.id)">{{ confirmDelete === e.id ? 'Confirmar exclusão' : 'Excluir' }}</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
