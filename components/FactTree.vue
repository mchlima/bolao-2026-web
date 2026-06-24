<script setup lang="ts">
// Árvore de fatos (JSON arbitrário) NAVEGÁVEL: cada nível (objeto/lista com conteúdo)
// expande/encolhe — encolhido por padrão. Folhas (primitivo ou objeto "raso" só com
// primitivos) aparecem inline. Recursivo (referencia a si mesmo pelo nome do arquivo).
defineProps<{ data: unknown }>();
const open = ref<Record<string, boolean>>({});
function toggle(k: string) {
  open.value[k] = !open.value[k];
}

function isArr(v: unknown): v is unknown[] {
  return Array.isArray(v);
}
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isPrim(v: unknown): boolean {
  return v === null || typeof v !== 'object';
}
function isFlatObj(v: unknown): boolean {
  return isObj(v) && Object.values(v).every(isPrim);
}
// "galho" = tem níveis a abrir (lista com itens, ou objeto não-raso com campos)
function isBranch(v: unknown): boolean {
  if (isArr(v)) return v.length > 0;
  if (isObj(v)) return !isFlatObj(v) && entries(v).length > 0;
  return false;
}
function prim(v: unknown): string {
  return v === null || v === undefined || v === '' ? '—' : String(v);
}
function entries(v: unknown): [string, unknown][] {
  return isObj(v)
    ? Object.entries(v).filter(([, val]) => val !== null && val !== undefined && val !== '')
    : [];
}
function count(v: unknown): number {
  return isArr(v) ? v.length : entries(v).length;
}
</script>

<template>
  <!-- folha primitiva -->
  <span v-if="isPrim(data)" class="ft-prim">{{ prim(data) }}</span>

  <!-- objeto raso → linha inline com os campos -->
  <span v-else-if="isFlatObj(data)" class="ft-inline">
    <span v-for="[k, v] in entries(data)" :key="k" class="ft-pair"><span class="ft-k">{{ k }}</span>{{ prim(v) }}</span>
  </span>

  <!-- lista → itens (o toggle é do campo-pai) -->
  <ul v-else-if="isArr(data)" class="ft-arr">
    <li v-for="(item, i) in (data as unknown[])" :key="i" class="ft-li"><FactTree :data="item" /></li>
  </ul>

  <!-- objeto → campos colapsáveis -->
  <ul v-else class="ft-tree">
    <li v-for="[k, v] in entries(data)" :key="k" class="ft-node">
      <template v-if="isBranch(v)">
        <button type="button" class="ft-toggle" @click="toggle(k)">
          <AppIcon :name="open[k] ? 'chevronDown' : 'chevronRight'" :size="13" :stroke="2.6" />
          <span class="ft-key">{{ k }}</span>
          <span class="ft-badge">{{ count(v) }}</span>
        </button>
        <div v-if="open[k]" class="ft-children"><FactTree :data="v" /></div>
      </template>
      <div v-else class="ft-leaf">
        <span class="ft-key">{{ k }}</span><span class="ft-leaf-v"><FactTree :data="v" /></span>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.ft-prim { color: var(--text); }
.ft-tree { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.ft-node { font-size: var(--fs-sm); }
.ft-toggle { display: flex; align-items: center; gap: 6px; width: 100%; background: none; border: none; padding: 4px 0; cursor: pointer; color: var(--text); text-align: left; border-radius: 6px; }
.ft-toggle:hover { color: var(--azure); }
.ft-key { font-weight: 700; color: var(--muted); text-transform: uppercase; font-size: var(--fs-xs); letter-spacing: 0.05em; }
.ft-toggle .ft-key { color: var(--text); }
.ft-badge { font-size: var(--fs-xs); font-weight: 700; color: var(--muted); background: var(--bg-base); border: 1px solid var(--border); border-radius: 20px; padding: 0 7px; line-height: 16px; }
.ft-children { border-left: 2px solid var(--border); padding-left: 12px; margin: 2px 0 6px 6px; }
.ft-leaf { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; padding: 3px 0; }
.ft-leaf-v { font-size: var(--fs-sm); }
.ft-arr { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.ft-li { font-size: var(--fs-sm); }
.ft-inline { display: flex; flex-wrap: wrap; gap: 3px 12px; font-size: var(--fs-sm); line-height: 1.5; }
.ft-pair { color: var(--text); }
.ft-pair .ft-k { font-weight: 700; color: var(--muted); margin-right: 4px; text-transform: none; font-size: var(--fs-xs); letter-spacing: 0; }
.ft-pair .ft-k::after { content: ':'; }
</style>
