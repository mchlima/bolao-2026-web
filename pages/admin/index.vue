<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' });

// Período selecionado (reflete no gráfico). Padrão: mês atual desde o dia 1 → hoje.
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const _now = new Date();
const range = ref({
  from: ymd(new Date(_now.getFullYear(), _now.getMonth(), 1)),
  to: ymd(_now),
});
// A presença ao vivo (pessoas/dispositivos) foi pro centro do topbar
// (components/AdminTopPresence.vue), visível em todas as telas do admin.
</script>

<template>
  <div>
    <AdminPageHeader title="Dashboard" subtitle="Visão geral do torneio.">
      <template #actions>
        <AdminDateRange v-model="range" />
      </template>
    </AdminPageHeader>

    <AdminPredictionsChart :from="range.from" :to="range.to" />

    <AdminSpendChart :from="range.from" :to="range.to" />
  </div>
</template>
