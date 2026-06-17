<script setup lang="ts">
import { domToBlob, domToPng } from 'modern-screenshot';
import type { Match, RankingEntry } from '~/types/api';

// `variant` picks the trigger style: 'icon' is the bare round button (used in
// tight spots); 'button' is a labelled pill that harmonizes inside a tab body.
const props = withDefaults(
  defineProps<{
    match: Match;
    me: RankingEntry | null;
    tournamentName?: string;
    variant?: 'icon' | 'button';
  }>(),
  { variant: 'icon' },
);
const tournamentName = computed(() => props.tournamentName || props.match.season?.name || 'Cravei');

const open = ref(false);
const format = ref<'story' | 'square'>('story');
const busy = ref(false);
const preview = ref<string | null>(null);
const card = ref<HTMLElement | null>(null);

const m = computed(() => props.match);
const played = computed(() => m.value.status === 'LIVE' || m.value.status === 'FINISHED');
const hs = computed(() => (played.value ? (m.value.homeScore ?? 0) : '–'));
const as = computed(() => (played.value ? (m.value.awayScore ?? 0) : '–'));
const isDraw = computed(() => played.value && (m.value.homeScore ?? 0) === (m.value.awayScore ?? 0));
const pred = computed(() => props.me?.prediction ?? null);
const guess = computed(() => (pred.value ? `${pred.value.home}:${pred.value.away}` : null));
const points = computed(() => props.me?.points ?? 0);
const tier = computed(() => props.me?.tier ?? null);
const tierTxt = computed(() => (tier.value ? tierLabel(tier.value, isDraw.value) : ''));
const tierCol = computed(() => tierColor(tier.value));
const phaseTxt = computed(() =>
  m.value.groupName ? `Grupo ${m.value.groupName}` : (m.value.phaseLabel ?? props.tournamentName),
);

async function render() {
  if (!card.value) return;
  busy.value = true;
  try {
    await nextTick();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    preview.value = await domToPng(card.value, { scale: 1, quality: 1 });
  } finally {
    busy.value = false;
  }
}
async function openShare() {
  open.value = true;
  await render();
}
watch(format, render);

async function share() {
  if (!card.value) return;
  const blob = await domToBlob(card.value, { scale: 1, type: 'image/png' });
  if (!blob) return;
  const file = new File([blob], `cravei-${m.value.id}.png`, { type: 'image/png' });
  const text = guess.value
    ? `Cravei ${guess.value} em ${homeShort.value} x ${awayShort.value} (+${points.value}) — faça o seu no cravei.app`
    : `Acompanha comigo no cravei.app`;
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Cravei', text });
      return;
    }
  } catch { /* user cancelled or unsupported → fall through to download */ }
  download();
}
function download() {
  if (!preview.value) return;
  const a = document.createElement('a');
  a.href = preview.value;
  a.download = `cravei-${m.value.id}.png`;
  a.click();
}

const homeShort = computed(() => props.match.homeTeam?.shortName ?? props.match.homeTeam?.name ?? '');
const awayShort = computed(() => props.match.awayTeam?.shortName ?? props.match.awayTeam?.name ?? '');
const homeFlag = computed(() => teamFlag(props.match.homeTeam));
const awayFlag = computed(() => teamFlag(props.match.awayTeam));
const homeColor = computed(() => teamColor(props.match.homeTeam));
const awayColor = computed(() => teamColor(props.match.awayTeam));
</script>

<template>
  <button
    v-if="variant === 'button'"
    class="sh-btn-lg"
    type="button"
    @click="openShare"
  >
    <AppIcon name="share" :size="16" :stroke="2" />Compartilhar resultado
  </button>
  <button v-else class="sh-btn" type="button" aria-label="Compartilhar" title="Compartilhar" @click="openShare">
    <AppIcon name="share" :size="17" :stroke="2" />
  </button>

  <AppModal v-if="open" title="Compartilhar" @close="open = false">
    <div class="sh-body">
      <div class="seg">
        <button class="seg-b" :class="{ on: format === 'story' }" @click="format = 'story'">Story 9:16</button>
        <button class="seg-b" :class="{ on: format === 'square' }" @click="format = 'square'">Quadrado 1:1</button>
      </div>
      <div class="prev">
        <img v-if="preview" :src="preview" alt="Prévia" />
        <div v-else class="prev-load">Gerando…</div>
      </div>
    </div>
    <template #footer>
      <button class="btn" :disabled="busy || !preview" @click="download">Baixar</button>
      <button class="btn btn-gold" :disabled="busy || !preview" @click="share">Compartilhar</button>
    </template>
  </AppModal>

  <!-- offscreen full-size card captured by modern-screenshot -->
  <div class="capture-host" aria-hidden="true">
    <div ref="card" class="scard" :class="format">
      <div class="sc-top">
        <div class="sc-brandrow">
          <img class="sc-icon" src="/pwa-512x512.png" alt="" />
          <span class="sc-brand font-display">CRAVEI</span>
        </div>
        <span class="sc-tourn">{{ tournamentName }}</span>
      </div>

      <div class="sc-mid">
        <span class="sc-phase">{{ phaseTxt }}</span>
        <div class="sc-match">
          <div class="sc-team">
            <div v-if="homeFlag" class="sc-flag" v-html="homeFlag" />
            <div v-else class="sc-emblem font-display" :style="{ background: homeColor }">{{ homeShort.slice(0, 3) }}</div>
            <span class="sc-tn">{{ homeShort }}</span>
          </div>
          <div class="sc-score font-display">{{ hs }}<span class="sc-colon">:</span>{{ as }}</div>
          <div class="sc-team">
            <div v-if="awayFlag" class="sc-flag" v-html="awayFlag" />
            <div v-else class="sc-emblem font-display" :style="{ background: awayColor }">{{ awayShort.slice(0, 3) }}</div>
            <span class="sc-tn">{{ awayShort }}</span>
          </div>
        </div>
        <div v-if="guess" class="sc-myguess">
          <span class="sc-mg-v font-display">{{ pred?.home }}<span class="sc-colon">:</span>{{ pred?.away }}</span>
        </div>
      </div>

      <div v-if="guess" class="sc-pred" :style="{ '--tc': tierCol }">
        <div class="sc-tier">
          <span class="sc-pts font-display">+{{ points }}</span>
          <span class="sc-tl">{{ tierTxt }}</span>
        </div>
      </div>

      <div class="sc-cta">
        <span class="sc-cta-t">Faça seu palpite grátis em</span>
        <div class="sc-cta-pill">
          <span class="sc-url font-display">cravei.app</span>
          <AppIcon class="sc-arrow" name="arrowRight" :size="54" :stroke="2.8" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sh-btn {
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-surface) 70%, transparent);
  color: var(--muted);
  border-radius: 999px;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}
.sh-btn:hover { color: var(--gold); border-color: color-mix(in srgb, var(--gold) 45%, var(--border)); }
.sh-btn-lg {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-surface) 70%, transparent);
  color: var(--muted);
  border-radius: 999px;
  font: inherit;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}
.sh-btn-lg:hover { color: var(--gold); border-color: color-mix(in srgb, var(--gold) 45%, var(--border)); }
.sh-body { display: flex; flex-direction: column; gap: 14px; }
.seg { display: flex; gap: 6px; background: var(--bg-base); border: 1px solid var(--border); border-radius: 12px; padding: 4px; }
.seg-b { flex: 1; border: 0; background: transparent; color: var(--muted); font-weight: 700; font-size: 13px; padding: 8px; border-radius: 9px; cursor: pointer; }
.seg-b.on { background: var(--grad-pitch); color: #fff; }
.prev { display: grid; place-items: center; min-height: 280px; background: var(--bg-base); border-radius: 12px; overflow: hidden; }
.prev img { max-width: 100%; max-height: 60vh; border-radius: 8px; }
.prev-load { color: var(--muted); font-weight: 600; }

/* offscreen capture host */
.capture-host { position: fixed; left: -99999px; top: 0; pointer-events: none; }
.scard {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: radial-gradient(120% 90% at 50% -10%, #16321f 0%, #0a0e14 55%);
  color: #fff;
  font-family: 'Manrope', sans-serif;
}
.scard.story { width: 1080px; height: 1920px; padding: 110px 90px; }
.scard.square { width: 1080px; height: 1080px; padding: 80px 80px; }
.sc-top { display: flex; flex-direction: column; gap: 24px; align-items: flex-start; padding-bottom: 36px; border-bottom: 2px solid rgba(255,255,255,0.10); }
.scard.square .sc-top { gap: 18px; padding-bottom: 26px; }
.sc-brandrow { display: flex; align-items: center; gap: 26px; }
.sc-icon { width: 96px; height: 96px; border-radius: 24px; }
.scard.square .sc-icon { width: 76px; height: 76px; border-radius: 19px; }
.sc-brand { font-size: 76px; font-weight: 700; letter-spacing: 2px; line-height: 1; }
.scard.square .sc-brand { font-size: 56px; }
.sc-tourn { font-size: 30px; font-weight: 700; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 1px; white-space: nowrap; }
.scard.square .sc-tourn { font-size: 24px; }
.sc-mid { display: flex; flex-direction: column; align-items: center; gap: 36px; }
.sc-phase { font-size: 28px; font-weight: 800; text-transform: uppercase; letter-spacing: 3px; color: #13c47a; white-space: nowrap; }
.sc-match { display: flex; align-items: center; justify-content: center; gap: 48px; width: 100%; }
.sc-team { display: flex; flex-direction: column; align-items: center; gap: 20px; width: 300px; }
.sc-flag { width: 220px; height: 147px; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,0.45); display: flex; }
.scard.square .sc-flag { width: 170px; height: 113px; }
.sc-flag :deep(svg) { width: 100%; height: 100%; object-fit: cover; display: block; }
.sc-emblem { width: 220px; height: 147px; border-radius: 16px; display: grid; place-items: center; color: #fff; font-size: 56px; font-weight: 700; }
.scard.square .sc-emblem { width: 170px; height: 113px; font-size: 44px; }
.sc-tn { font-size: 40px; font-weight: 800; text-align: center; white-space: nowrap; }
.scard.square .sc-tn { font-size: 32px; }
.sc-score { font-size: 150px; font-weight: 700; line-height: 1; display: flex; align-items: center; gap: 12px; white-space: nowrap; }
.scard.square .sc-score { font-size: 112px; }
.sc-colon { color: rgba(255,255,255,0.35); }
.sc-myguess {
  align-self: center; display: inline-flex; align-items: center;
  border: 2px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05);
  border-radius: 999px; padding: 12px 44px;
}
.scard.square .sc-myguess { padding: 10px 36px; }
.sc-mg-v { flex: none; font-size: 60px; font-weight: 700; line-height: 1; }
.scard.square .sc-mg-v { font-size: 46px; }
.sc-pred {
  border: 2px solid color-mix(in srgb, var(--tc) 55%, transparent);
  background: color-mix(in srgb, var(--tc) 14%, transparent);
  border-radius: 28px; padding: 36px 48px; display: flex; flex-direction: column;
}
.scard.square .sc-pred { padding: 28px 38px; }
.sc-tier { display: flex; align-items: center; }
.sc-pts { flex: none; font-size: 80px; font-weight: 700; color: var(--tc); line-height: 1; padding-right: 56px; }
.scard.square .sc-pts { padding-right: 40px; }
.scard.square .sc-pts { font-size: 58px; }
.sc-tl { font-size: 38px; font-weight: 800; color: var(--tc); text-transform: uppercase; letter-spacing: 1px; white-space: nowrap; line-height: 1; }
.scard.square .sc-tl { font-size: 28px; }
.sc-cta { display: flex; flex-direction: column; align-items: center; gap: 22px; }
.scard.square .sc-cta { gap: 16px; }
.sc-cta-t { font-size: 30px; font-weight: 700; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 2px; white-space: nowrap; }
.scard.square .sc-cta-t { font-size: 24px; }
.sc-cta-pill { display: inline-flex; align-items: center; background: var(--grad-pitch); border-radius: 999px; padding: 30px 64px; box-shadow: 0 20px 60px -10px rgba(30,127,240,0.6); }
.scard.square .sc-cta-pill { padding: 22px 48px; }
.sc-url { flex: none; font-size: 64px; font-weight: 700; color: #fff; line-height: 1; padding-right: 46px; }
.scard.square .sc-url { font-size: 48px; padding-right: 34px; }
.sc-arrow { color: #fff; }
</style>
