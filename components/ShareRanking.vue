<script setup lang="ts">
import { domToBlob, domToPng } from 'modern-screenshot';
import type { RankingResponse } from '~/types/api';

const props = defineProps<{ data: RankingResponse; title: string; subtitle?: string }>();

const open = ref(false);
const format = ref<'story' | 'square'>('story');
const busy = ref(false);
const preview = ref<string | null>(null);
const card = ref<HTMLElement | null>(null);

const entries = computed(() => props.data.entries ?? []);
const top3 = computed(() => entries.value.slice(0, 3));
// visual order on the podium: 2nd · 1st · 3rd (only the slots that exist)
const podium = computed(() =>
  [top3.value[1], top3.value[0], top3.value[2]]
    .map((e, i) => ({ e, slot: [1, 0, 2][i] }))
    .filter((x): x is { e: NonNullable<typeof x.e>; slot: number } => !!x.e),
);
const total = computed(() => props.data.totalParticipants ?? entries.value.length);
const me = computed(() => props.data.currentUser ?? null);
// Show "your position" only when the viewer isn't already on the podium.
const meOutside = computed(() => (me.value && me.value.rank > 3 ? me.value : null));

const MEDALS = ['#f4b81e', '#C2CAD6', '#CD7F45'];
const HEIGHTS = ['210px', '160px', '128px'];
const SQ_HEIGHTS = ['150px', '116px', '92px'];

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
}

// Avatars are captured into the share image by modern-screenshot, which needs the
// image to be CORS-readable. The r2.dev public host sends no CORS header, but the
// same objects are served (with CORS) via the custom domain cdn.cravei.app — rewrite
// to it. Fall back to initials on any load error so the card never shows a broken
// avatar.
const avatarFailed = reactive<Record<string, boolean>>({});
function cdnAvatar(url: string): string {
  return url.replace(/^https:\/\/pub-[^/]+\.r2\.dev\//, 'https://cdn.cravei.app/');
}
function color(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${h} 52% 42%)`;
}

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

const fileName = computed(() => `cravei-ranking-${props.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`);
async function share() {
  if (!card.value) return;
  const blob = await domToBlob(card.value, { scale: 1, type: 'image/png' });
  if (!blob) return;
  const file = new File([blob], fileName.value, { type: 'image/png' });
  const text = `Ranking de ${props.title} no Cravei — faça o seu palpite em cravei.app`;
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
  a.download = fileName.value;
  a.click();
}
</script>

<template>
  <button class="sh-btn" type="button" aria-label="Compartilhar ranking" title="Compartilhar ranking" @click="openShare">
    <AppIcon name="share" :size="17" :stroke="2" />
  </button>

  <AppModal v-if="open" title="Compartilhar ranking" @close="open = false">
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
        <span class="sc-tourn">{{ subtitle || 'Ranking do bolão' }}</span>
      </div>

      <div class="sr-mid">
        <span class="sr-eyebrow">Ranking</span>
        <span class="sr-title font-display">{{ title }}</span>

        <div class="sr-podium">
          <div v-for="{ e, slot } in podium" :key="e.user.id" class="sr-col">
            <div class="sr-av font-display" :style="{ background: e.user.avatarUrl && !avatarFailed[e.user.id] ? 'transparent' : color(e.user.id), borderColor: MEDALS[slot], boxShadow: `0 0 36px -6px ${MEDALS[slot]}` }">
              <img v-if="e.user.avatarUrl && !avatarFailed[e.user.id]" :src="cdnAvatar(e.user.avatarUrl)" crossorigin="anonymous" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block" @error="avatarFailed[e.user.id] = true" />
              <template v-else>{{ initials(e.user.name) }}</template>
            </div>
            <span class="sr-name">{{ e.user.name }}</span>
            <span class="sr-pts font-display" :style="{ color: MEDALS[slot] }">{{ e.points }}</span>
            <div class="sr-ped" :style="{ height: (format === 'square' ? SQ_HEIGHTS : HEIGHTS)[slot], background: `linear-gradient(180deg, ${MEDALS[slot]}, transparent)` }">
              <span class="sr-rank font-display">{{ e.rank }}º</span>
            </div>
          </div>
        </div>

        <div class="sr-foot">
          <span class="sr-total">{{ total }} participante{{ total === 1 ? '' : 's' }}</span>
          <div v-if="meOutside" class="sr-you">
            <span class="sr-you-l">Você</span>
            <span class="sr-you-v font-display">{{ meOutside.rank }}º · {{ meOutside.points }} pts</span>
          </div>
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
  display: inline-grid; place-items: center; width: 34px; height: 34px;
  border: 1px solid var(--border); background: color-mix(in srgb, var(--bg-surface) 70%, transparent);
  color: var(--muted); border-radius: 999px; cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}
.sh-btn:hover { color: var(--gold); border-color: color-mix(in srgb, var(--gold) 45%, var(--border)); }
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
  box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;
  background: radial-gradient(120% 90% at 50% -10%, #16321f 0%, #0a0e14 55%);
  color: #fff; font-family: 'Manrope', sans-serif;
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

/* ranking mid */
.sr-mid { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; }
.sr-eyebrow { font-size: 28px; font-weight: 800; text-transform: uppercase; letter-spacing: 4px; color: #13c47a; }
.scard.square .sr-eyebrow { font-size: 22px; }
.sr-title { font-size: 64px; font-weight: 700; line-height: 1.05; text-align: center; letter-spacing: 1px; }
.scard.square .sr-title { font-size: 48px; }
.sr-podium { display: flex; align-items: flex-end; justify-content: center; margin-top: 48px; }
.scard.square .sr-podium { margin-top: 30px; }
.sr-col { width: 286px; display: flex; flex-direction: column; align-items: center; gap: 18px; }
.scard.square .sr-col { width: 230px; gap: 12px; }
.sr-av {
  width: 150px; height: 150px; border-radius: 999px; display: grid; place-items: center;
  font-size: 56px; font-weight: 700; border: 6px solid; color: #fff;
}
.scard.square .sr-av { width: 116px; height: 116px; font-size: 44px; border-width: 5px; }
.sr-name { font-size: 34px; font-weight: 800; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.scard.square .sr-name { font-size: 26px; }
.sr-pts { font-size: 60px; font-weight: 700; line-height: 1; }
.scard.square .sr-pts { font-size: 46px; }
.sr-ped { width: 100%; border-radius: 18px 18px 0 0; display: grid; place-items: center; }
.sr-rank { font-size: 56px; font-weight: 700; color: #fff; }
.scard.square .sr-rank { font-size: 42px; }

/* footer: total + you + cta */
.sc-cta { display: flex; flex-direction: column; align-items: center; gap: 22px; }
.scard.square .sc-cta { gap: 16px; }
.sr-foot { display: flex; flex-direction: column; align-items: center; gap: 18px; margin-top: 56px; }
.scard.square .sr-foot { margin-top: 38px; }
.sr-total { font-size: 30px; font-weight: 700; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 2px; white-space: nowrap; }
.scard.square .sr-total { font-size: 24px; }
.sr-you {
  display: inline-flex; align-items: center; border: 2px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.05); border-radius: 999px; padding: 12px 36px;
}
.sr-you-l { flex: none; font-size: 26px; font-weight: 700; color: rgba(255,255,255,0.55); text-transform: uppercase; letter-spacing: 2px; padding-right: 22px; }
.scard.square .sr-you-l { font-size: 22px; }
.sr-you-v { flex: none; font-size: 40px; font-weight: 700; line-height: 1; white-space: nowrap; }
.scard.square .sr-you-v { font-size: 32px; }
.sc-cta-t { font-size: 30px; font-weight: 700; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 2px; white-space: nowrap; }
.scard.square .sc-cta-t { font-size: 24px; }
.sc-cta-pill { display: inline-flex; align-items: center; background: var(--grad-pitch); border-radius: 999px; padding: 30px 64px; box-shadow: 0 20px 60px -10px rgba(30,127,240,0.6); }
.scard.square .sc-cta-pill { padding: 22px 48px; }
.sc-url { flex: none; font-size: 64px; font-weight: 700; color: #fff; line-height: 1; padding-right: 46px; }
.scard.square .sc-url { font-size: 48px; padding-right: 34px; }
.sc-arrow { color: #fff; }
</style>
