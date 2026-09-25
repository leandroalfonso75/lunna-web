// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // Painel roda em 3101 em dev local (a API roda em 3100).
  devServer: {
    port: 3101
  },

  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],

  app: {
    head: {
      // O `titleTemplate` mora em `app/app.vue`, via `useHead` — aqui o tipo
      // exige uma string, e um `title` padrão aqui rendia "Lunna · Lunna" em
      // toda página sem título próprio.
      title: 'Lunna',
      htmlAttrs: { lang: 'pt-BR' }
    }
  },

  runtimeConfig: {
    public: {
      // Sobrescrito em runtime por NUXT_PUBLIC_API_URL. Este valor é só o
      // fallback local (API do Lunna em dev).
      apiUrl: 'http://localhost:3100'
    }
  },

  css: ['~/assets/css/tokens.css']
})
