<script setup lang="ts">
import type { Match } from '~/types/api';

// Linha horizontal de cards QUADRADOS de jogo (vitrine da home). Container
// transparente, alinhado ao conteúdo. Mobile = swipe nativo; desktop = setas.
// Opcionalmente abre com um tile-líder no mesmo formato quadrado (fundo preto +
// logo do campeonato) que linka pro hub.
defineProps<{
  matches: Match[];
  /** Tile inicial (mesmo formato quadrado, fundo preto) que linka pro hub. */
  lead?: { to: string; image: string; alt?: string };
}>();

const tz = useTz();
// Resolve o componente real — `:is="'NuxtLink'"` (string) NÃO resolve aqui e
// renderiza um <NuxtLink> inerte (não vira <a href>, card não clica).
const NuxtLink = resolveComponent('NuxtLink');

function rowTo(m: Match): string | null {
  if (!m.homeTeam || !m.awayTeam) return null;
  return `/futebol/jogo/${m.slug || m.id}`;
}
function shortName(t: { shortName?: string; name?: string } | null, fallback: string | null): string {
  return t?.shortName || t?.name || fallback || 'A def.';
}
function dateText(m: Match): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: tz.value }).format(new Date(m.kickoffAt));
}
function timeText(m: Match): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tz.value }).format(new Date(m.kickoffAt));
}
type Tone = 'live' | 'scheduled' | 'done';
function statusTone(m: Match): Tone {
  if (m.status === 'LIVE') return 'live';
  if (m.status === 'FINISHED') return 'done';
  return 'scheduled';
}
// Lado direito do header: hora (agendado), relógio ao vivo, ou estado final.
function whenText(m: Match): string {
  if (m.status === 'LIVE') return m.liveClock || 'Ao vivo';
  if (m.status === 'FINISHED') return 'Fim';
  if (m.status === 'POSTPONED') return 'Adiado';
  if (m.status === 'CANCELLED') return 'Cancelado';
  return timeText(m);
}
// Footer: rodada (esquerda) + grupo (direita).
function roundText(m: Match): string {
  if (m.round?.number != null) return `Rodada ${m.round.number}`;
  return m.round?.name ?? '';
}
function groupText(m: Match): string {
  if (!m.groupName) return '';
  return /^[a-z]$/i.test(m.groupName) ? `Grupo ${m.groupName.toUpperCase()}` : m.groupName;
}

// Setas (desktop): nudge no scroll horizontal. Mobile usa swipe nativo.
const track = ref<HTMLElement | null>(null);
const atStart = ref(true);
const atEnd = ref(false);
function onScroll() {
  const el = track.value;
  if (!el) return;
  atStart.value = el.scrollLeft <= 2;
  atEnd.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
}
function nudge(dir: 1 | -1) {
  track.value?.scrollBy({ left: dir * 240, behavior: 'smooth' });
}
// Desktop: roda vertical do mouse → rola na horizontal, de forma SUAVE. Só
// intercepta quando há overflow e o gesto é vertical-dominante; nas pontas (ou
// gesto já horizontal, ex.: trackpad) deixa a página rolar. Touch usa swipe.
// A posição animada é rastreada num float próprio (curLeft) — ler scrollLeft de
// volta arredonda pra inteiro e travaria o easing no último pixel.
let targetLeft = 0;
let curLeft = 0;
let rafId = 0;
function animate() {
  const el = track.value;
  if (!el) {
    rafId = 0;
    return;
  }
  const diff = targetLeft - curLeft;
  if (Math.abs(diff) < 0.5) {
    curLeft = targetLeft;
    el.scrollLeft = targetLeft;
    rafId = 0;
    return;
  }
  curLeft += diff * 0.22; // easing por frame
  el.scrollLeft = curLeft;
  rafId = requestAnimationFrame(animate);
}
function onWheel(e: WheelEvent) {
  const el = track.value;
  if (!el || el.scrollWidth <= el.clientWidth) return;
  if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
  const max = el.scrollWidth - el.clientWidth;
  const atLeft = el.scrollLeft <= 0 && e.deltaY < 0;
  const atRight = el.scrollLeft >= max - 1 && e.deltaY > 0;
  if (atLeft || atRight) return;
  e.preventDefault();
  // base = alvo em curso (animação rodando) OU posição atual do DOM (parada).
  // Roladas seguidas somam sobre o alvo → aceleram suavemente.
  const base = rafId ? targetLeft : el.scrollLeft;
  if (!rafId) curLeft = el.scrollLeft;
  targetLeft = Math.max(0, Math.min(max, base + e.deltaY));
  if (!rafId) rafId = requestAnimationFrame(animate);
}
onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId);
});
onMounted(() => nextTick(onScroll));
</script>

<template>
  <div class="msr-wrap">
    <!-- Card-líder FIXO (não rola) — só os jogos seguintes deslizam. -->
    <NuxtLink v-if="lead" :to="lead.to" class="sq lead">
      <img :src="lead.image" :alt="lead.alt ?? 'Campeonato'" class="lead-img" loading="lazy" />
    </NuxtLink>

    <div class="msr-scroll">
      <button
        type="button"
        class="msr-nav prev"
        :disabled="atStart"
        aria-label="Anterior"
        @click="nudge(-1)"
      >
        <AppIcon name="chevronLeft" :size="28" :stroke="2.2" />
      </button>
      <button
        type="button"
        class="msr-nav next"
        :disabled="atEnd"
        aria-label="Próximo"
        @click="nudge(1)"
      >
        <AppIcon name="chevronRight" :size="28" :stroke="2.2" />
      </button>

      <div ref="track" class="msr" @scroll.passive="onScroll" @wheel="onWheel">
        <component
          :is="rowTo(m) ? NuxtLink : 'div'"
          v-for="m in matches"
          :key="m.id"
          :to="rowTo(m) || undefined"
          class="sq"
        >
          <span class="sq-head">
            <span class="sq-date font-numeric">{{ dateText(m) }}</span>
            <span class="sq-when" :class="statusTone(m)">
              <span v-if="m.status === 'LIVE'" class="d" /><span class="font-numeric">{{ whenText(m) }}</span>
            </span>
          </span>

          <div class="sq-body">
            <div class="sq-team">
              <TeamBadge :team="m.homeTeam" :size="28" dark />
              <span class="sq-name">{{ shortName(m.homeTeam, m.homeSourceLabel) }}</span>
            </div>
            <div class="sq-team">
              <TeamBadge :team="m.awayTeam" :size="28" dark />
              <span class="sq-name">{{ shortName(m.awayTeam, m.awaySourceLabel) }}</span>
            </div>
          </div>

          <span v-if="roundText(m) || groupText(m)" class="sq-foot">
            <span class="sq-round">{{ roundText(m) }}</span>
            <span class="sq-group">{{ groupText(m) }}</span>
          </span>
        </component>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Líder fixo à esquerda + área que rola à direita. */
.msr-wrap { display: flex; gap: 9px; align-items: center; }
.msr-scroll { position: relative; flex: 1; min-width: 0; }

/* Container transparente — alinhado ao conteúdo (sem bleed que cortava as bordas). */
.msr {
  display: flex;
  gap: 9px;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 4px 0;
  scroll-snap-type: x proximity;
}
.msr::-webkit-scrollbar { display: none; }

.sq {
  flex: 0 0 auto;
  width: 150px;
  aspect-ratio: 1 / 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 11px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: #0c1119;
  text-decoration: none;
  color: #fff;
  scroll-snap-align: start;
  transition: border-color 0.14s, transform 0.14s, box-shadow 0.14s;
}
.sq:hover { border-color: color-mix(in srgb, var(--azure) 55%, transparent); transform: translateY(-2px); box-shadow: var(--shadow); }

.sq-head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: var(--fs-sm);
  font-weight: 800;
  letter-spacing: 0.02em;
}
.sq-date { color: rgba(255, 255, 255, 0.6); }
.sq-when { display: inline-flex; align-items: center; gap: 4px; color: #fff; }
.sq-when.scheduled { color: #6db3ff; }
.sq-when.live { color: var(--scarlet); text-transform: uppercase; }
.sq-when .d { width: 6px; height: 6px; border-radius: 50%; background: var(--scarlet); animation: liveDot 1.1s ease-in-out infinite; }

.sq-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  min-height: 0;
}
.sq-team { display: flex; align-items: center; gap: 8px; min-width: 0; }
.sq-name {
  font-family: 'Oswald', sans-serif;
  font-weight: 600;
  font-size: var(--fs-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sq-foot {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: var(--fs-2xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.5);
}
.sq-round, .sq-group { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Tile-líder do campeonato — fixo, mais estreito, fundo preto + logo centralizada. */
.sq.lead {
  width: 104px;
  height: 150px;
  aspect-ratio: auto;
  align-items: center;
  justify-content: center;
  padding: 0;
  overflow: hidden;
  background: #000;
  border-color: #000;
}
.sq.lead:hover { transform: translateY(-2px) scale(1.01); box-shadow: var(--shadow); }
.lead-img { max-width: 100%; max-height: 100%; object-fit: contain; }

/* Setas — só desktop (touch usa swipe). Botão circular sobreposto às bordas. */
.msr-nav {
  display: none;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text);
  box-shadow: var(--shadow);
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s, color 0.15s;
}
.msr-nav.prev { left: -6px; }
.msr-nav.next { right: -6px; }
.msr-nav:hover:not(:disabled) { color: var(--azure); }
.msr-nav:disabled { opacity: 0; pointer-events: none; }
@media (min-width: 760px) {
  .msr-nav { display: inline-flex; }
}
</style>
