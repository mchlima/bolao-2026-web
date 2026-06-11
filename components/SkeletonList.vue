<script setup lang="ts">
withDefaults(
  defineProps<{ count?: number; variant?: 'card' | 'row' | 'match' }>(),
  { count: 6, variant: 'card' },
);
</script>

<template>
  <div :class="variant === 'row' ? 'sk-list' : 'sk-grid'" :data-variant="variant">
    <div
      v-for="i in count"
      :key="i"
      :class="variant === 'row' ? 'sk-row' : variant === 'match' ? 'sk-match' : 'sk-card'"
    >
      <template v-if="variant === 'card'">
        <div class="skeleton emblem" />
        <div class="lines">
          <div class="skeleton" style="height: 15px; width: 65%" />
          <div class="skeleton" style="height: 11px; width: 40%" />
        </div>
      </template>
      <template v-else-if="variant === 'row'">
        <div class="skeleton" style="height: 34px; width: 34px; border-radius: 50%; flex: 0 0 auto" />
        <div class="skeleton" style="height: 13px; flex: 1" />
        <div class="skeleton" style="height: 13px; width: 70px; flex: 0 0 auto" />
      </template>
      <template v-else>
        <div class="top">
          <div class="skeleton" style="height: 10px; width: 90px" />
          <div class="skeleton" style="height: 18px; width: 64px; border-radius: 999px" />
        </div>
        <div class="mid">
          <div class="skeleton circle" />
          <div class="skeleton" style="height: 36px; width: 60px" />
          <div class="skeleton circle" />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.sk-grid { display: grid; gap: 14px; }
.sk-grid[data-variant='card'] { grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); }
.sk-grid[data-variant='match'] { grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); }
.sk-list { display: flex; flex-direction: column; gap: 8px; }
.sk-card { display: flex; align-items: center; gap: 13px; padding: 18px; border: 1px solid var(--border); border-radius: 18px; background: var(--bg-surface); }
.emblem { height: 46px; width: 46px; border-radius: 13px; flex: 0 0 auto; }
.lines { flex: 1; display: flex; flex-direction: column; gap: 9px; }
.sk-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 13px; background: var(--bg-surface); }
.sk-match { padding: 16px; border: 1px solid var(--border); border-radius: 18px; background: var(--bg-surface); }
.sk-match .top { display: flex; justify-content: space-between; margin-bottom: 16px; }
.sk-match .mid { display: flex; align-items: center; justify-content: space-around; }
.circle { height: 50px; width: 50px; border-radius: 50%; }
</style>
