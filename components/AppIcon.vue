<script setup lang="ts">
// Central stroke-icon registry — replaces the ad-hoc emoji (✎ 🗑 ★ ⟳ ⏻ ●) and
// inline <svg> blocks scattered across the admin. Same visual language as the
// sidebar nav: 24×24 viewBox, no fill, currentColor stroke, round joins.
const props = withDefaults(defineProps<{ name: string; size?: number | string; stroke?: number }>(), {
  size: 18,
  stroke: 1.9,
});

// Each entry is one or more SVG path `d` strings.
const ICONS: Record<string, string[]> = {
  // actions
  edit: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z'],
  trash: ['M3 6h18', 'M8 6V4h8v2', 'M6 6l1 14h10l1-14', 'M10 11v6', 'M14 11v6'],
  plus: ['M12 5v14', 'M5 12h14'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'm21 21-4.3-4.3'],
  filter: ['M3 5h18', 'M6 12h12', 'M10 19h4'],
  chevronDown: ['m6 9 6 6 6-6'],
  chevronRight: ['m9 6 6 6-6 6'],
  chevronLeft: ['m15 6-6 6 6 6'],
  chevronUp: ['m6 15 6-6 6 6'],
  arrowLeft: ['M19 12H5', 'm12 19-7-7 7-7'],
  arrowRight: ['M5 12h14', 'm12 5 7 7-7 7'],
  arrowUp: ['M12 19V5', 'm5 12 7-7 7 7'],
  arrowDown: ['M12 5v14', 'm5 12 7 7 7-7'],
  check: ['M20 6 9 17l-5-5'],
  mapPin: ['M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11z', 'M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
  star: ['M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.6 1-5.8L3.5 9.7l5.9-.9z'],
  refresh: ['M21 12a9 9 0 1 1-2.6-6.4', 'M21 4v4h-4'],
  power: ['M12 4v8', 'M7 7a7 7 0 1 0 10 0'],
  externalLink: ['M14 4h6v6', 'M20 4l-9 9', 'M19 14v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
  share: ['M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M8.6 13.5l6.8 4', 'M15.4 6.5l-6.8 4'],
  // entities (mirror the sidebar nav glyphs)
  dashboard: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
  trophy: ['M6 4h12v3a6 6 0 0 1-12 0Z', 'M6 5H3v1a3 3 0 0 0 3 3', 'M18 5h3v1a3 3 0 0 1-3 3', 'M9 19h6', 'M12 13v6'],
  calendar: ['M3 5h18v16H3z', 'M3 9h18', 'M8 3v4', 'M16 3v4'],
  ball: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 8l3.2 2.3-1.2 3.7h-4l-1.2-3.7z'],
  shield: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z'],
  stadium: ['M3 9c0-2 4-3 9-3s9 1 9 3-4 3-9 3-9-1-9-3z', 'M3 9v6c0 2 4 3 9 3s9-1 9-3V9', 'M8 11.5v6', 'M16 11.5v6'],
  users: ['M16 19v-1a4 4 0 0 0-8 0v1', 'M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6', 'M21 19v-1a3 3 0 0 0-2.4-2.9'],
  user: ['M16 19v-1a4 4 0 0 0-8 0v1', 'M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6'],
  live: ['M9 8a5 5 0 0 0 0 8', 'M15 8a5 5 0 0 1 0 8', 'M6 5a9 9 0 0 0 0 14', 'M18 5a9 9 0 0 1 0 14', 'M12 11.5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1z'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7v5l3 2'],
  pause: ['M10 4v16', 'M14 4v16'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  inbox: ['M3 13h5l1.5 3h5L21 13', 'M5 5h14l2 8v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5z'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3.5 6h.01', 'M3.5 12h.01', 'M3.5 18h.01'],
  bell: ['M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9', 'M13.7 21a2 2 0 0 1-3.4 0'],
};

const paths = computed(() => ICONS[props.name] ?? []);
</script>

<template>
  <svg
    class="app-icon"
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    fill="none"
    stroke="currentColor"
    :stroke-width="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(d, i) in paths" :key="i" :d="d" />
  </svg>
</template>

<style scoped>
.app-icon {
  display: block;
  flex: none;
}
</style>
