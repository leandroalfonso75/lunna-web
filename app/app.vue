<script setup lang="ts">
import { computed } from 'vue'
import { useLayoutPref } from './composables/useLayoutPref'
import { themeAntiFlashScript } from './lib/theme'

// Novo layout (27/11/2026): a casca nova (`layouts/novo.vue`) ou a de antes (`default`), pela preferência salva no
// navegador; página sem layout (login, cadastro) continua sem.
const route = useRoute()
const layoutPref = useLayoutPref()
const layoutName = computed(() => (route.meta.layout === false ? false : layoutPref.pref.value === 'novo' ? 'novo' : 'default'))

/**
 * `titleTemplate` como função (o tipo de `app.head` no `nuxt.config` só
 * aceita string, e `'%s · Lunna'` sobre o `title` padrão rendia
 * "Lunna · Lunna" em toda página sem título próprio).
 *
 * `script`: o anti-flash do tema. `tagPosition: 'head'` + `tagPriority:
 * 'critical'` colocam este `<script>` antes de qualquer outra coisa no
 * `<head>` — precisa rodar e pôr `data-theme` no `<html>` ANTES da primeira
 * pintura, senão a página nasce clara e pisca para escura no primeiro tick
 * (ou vice-versa) sempre que o tema salvo diverge do `prefers-color-scheme`
 * do sistema.
 */
useHead({
  titleTemplate: (title?: string) => (title && title !== 'Lunna' ? `${title} · Lunna` : 'Lunna'),
  script: [
    {
      innerHTML: themeAntiFlashScript(),
      tagPosition: 'head',
      tagPriority: 'critical'
    }
  ]
})
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout :name="layoutName">
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
