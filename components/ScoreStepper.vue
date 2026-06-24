<script setup lang="ts">
// Score stepper: the number in the middle with a chevron on each side. Vertical
// by default (chevron-up on top, chevron-down on bottom); `horizontal` lays the
// chevrons to the left (–) and right (+) of the number instead. Shows "–" when
// the value is null (no palpite yet). Emits a delta (+1 / -1); the parent clamps.
defineProps<{ value: number | null; label?: string; readonly?: boolean; horizontal?: boolean }>();
const emit = defineEmits<{ bump: [delta: number] }>();
</script>

<template>
  <div class="stp" :class="{ horizontal }">
    <button v-if="!readonly" type="button" class="stp-b inc" :aria-label="`Aumentar ${label ?? ''}`" @click="emit('bump', 1)">
      <AppIcon :name="horizontal ? 'chevronRight' : 'chevronUp'" :size="18" :stroke="2.6" />
    </button>
    <span class="stp-n" :class="{ none: value === null }">{{ value ?? '–' }}</span>
    <button v-if="!readonly" type="button" class="stp-b dec" :aria-label="`Diminuir ${label ?? ''}`" @click="emit('bump', -1)">
      <AppIcon :name="horizontal ? 'chevronLeft' : 'chevronDown'" :size="18" :stroke="2.6" />
    </button>
  </div>
</template>

<style scoped>
.stp {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
}
/* horizontal: ‹ n › — chevron-left (–) and chevron-right (+) flank the number.
   Order swaps so decrease sits on the left and increase on the right. */
.stp.horizontal {
  flex-direction: row;
}
.stp.horizontal .dec { order: 1; }
.stp.horizontal .stp-n { order: 2; }
.stp.horizontal .inc { order: 3; }
.stp.horizontal .stp-b {
  width: 22px;
  height: 30px;
}
.stp.horizontal .stp-n {
  width: 22px;
}
.stp-b {
  display: grid;
  place-items: center;
  height: 24px;
  width: 38px;
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  padding: 0;
}
.stp-b:hover {
  color: var(--text);
}
.stp-b:active {
  color: var(--gold);
}
.stp-n {
  width: 38px;
  text-align: center;
  padding: 1px 0;
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: var(--fs-lg);
  line-height: 1;
}
/* placeholder "–" (sem palpite) em muted, igual ao traço do placar real */
.stp-n.none {
  color: var(--muted);
}
</style>
