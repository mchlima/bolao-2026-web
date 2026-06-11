<script setup lang="ts">
const colorMode = useColorMode()
const { public: { apiBase } } = useRuntimeConfig()
</script>

<template>
  <main class="home">
    <h1>Amigos do Bolão</h1>
    <p>Scaffold inicial — seguir o protótipo "Estádio 26" (Claude Design).</p>
    <p class="muted">API: {{ apiBase }}</p>
    <label class="muted">
      Tema:
      <select v-model="colorMode.preference">
        <option value="system">Sistema</option>
        <option value="light">Claro</option>
        <option value="dark">Escuro</option>
      </select>
    </label>
  </main>
</template>

<style scoped>
.home {
  max-width: 40rem;
  margin: 4rem auto;
  padding: 0 1.5rem;
  font-family: system-ui, sans-serif;
}
.muted {
  color: var(--color-muted, #888);
  display: block;
  margin-top: 0.75rem;
}
</style>
