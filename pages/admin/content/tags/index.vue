<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' });
</script>

<template>
  <AdminTaxonomyManager
    endpoint="/admin/content/tags"
    singular="tag"
    title="Tags"
    subtitle="Entidades editoriais (times, jogadores, competições). Surgem automaticamente ao publicar uma matéria — cada nome é validado e reaproveitado (nunca duplica 'Brasil'/'brasil'). Cada tag tem uma página pública que agrega suas matérias. Renomear não muda a URL; excluir só remove o vínculo."
  />
</template>
