<script setup lang="ts">
import { Dialog, DialogPanel, DialogTitle, Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import { EllipsisVerticalIcon, PlusIcon } from '@heroicons/vue/24/outline'
import { onMounted, reactive, ref } from 'vue'
import { useToast } from '../../composables/useToast'
import { apiErrorMessage } from '../../lib/apiErrors'
import type { SettingsClient } from '../../lib/settingsClient'
import { useSessionStore } from '../../stores/session'
import type { User, UserRole } from '../../types/api'
import SettingsSkeleton from './SettingsSkeleton.vue'

const props = defineProps<{ settingsApi: SettingsClient }>()
const emit = defineEmits<{ loaded: [count: number] }>()
const toast = useToast()
const session = useSessionStore()

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'member', label: 'Membro' }
]

function roleLabel(role: UserRole): string {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role
}

function otherRole(role: UserRole): UserRole {
  return role === 'admin' ? 'member' : 'admin'
}

function toggleRoleLabel(role: UserRole): string {
  return otherRole(role) === 'admin' ? 'Tornar administrador' : 'Tornar membro'
}

/** Iniciais do nome (até 2 letras) para o avatar da linha. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase() || '?'
}

/** A API recusa remover o próprio usuário — nem mostramos a opção. */
function isSelf(user: User): boolean {
  return user.id === session.user?.id
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
    emit('loaded', users.value.length)
  }
}

onMounted(load)

// --- Adicionar (diálogo acessível) ------------------------------------------
const addDialogOpen = ref(false)
const newName = ref('')
const newEmail = ref('')
const newPassword = ref('')
const newRole = ref<UserRole>('member')
const creating = ref(false)
const createError = ref('')

function openAddDialog() {
  createError.value = ''
  addDialogOpen.value = true
}

function closeAddDialog() {
  addDialogOpen.value = false
}

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
    emit('loaded', users.value.length)
    newName.value = ''
    newEmail.value = ''
    newPassword.value = ''
    newRole.value = 'member'
    toast.success('Usuário adicionado.')
    closeAddDialog()
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
    toast.success('Papel atualizado.')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível trocar o papel agora. Tente de novo.'))
  } finally {
    roleSavingId.value = null
  }
}

// --- Redefinir senha ---------------------------------------------------------
const resetOpenId = ref<string | null>(null)
const resettingId = ref<string | null>(null)
const resetPasswordDraft = reactive<Record<string, string>>({})

function toggleReset(user: User) {
  resetOpenId.value = resetOpenId.value === user.id ? null : user.id
}

async function resetPassword(user: User) {
  const password = resetPasswordDraft[user.id]?.trim()
  if (!password) return
  resettingId.value = user.id
  try {
    await props.settingsApi.updateUser(user.id, { password })
    resetPasswordDraft[user.id] = ''
    resetOpenId.value = null
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
    emit('loaded', users.value.length)
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
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="section-title">Usuários</h2>
        <p class="page-subtitle text-[13px]">Quem tem acesso ao painel da sua empresa.</p>
      </div>
      <button type="button" data-test="adicionar-usuario" class="btn-primary" @click="openAddDialog">
        <PlusIcon class="h-4 w-4" aria-hidden="true" />
        Adicionar usuário
      </button>
    </div>

    <SettingsSkeleton v-if="loading" :rows="3" />

    <div v-else-if="loadError" class="card p-6 text-center" role="alert">
      <p class="text-[15px] text-danger">{{ loadError }}</p>
      <button type="button" class="btn-link mt-3" @click="load">Tentar de novo</button>
    </div>

    <div v-else-if="!users.length" class="empty-state">
      <p class="text-[15px] text-ink-2">Nenhum usuário cadastrado ainda.</p>
      <button type="button" class="btn-primary" @click="openAddDialog">Adicionar usuário</button>
    </div>

    <ul v-else class="space-y-3">
      <li v-for="user in users" :key="user.id" :data-test="`linha-usuario-${user.id}`" class="card space-y-3 p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-3">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[13px] font-semibold text-primary">
              {{ initials(user.name) }}
            </div>
            <div class="min-w-0">
              <p class="flex items-center gap-2 truncate text-[15px] font-medium text-ink">
                {{ user.name }}
                <span v-if="isSelf(user)" data-test="voce" class="pill-neutral">Você</span>
              </p>
              <p class="truncate text-[13px] text-ink-2">{{ user.email }}</p>
            </div>
          </div>

          <div class="flex shrink-0 items-center gap-2">
            <span :data-test="`papel-${user.id}`" :class="user.role === 'admin' ? 'pill-primary' : 'pill-neutral'">
              {{ roleLabel(user.role) }}
            </span>

            <Menu v-slot="{ open }" as="div" class="relative">
              <MenuButton :data-test="`acoes-usuario-${user.id}`" class="btn-ghost" :aria-label="`Ações para ${user.name}`">
                <EllipsisVerticalIcon class="h-5 w-5" aria-hidden="true" />
              </MenuButton>
              <MenuItems
                static
                v-show="open"
                class="absolute right-0 z-10 mt-1 w-52 rounded-card border border-line bg-surface py-1 shadow-card focus:outline-none"
              >
                <MenuItem v-slot="{ active }">
                  <button
                    type="button"
                    :disabled="roleSavingId === user.id"
                    :class="['block w-full px-3 py-2 text-left text-[14px]', active ? 'bg-surface-2 text-ink' : 'text-ink-2']"
                    @click="changeRole(user, otherRole(user.role))"
                  >
                    {{ toggleRoleLabel(user.role) }}
                  </button>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <button
                    type="button"
                    :class="['block w-full px-3 py-2 text-left text-[14px]', active ? 'bg-surface-2 text-ink' : 'text-ink-2']"
                    @click="toggleReset(user)"
                  >
                    Redefinir senha
                  </button>
                </MenuItem>
                <MenuItem v-if="!isSelf(user)" v-slot="{ active }">
                  <button
                    type="button"
                    :data-test="`remover-usuario-${user.id}`"
                    :class="['block w-full px-3 py-2 text-left text-[14px] text-danger', active ? 'bg-danger-soft' : '']"
                    @click="confirmingRemoveId = user.id"
                  >
                    Remover
                  </button>
                </MenuItem>
              </MenuItems>
            </Menu>
          </div>
        </div>

        <div v-if="resetOpenId === user.id" class="flex flex-wrap items-end gap-3 border-t border-line pt-3">
          <div class="space-y-1">
            <label :for="`senha-${user.id}`" class="field-label">Nova senha</label>
            <input
              :id="`senha-${user.id}`"
              v-model="resetPasswordDraft[user.id]"
              type="password"
              minlength="8"
              placeholder="Mínimo de 8 caracteres"
              class="input h-9 w-56"
            />
          </div>
          <button
            type="button"
            :disabled="resettingId === user.id || !resetPasswordDraft[user.id]?.trim()"
            class="btn-secondary"
            @click="resetPassword(user)"
          >
            {{ resettingId === user.id ? 'Salvando...' : 'Salvar senha' }}
          </button>
          <button type="button" class="text-[13px] font-semibold text-ink-2 hover:text-ink" @click="resetOpenId = null">Cancelar</button>
        </div>

        <div v-if="confirmingRemoveId === user.id" class="flex flex-wrap items-center gap-3 border-t border-line pt-3">
          <span class="text-[15px] text-ink">Remover {{ user.name }}?</span>
          <button type="button" class="text-[13px] font-semibold text-ink-2 hover:text-ink" @click="confirmingRemoveId = null">Cancelar</button>
          <button type="button" :disabled="removingId === user.id" class="btn-danger-solid" @click="confirmRemove(user)">
            {{ removingId === user.id ? 'Removendo...' : 'Sim, remover' }}
          </button>
        </div>
      </li>
    </ul>

    <!-- Diálogo "Adicionar usuário" (headlessui: foco preso, Esc/clique fora fecha) -->
    <Dialog :open="addDialogOpen" class="relative z-50" @close="closeAddDialog">
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="card w-full max-w-md space-y-4 p-6">
          <DialogTitle class="section-title">Adicionar usuário</DialogTitle>

          <form class="space-y-4" @submit.prevent="createUser">
            <div class="space-y-1">
              <label for="novo-nome" class="field-label">Nome</label>
              <input id="novo-nome" v-model="newName" data-test="novo-nome" type="text" required class="input" />
            </div>
            <div class="space-y-1">
              <label for="novo-email" class="field-label">E-mail</label>
              <input id="novo-email" v-model="newEmail" data-test="novo-email" type="email" autocomplete="email" required class="input" />
            </div>
            <div class="space-y-1">
              <label for="nova-senha" class="field-label">Senha inicial</label>
              <input
                id="nova-senha"
                v-model="newPassword"
                data-test="nova-senha"
                type="password"
                autocomplete="new-password"
                minlength="8"
                required
                class="input"
              />
              <p class="text-[13px] text-ink-3">Mínimo de 8 caracteres.</p>
            </div>
            <div class="space-y-1">
              <label for="novo-papel" class="field-label">Papel</label>
              <select id="novo-papel" v-model="newRole" data-test="novo-papel" class="input">
                <option v-for="opt in ROLE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>

            <p v-if="createError" role="alert" class="text-[15px] text-danger">{{ createError }}</p>

            <div class="flex justify-end gap-3 pt-2">
              <button type="button" class="btn-secondary" @click="closeAddDialog">Cancelar</button>
              <button type="submit" data-test="salvar-novo-usuario" :disabled="creating" class="btn-primary">
                {{ creating ? 'Adicionando...' : 'Adicionar usuário' }}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  </div>
</template>
