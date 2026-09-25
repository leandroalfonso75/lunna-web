<script setup lang="ts">
import { themeAntiFlashScript } from './lib/theme'

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
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
