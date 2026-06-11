<script setup lang="ts">
import type { PaginationMeta } from '~/types/api';

const props = defineProps<{ pagination: PaginationMeta; modelValue: number }>();
const emit = defineEmits<{ 'update:modelValue': [number] }>();

const totalPages = computed(() => props.pagination.totalPages);
const canPrev = computed(() => props.modelValue > 1);
const canNext = computed(() => props.modelValue < totalPages.value);

const nums = computed(() => {
  const cur = props.modelValue;
  const last = totalPages.value;
  const out: number[] = [];
  const from = Math.max(1, cur - 2);
  const to = Math.min(last, from + 4);
  for (let i = from; i <= to; i++) out.push(i);
  return out;
});

const info = computed(() => {
  const { page, pageSize, total } = props.pagination;
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return `${start}–${end} de ${total}`;
});

function go(n: number) {
  if (n >= 1 && n <= totalPages.value) emit('update:modelValue', n);
}
</script>

<template>
  <div v-if="pagination.total > pagination.pageSize" class="pager">
    <span class="info">{{ info }}</span>
    <div class="ctrls">
      <button class="pg" :disabled="!canPrev" @click="go(1)">«</button>
      <button class="pg" :disabled="!canPrev" @click="go(modelValue - 1)">‹</button>
      <button
        v-for="n in nums"
        :key="n"
        class="pg"
        :class="{ on: n === modelValue }"
        @click="go(n)"
      >{{ n }}</button>
      <button class="pg" :disabled="!canNext" @click="go(modelValue + 1)">›</button>
      <button class="pg" :disabled="!canNext" @click="go(totalPages)">»</button>
    </div>
  </div>
</template>

<style scoped>
.pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
.info {
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
}
.ctrls {
  display: flex;
  gap: 5px;
}
.pg {
  min-width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font-weight: 700;
  font-size: 13px;
}
.pg:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.pg.on {
  background: var(--gold);
  color: #0a0e14;
  border-color: transparent;
}
</style>
