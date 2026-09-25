<script setup lang="ts">
import { ref } from 'vue'
import AuthSplitLayout from '../components/auth/AuthSplitLayout.vue'
import { apiErrorMessage } from '../lib/apiErrors'

definePageMeta({ layout: false })

const auth = useAuth()

const companyName = ref('')
const name = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

const criarConta = async () => {
  errorMessage.value = ''
  loading.value = true
  try {
    await auth.signup({
      companyName: companyName.value,
      name: name.value,
      email: email.value,
      password: password.value
    })
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Não foi possível criar sua conta. Confira os dados e tente de novo.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthSplitLayout>
    <form class="card space-y-5 p-8" @submit.prevent="criarConta">
      <h2 class="text-[18px] text-ink">Criar conta</h2>

      <div class="space-y-1.5">
        <label for="company-name" class="field-label">Nome da empresa</label>
        <input id="company-name" v-model="companyName" type="text" required class="input" />
      </div>

      <div class="space-y-1.5">
        <label for="name" class="field-label">Seu nome</label>
        <input id="name" v-model="name" type="text" autocomplete="name" required class="input" />
      </div>

      <div class="space-y-1.5">
        <label for="email" class="field-label">E-mail</label>
        <input id="email" v-model="email" type="email" autocomplete="email" required class="input" />
      </div>

      <div class="space-y-1.5">
        <label for="password" class="field-label">Senha</label>
        <input
          id="password"
          v-model="password"
          type="password"
          autocomplete="new-password"
          required
          minlength="8"
          class="input"
        />
      </div>

      <p v-if="errorMessage" role="alert" class="text-[15px] text-danger">{{ errorMessage }}</p>

      <button type="submit" :disabled="loading" data-test="signup-submit" class="btn-primary w-full">
        {{ loading ? 'Criando...' : 'Criar conta' }}
      </button>

      <p class="text-center text-[15px] text-ink-2">
        Já tem conta?
        <NuxtLink to="/login" class="btn-link">Entrar</NuxtLink>
      </p>
    </form>
  </AuthSplitLayout>
</template>
