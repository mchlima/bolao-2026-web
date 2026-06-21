<script setup lang="ts">
// Renderiza um valor de "fatos" (JSON arbitrário) de forma ESTRUTURADA e legível:
// objeto → pares rótulo/valor; lista → itens; objeto "raso" (só primitivos) → linha
// inline com os campos. Recursivo (referencia a si mesmo pelo nome do arquivo).
defineProps<{ data: unknown }>();

function isArr(v: unknown): v is unknown[] {
  return Array.isArray(v);
}
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isPrim(v: unknown): boolean {
  return v === null || typeof v !== 'object';
}
// objeto cujos valores são todos primitivos → cabe numa linha só
function isFlatObj(v: unknown): v is Record<string, unknown> {
  return isObj(v) && Object.values(v).every(isPrim);
}
function prim(v: unknown): string {
  return v === null || v === undefined || v === '' ? '—' : String(v);
}
function entries(v: Record<string, unknown>): [string, unknown][] {
  return Object.entries(v).filter(([, val]) => val !== null && val !== undefined && val !== '');
}
</script>

<template>
  <span v-if="isPrim(data)" class="ft-prim">{{ prim(data) }}</span>

  <div v-else-if="isFlatObj(data)" class="ft-inline">
    <span v-for="[k, v] in entries(data as Record<string, unknown>)" :key="k" class="ft-pair">
      <span class="ft-k">{{ k }}</span>{{ prim(v) }}
    </span>
  </div>

  <ul v-else-if="isArr(data)" class="ft-arr">
    <li v-for="(item, i) in (data as unknown[])" :key="i" class="ft-li">
      <FactTree :data="item" />
    </li>
  </ul>

  <dl v-else-if="isObj(data)" class="ft-obj">
    <template v-for="[k, v] in entries(data as Record<string, unknown>)" :key="k">
      <dt class="ft-dt">{{ k }}</dt>
      <dd class="ft-dd"><FactTree :data="v" /></dd>
    </template>
  </dl>
</template>

<style scoped>
.ft-prim { color: var(--text); }
.ft-obj { margin: 0; display: flex; flex-direction: column; gap: 8px; }
.ft-dt { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 2px; }
.ft-dd { margin: 0; font-size: 13px; }
/* aninhamento ganha uma guia à esquerda */
.ft-dd > .ft-obj, .ft-dd > .ft-arr { border-left: 2px solid var(--border); padding-left: 10px; margin-top: 4px; }
.ft-arr { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.ft-li { font-size: 13px; }
.ft-inline { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 13px; line-height: 1.5; }
.ft-pair { color: var(--text); }
.ft-k { font-weight: 700; color: var(--muted); margin-right: 4px; }
.ft-k::after { content: ':'; }
</style>
