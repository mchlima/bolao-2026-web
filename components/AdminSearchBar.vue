<script setup lang="ts">
// Unified search input: leading magnifier + clear button. Was bespoke in
// teams.vue; now shared so every admin list searches the same way.
defineProps<{ placeholder?: string }>();
const model = defineModel<string>({ default: '' });
</script>

<template>
  <div class="searchbar">
    <AppIcon name="search" :size="16" :stroke="2" class="si" />
    <input v-model="model" class="sinput" :placeholder="placeholder ?? 'Buscar…'" />
    <button v-if="model" class="sx" type="button" title="Limpar busca" @click="model = ''">
      <AppIcon name="close" :size="14" :stroke="2.2" />
    </button>
  </div>
</template>

<style scoped>
.searchbar {
  position: relative;
  display: flex;
  align-items: center;
}
.si {
  position: absolute;
  left: 13px;
  color: var(--muted);
  pointer-events: none;
}
.sinput {
  width: 100%;
  padding: 11px 38px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--bg-base);
  color: var(--text);
  font: inherit;
  font-size: 14px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.sinput:focus {
  outline: none;
  border-color: var(--emerald);
  box-shadow: 0 0 0 3px rgba(15, 179, 107, 0.16);
}
.sx {
  position: absolute;
  right: 8px;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  border-radius: 7px;
  color: var(--muted);
  cursor: pointer;
}
.sx:hover {
  background: var(--bg-surface);
  color: var(--text);
}
</style>
