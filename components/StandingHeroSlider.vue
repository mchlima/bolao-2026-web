<script setup lang="ts">
import type { MyStandingsResponse } from '~/types/api';
// "Sua posição" on the início: a horizontal slider of the user's standing in every
// scope they play. Grouped by tournament — for each, a GERAL (season-wide) card
// followed by the user's pools in that tournament. Self-contained: fetches
// /me/standings and re-fetches live as goals/results land (subscribes to every
// tournament shown). Falls back to nothing rendered when the user plays no scope.
const api = useApi();
const { data, refresh } = await useAsyncData('home-standings', () =>
  api<MyStandingsResponse>('/me/standings'),
);

// Flatten the grouped response into the ordered list of cards the slider renders:
// [GERAL t1, ...pools t1, GERAL t2, ...pools t2]. CTA (shown when the user hasn't
// predicted) always points at the tournament hub, where palpites are made.
interface Slide {
  key: string;
  title: string;
  subtitle: string;
  me: MyStandingsResponse['tournaments'][number]['general']['me'];
  total: number;
  ctaTo: string; // palpites (tournament hub) — used by the card's CTA when me is null
  linkTo: string; // that scope's ranking — the whole slide links here once the user has predicted
}
const slides = computed<Slide[]>(() => {
  const out: Slide[] = [];
  for (const t of data.value?.tournaments ?? []) {
    const ctaTo = `/futebol/torneios/${t.id}`;
    out.push({
      key: `gen-${t.id}`,
      title: 'GERAL',
      subtitle: t.name,
      me: t.general.me,
      total: t.general.total,
      ctaTo,
      linkTo: `/futebol/torneios/${t.id}/ranking`,
    });
    for (const p of t.pools)
      out.push({
        key: `pool-${p.poolId}`,
        title: p.name,
        subtitle: t.name,
        me: p.me,
        total: p.total,
        ctaTo,
        linkTo: `/pools/${p.poolId}`,
      });
  }
  return out;
});

// Live: the standing moves as the score does — subscribe to every tournament shown.
const liveChannels = computed(() =>
  (data.value?.tournaments ?? []).map((t) => `tournament:${t.id}`),
);
useRealtime(() => liveChannels.value, () => refresh());

// Active dot: the slide whose center sits closest to the viewport center.
const track = ref<HTMLElement | null>(null);
const active = ref(0);
function onScroll() {
  const el = track.value;
  if (!el) return;
  const center = el.scrollLeft + el.clientWidth / 2;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < el.children.length; i++) {
    const c = el.children[i] as HTMLElement;
    const cc = c.offsetLeft + c.offsetWidth / 2;
    const d = Math.abs(cc - center);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  active.value = best;
}
function goTo(i: number) {
  const el = track.value;
  const c = el?.children[i] as HTMLElement | undefined;
  if (el && c) el.scrollTo({ left: c.offsetLeft - (el.clientWidth - c.offsetWidth) / 2, behavior: 'smooth' });
}
// Desktop nav (chevrons replace the dots — see the media queries below).
function step(dir: -1 | 1) {
  goTo(Math.min(Math.max(active.value + dir, 0), slides.value.length - 1));
}
const atStart = computed(() => active.value <= 0);
const atEnd = computed(() => active.value >= slides.value.length - 1);
</script>

<template>
  <div v-if="slides.length" class="shs">
    <button
      v-if="slides.length > 1"
      type="button"
      class="shs-nav prev"
      :disabled="atStart"
      aria-label="Anterior"
      @click="step(-1)"
    >
      <AppIcon name="chevronLeft" :size="38" :stroke="2" />
    </button>
    <button
      v-if="slides.length > 1"
      type="button"
      class="shs-nav next"
      :disabled="atEnd"
      aria-label="Próximo"
      @click="step(1)"
    >
      <AppIcon name="chevronRight" :size="38" :stroke="2" />
    </button>
    <div ref="track" class="shs-track" @scroll.passive="onScroll">
      <!-- Tap the slide to open that scope's ranking — but only once the user has
           predicted (me != null). While me is null the card shows its own "fazer
           palpites" CTA link, so wrapping it would nest <a> in <a>. -->
      <component
        :is="s.me ? 'NuxtLink' : 'div'"
        v-for="s in slides"
        :key="s.key"
        :to="s.me ? s.linkTo : undefined"
        class="shs-slide"
      >
        <StandingHero :me="s.me" :total="s.total" :title="s.title" :subtitle="s.subtitle" :cta-to="s.ctaTo" />
      </component>
    </div>
    <div v-if="slides.length > 1" class="shs-dots">
      <button
        v-for="(s, i) in slides"
        :key="s.key"
        type="button"
        class="shs-dot"
        :class="{ on: i === active }"
        :aria-label="`Ir para ${s.title}`"
        @click="goTo(i)"
      />
    </div>
  </div>
</template>

<style scoped>
.shs {
  position: relative;
}
.shs-track {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  /* bleed to the page edges so the peeked next card hugs the screen edge */
  margin: 0 -10px;
  padding: 0 10px;
}
.shs-track::-webkit-scrollbar {
  display: none;
}
.shs-slide {
  flex: 0 0 auto;
  /* one card at a time, with the next peeking to signal the slider */
  width: 88%;
  max-width: 460px;
  scroll-snap-align: center;
  color: inherit;
  text-decoration: none;
  border-radius: 18px; /* match the card so the tap highlight is rounded */
}
/* a single scope → no peek, fill the row like the old static card */
.shs-slide:only-child {
  width: 100%;
}
/* Chevron nav: desktop only (touch gets the dots + swipe). Minimalist — just the
   bare icon, no box/circle; it nudges toward its direction and brightens on hover. */
.shs-nav {
  display: none;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  align-items: center;
  justify-content: center;
  padding: 4px;
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  z-index: 2;
  transition: color 0.15s, transform 0.15s, opacity 0.15s;
}
.shs-nav.prev {
  left: 0;
}
.shs-nav.next {
  right: 0;
}
.shs-nav:hover:not(:disabled) {
  color: var(--emerald);
}
.shs-nav.prev:hover:not(:disabled) {
  transform: translateY(-50%) translateX(-3px) scale(1.12);
}
.shs-nav.next:hover:not(:disabled) {
  transform: translateY(-50%) translateX(3px) scale(1.12);
}
.shs-nav:disabled {
  opacity: 0.22;
  cursor: default;
}
.shs-dots {
  display: flex;
  justify-content: center;
  gap: 7px;
  margin-top: 12px;
}
@media (min-width: 700px) {
  /* full-width card with the bare chevrons sitting just outside it */
  .shs {
    padding: 0 40px;
  }
  .shs-track {
    margin: 0;
    padding: 0;
  }
  .shs-slide {
    width: 100%;
    max-width: none;
  }
  .shs-nav {
    display: flex;
  }
  .shs-dots {
    display: none;
  }
}
.shs-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--border);
  transition: background 0.15s, width 0.15s;
  cursor: pointer;
}
.shs-dot.on {
  width: 18px;
  border-radius: 4px;
  background: var(--emerald);
}
</style>
