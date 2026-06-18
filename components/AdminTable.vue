<script setup lang="ts" generic="T extends Record<string, any>">
// Shared admin list scaffold. Pages declare columns + a desktop grid template
// and fill cells via `#col-<key>` scoped slots; the component owns the header,
// loading skeleton, empty state and the responsive "card on mobile" collapse —
// killing the per-page .rows/.rhead/.row duplication.
// AdminColumn is declared globally in ~/types/admin.d.ts.

withDefaults(
  defineProps<{
    columns: AdminColumn[];
    /** desktop grid-template-columns, e.g. "minmax(0,1fr) 160px 80px auto" */
    grid: string;
    /** null/undefined = loading; [] = empty */
    rows: T[] | null | undefined;
    rowKey?: (row: T, i: number) => string | number;
    /** optional extra class per row (e.g. to highlight a live match) */
    rowClass?: (row: T, i: number) => string | undefined;
    /** make the whole row a link to this target (falsy = not a link) */
    rowTo?: (row: T, i: number) => string | null | undefined;
    /** aria-label for the row link (defaults to "Abrir") */
    rowLabel?: (row: T, i: number) => string;
    empty?: string;
    emptyIcon?: string;
    skeleton?: number;
    /** hide the column header row */
    hideHead?: boolean;
  }>(),
  {
    rowKey: (row: any, i: number) => row?.id ?? i,
    empty: 'Nenhum registro.',
    emptyIcon: 'inbox',
    skeleton: 8,
  },
);
</script>

<template>
  <SkeletonList v-if="rows == null" variant="row" :count="skeleton" />

  <div v-else-if="!rows.length" class="atable-empty">
    <AppIcon :name="emptyIcon" :size="34" :stroke="1.6" />
    <p>{{ empty }}</p>
  </div>

  <div v-else class="atable" :style="{ '--cols': grid }">
    <div v-if="!hideHead" class="atr-head">
      <span v-for="c in columns" :key="c.key" :class="[c.align === 'end' && 'end', c.mobileHide && 'm-hide']">{{ c.label }}</span>
    </div>
    <div v-for="(row, i) in rows" :key="rowKey(row, i)" class="atr-row" :class="[rowClass?.(row, i), rowTo?.(row, i) && 'has-link']">
      <!-- whole-row link; interactive cells are raised above it via z-index -->
      <NuxtLink
        v-if="rowTo?.(row, i)"
        :to="rowTo(row, i) as string"
        class="atr-link"
        :aria-label="rowLabel?.(row, i) ?? 'Abrir'"
      />
      <span
        v-for="c in columns"
        :key="c.key"
        class="atr-cell"
        :class="[c.align === 'end' && 'end', c.mobileHide && 'm-hide', c.key === columns[0].key && 'is-primary', c.key === 'actions' && 'is-actions']"
        :data-label="c.label"
      >
        <slot :name="`col-${c.key}`" :row="row" />
      </span>
    </div>
  </div>
</template>

<style scoped>
.atable {
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
}
.atr-head,
.atr-row {
  display: grid;
  grid-template-columns: var(--cols);
  gap: 10px;
  padding: 11px 15px;
  align-items: center;
}
.atr-head {
  background: var(--bg-base);
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}
.atr-row {
  position: relative;
  border-top: 1px solid var(--border);
  transition: background 0.12s;
}
.atr-row:hover {
  background: color-mix(in srgb, var(--muted) 5%, transparent);
}
/* stretched row link — covers the row so it behaves as one button */
.atr-link {
  position: absolute;
  inset: 0;
  z-index: 1;
}
.atr-row.has-link:hover {
  background: color-mix(in srgb, var(--muted) 9%, transparent);
}
.end {
  text-align: right;
  justify-self: end;
}
.atr-cell {
  min-width: 0;
}

/* empty state */
.atable-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 46px 18px;
  border: 1px dashed var(--border);
  border-radius: 14px;
  color: var(--muted);
  text-align: center;
}
.atable-empty p {
  font-size: 13.5px;
  font-weight: 600;
}

/* ── card on mobile ── */
@media (max-width: 720px) {
  .atr-head {
    display: none;
  }
  .atr-row {
    grid-template-columns: 1fr;
    gap: 7px;
    padding: 13px 15px;
  }
  .atr-cell {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    min-height: 22px;
  }
  /* specificity must beat `.atr-cell { display: flex }` above */
  .atr-cell.m-hide {
    display: none;
  }
  .atr-cell.end {
    justify-self: stretch;
    text-align: left;
  }
  /* secondary cells: show the column label on the left, value on the right */
  .atr-cell:not(.is-primary):not(.is-actions)::before {
    content: attr(data-label);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--muted);
    flex: none;
  }
  .atr-cell.is-primary {
    padding-bottom: 4px;
  }
  .atr-cell.is-actions {
    justify-content: flex-start;
    gap: 7px;
    margin-top: 4px;
    padding-top: 11px;
    border-top: 1px solid var(--border);
  }
}
</style>
