<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' });
</script>

<template>
  <AdminTaxonomyManager
    endpoint="/admin/content/categories"
    singular="categoria"
    title="Categorias"
    subtitle="A seção de cada matéria (1 categoria por matéria). Surgem ao publicar — o nome sugerido é validado e reaproveitado (nunca duplica). Cada categoria tem uma página pública que agrega suas matérias. Renomear não muda a URL; excluir só desvincula (as matérias continuam)."
  />
</template>
