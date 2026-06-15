<script setup lang="ts">
import { domToBlob, domToPng } from 'modern-screenshot';
import type { Match, RankingEntry } from '~/types/api';

const props = defineProps<{ match: Match; me: RankingEntry | null; tournamentName?: string }>();
const tournamentName = computed(() => props.tournamentName || props.match.season?.name || 'Cravei');

const TIER_COLOR: Record<string, string> = {
  EXACT: '#13c47a',
  WINNER_GOALS: '#1e7ff0',
  GOAL_DIFF: '#f5b73b',
  LOSER_GOALS: '#ef5466',
  WINNER: '#c879f0',
  DRAW: '#c879f0',
  MISS: '#7a8699',
};

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
const tierCol = computed(() => (tier.value ? TIER_COLOR[tier.value] ?? '#13c47a' : '#13c47a'));
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
</script>

<template>
  <button class="sh-btn" @click="openShare">
    <AppIcon name="externalLink" :size="15" :stroke="2.2" />Compartilhar
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
        <span class="sc-brand font-display">CRAVEI</span>
        <span class="sc-tourn">{{ tournamentName }}</span>
      </div>

      <div class="sc-mid">
        <span class="sc-phase">{{ phaseTxt }}</span>
        <div class="sc-match">
          <div class="sc-team">
            <TeamBadge :team="match.homeTeam" :size="format === 'story' ? 160 : 130" />
            <span class="sc-tn">{{ homeShort }}</span>
          </div>
          <div class="sc-score font-display">{{ hs }}<span class="sc-colon">:</span>{{ as }}</div>
          <div class="sc-team">
            <TeamBadge :team="match.awayTeam" :size="format === 'story' ? 160 : 130" />
            <span class="sc-tn">{{ awayShort }}</span>
          </div>
        </div>
      </div>

      <div v-if="guess" class="sc-pred" :style="{ '--tc': tierCol }">
        <div class="sc-pred-row">
          <span class="sc-pl">Meu palpite</span>
          <span class="sc-pv font-display">{{ guess }}</span>
        </div>
        <div class="sc-tier">
          <span class="sc-pts font-display">+{{ points }}</span>
          <span class="sc-tl">{{ tierTxt }}</span>
        </div>
      </div>

      <div class="sc-cta">
        <span class="sc-cta-t">Faça seu palpite grátis</span>
        <span class="sc-url font-display">cravei.app</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text);
  border-radius: 999px;
  padding: 8px 15px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}
.sh-btn:hover { border-color: color-mix(in srgb, var(--gold) 45%, var(--border)); }
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
.sc-top { display: flex; flex-direction: column; gap: 8px; }
.sc-brand { font-size: 76px; font-weight: 700; letter-spacing: 2px; line-height: 1; }
.scard.square .sc-brand { font-size: 56px; }
.sc-tourn { font-size: 30px; font-weight: 700; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 1px; }
.scard.square .sc-tourn { font-size: 24px; }
.sc-mid { display: flex; flex-direction: column; align-items: center; gap: 36px; }
.sc-phase { font-size: 30px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: var(--emerald, #13c47a); }
.sc-match { display: flex; align-items: center; justify-content: center; gap: 56px; width: 100%; }
.sc-team { display: flex; flex-direction: column; align-items: center; gap: 18px; width: 280px; }
.sc-tn { font-size: 38px; font-weight: 800; text-align: center; }
.scard.square .sc-tn { font-size: 30px; }
.sc-score { font-size: 150px; font-weight: 700; line-height: 1; display: flex; align-items: center; gap: 10px; }
.scard.square .sc-score { font-size: 110px; }
.sc-colon { color: rgba(255,255,255,0.4); }
.sc-pred {
  border: 2px solid color-mix(in srgb, var(--tc) 55%, transparent);
  background: color-mix(in srgb, var(--tc) 14%, transparent);
  border-radius: 28px; padding: 40px 48px; display: flex; flex-direction: column; gap: 22px;
}
.scard.square .sc-pred { padding: 28px 36px; gap: 14px; }
.sc-pred-row { display: flex; align-items: center; justify-content: space-between; }
.sc-pl { font-size: 34px; font-weight: 700; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 1px; }
.scard.square .sc-pl { font-size: 26px; }
.sc-pv { font-size: 64px; font-weight: 700; }
.scard.square .sc-pv { font-size: 48px; }
.sc-tier { display: flex; align-items: baseline; gap: 22px; }
.sc-pts { font-size: 80px; font-weight: 700; color: var(--tc); line-height: 1; }
.scard.square .sc-pts { font-size: 58px; }
.sc-tl { font-size: 40px; font-weight: 800; color: var(--tc); text-transform: uppercase; letter-spacing: 1px; }
.scard.square .sc-tl { font-size: 30px; }
.sc-cta { display: flex; flex-direction: column; gap: 6px; }
.sc-cta-t { font-size: 30px; font-weight: 700; color: rgba(255,255,255,0.65); }
.scard.square .sc-cta-t { font-size: 24px; }
.sc-url { font-size: 60px; font-weight: 700; color: #fff; }
.scard.square .sc-url { font-size: 46px; }
</style>
