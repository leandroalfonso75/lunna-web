<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useToast } from '../../composables/useToast'
import { apiErrorMessage } from '../../lib/apiErrors'
import type { SettingsClient } from '../../lib/settingsClient'
import type { User, UserRole } from '../../types/api'

const props = defineProps<{ settingsApi: SettingsClient }>()
const toast = useToast()

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'member', label: 'Membro' }
]

function roleLabel(role: UserRole): string {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role
}

const users = ref<User[]>([])
const loading = ref(true)
const loadError = ref('')

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const { users: list } = await props.settingsApi.listUsers()
    users.value = list
  } catch {
    loadError.value = 'Não foi possível carregar os usuários agora. Tente de novo.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

// --- Adicionar -------------------------------------------------------------
const newName = ref('')
const newEmail = ref('')
const newPassword = ref('')
const newRole = ref<UserRole>('member')
const creating = ref(false)
const createError = ref('')

async function createUser() {
  createError.value = ''
  creating.value = true
  try {
    const { user } = await props.settingsApi.createUser({
      name: newName.value,
      email: newEmail.value,
      password: newPassword.value,
      role: newRole.value
    })
    users.value.push(user)
    newName.value = ''
    newEmail.value = ''
    newPassword.value = ''
    newRole.value = 'member'
    toast.success('Usuário adicionado.')
  } catch (err) {
    createError.value = apiErrorMessage(err, 'Não foi possível adicionar o usuário agora. Tente de novo.')
  } finally {
    creating.value = false
  }
}

// --- Trocar papel ------------------------------------------------------------
const roleSavingId = ref<string | null>(null)

async function changeRole(user: User, role: UserRole) {
  if (role === user.role) return
  roleSavingId.value = user.id
  try {
    const { user: updated } = await props.settingsApi.updateUser(user.id, { role })
    Object.assign(user, updated)
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível trocar o papel agora. Tente de novo.'))
  } finally {
    roleSavingId.value = null
  }
}

// --- Redefinir senha ---------------------------------------------------------
const resettingId = ref<string | null>(null)
const resetPasswordDraft = reactive<Record<string, string>>({})

async function resetPassword(user: User) {
  const password = resetPasswordDraft[user.id]?.trim()
  if (!password) return
  resettingId.value = user.id
  try {
    await props.settingsApi.updateUser(user.id, { password })
    resetPasswordDraft[user.id] = ''
    toast.success('Senha redefinida.')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível redefinir a senha agora. Tente de novo.'))
  } finally {
    resettingId.value = null
  }
}

// --- Remover (confirmação inline, sem window.confirm) -----------------------
const confirmingRemoveId = ref<string | null>(null)
const removingId = ref<string | null>(null)

async function confirmRemove(user: User) {
  removingId.value = user.id
  try {
    await props.settingsApi.deleteUser(user.id)
    users.value = users.value.filter((u) => u.id !== user.id)
    toast.success('Usuário removido.')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível remover agora. Tente de novo.'))
  } finally {
    removingId.value = null
    confirmingRemoveId.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <form class="card space-y-4 p-5" @submit.prevent="createUser">
      <h2 class="section-title">Adicionar usuário</h2>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div class="space-y-1">
          <label for="novo-nome" class="field-label">Nome</label>
          <input id="novo-nome" v-model="newName" data-test="novo-nome" type="text" required class="input" />
        </div>
        <div class="space-y-1">
          <label for="novo-email" class="field-label">E-mail</label>
          <input id="novo-email" v-model="newEmail" data-test="novo-email" type="email" required class="input" />
        </div>
        <div class="space-y-1">
          <label for="nova-senha" class="field-label">Senha inicial</label>
          <input id="nova-senha" v-model="newPassword" data-test="nova-senha" type="password" minlength="8" required class="input" />
        </div>
        <div class="space-y-1">
          <label for="novo-papel" class="field-label">Papel</label>
          <select id="novo-papel" v-model="newRole" data-test="novo-papel" class="input">
            <option v-for="opt in ROLE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
      </div>

      <p v-if="createError" role="alert" class="text-[15px] text-danger">{{ createError }}</p>

      <button type="submit" data-test="adicionar-usuario" :disabled="creating" class="btn-primary">
        {{ creating ? 'Adicionando...' : 'Adicionar usuário' }}
      </button>
    </form>

    <div v-if="loading" role="status" class="text-[15px] text-ink-2">Carregando...</div>

    <div v-else-if="loadError" class="card p-6 text-center" role="alert">
      <p class="text-[15px] text-danger">{{ loadError }}</p>
      <button type="button" class="btn-link mt-3" @click="load">Tentar de novo</button>
    </div>

    <ul v-else class="space-y-3">
      <li v-for="user in users" :key="user.id" class="card space-y-3 p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="section-title">{{ user.name }}</p>
            <p class="text-[15px] text-ink-2">{{ user.email }}</p>
          </div>

          <select
            :value="user.role"
            :data-test="`papel-${user.id}`"
            :disabled="roleSavingId === user.id"
            class="input h-9 w-auto"
            :aria-label="`Papel de ${user.name}`"
            @change="changeRole(user, ($event.target as HTMLSelectElement).value as UserRole)"
          >
            <option v-for="opt in ROLE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>

        <div class="flex flex-wrap items-end gap-3 border-t border-line pt-3">
          <div class="space-y-1">
            <label :for="`senha-${user.id}`" class="field-label">Redefinir senha</label>
            <input
              :id="`senha-${user.id}`"
              v-model="resetPasswordDraft[user.id]"
              type="password"
              minlength="8"
              placeholder="Nova senha"
              class="input h-9 w-48"
            />
          </div>
          <button
            type="button"
            :disabled="resettingId === user.id || !resetPasswordDraft[user.id]?.trim()"
            class="btn-secondary"
            @click="resetPassword(user)"
          >
            {{ resettingId === user.id ? 'Salvando...' : 'Redefinir' }}
          </button>

          <template v-if="confirmingRemoveId !== user.id">
            <button type="button" class="ml-auto text-[13px] font-semibold text-danger hover:underline" @click="confirmingRemoveId = user.id">
              Remover
            </button>
          </template>
          <template v-else>
            <span class="ml-auto text-[15px] text-ink">Remover {{ user.name }}?</span>
            <button type="button" class="text-[13px] font-semibold text-ink-2 hover:text-ink" @click="confirmingRemoveId = null">
              Cancelar
            </button>
            <button type="button" :disabled="removingId === user.id" class="btn-danger-solid" @click="confirmRemove(user)">
              {{ removingId === user.id ? 'Removendo...' : 'Sim, remover' }}
            </button>
          </template>
        </div>
      </li>
    </ul>
  </div>
</template>
