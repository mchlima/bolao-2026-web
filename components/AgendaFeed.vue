<script setup lang="ts">
// Motor da Agenda: tira de datas + feed contínuo agrupado por dia (header sticky)
// + "Ao vivo" fixo no topo. É o MESMO componente usado em /futebol/agenda (todos
// os torneios), no hub /futebol e na aba Jogos do hub de torneio (escopado por
// competição/temporada). A API /agenda já agrupa por dia BRT e devolve nav/POSTPONED.
import type { Match } from '~/types/api';

const props = defineProps<{
  // Escopo opcional. seasonId tem precedência sobre competitionId na API.
  competitionId?: string;
  seasonId?: string;
}>();

// Brasil não tem horário de verão desde 2019 → BRT fixo. A agenda agrupa por dia
// de calendário de São Paulo, então a tira é ancorada em BRT também.
function brtToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00-03:00`);
  d.setTime(d.getTime() + n * 86400000);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

const today = brtToday();

// Escopo estável (calculado uma vez): mantém a key do cache constante e deixa o
// refetch a cargo do `watch` — espelha o padrão da página antiga e evita colisão.
const cacheKey = `agenda-feed:${props.seasonId ?? props.competitionId ?? 'all'}`;
const scope = computed(() => props.seasonId ?? props.competitionId ?? 'all');

function scopedQs(extra: Record<string, string>): string {
  const qs = new URLSearchParams(extra);
  if (props.seasonId) qs.set('seasonId', props.seasonId);
  else if (props.competitionId) qs.set('competitionId', props.competitionId);
  return qs.toString();
}

// Carrega tudo de uma vez, sem paginação (a API limita a 500). Escopado num torneio
// → 'all' (agenda COMPLETA: todos os jogos, inclusive os já encerrados). Global →
// 'upcoming' (de hoje em diante + ao vivo + adiados; passado de todos os torneios
// seria volume demais e pouco útil).
const apiScope = props.seasonId ? 'all' : 'upcoming';
const { data, pending, refresh } = await useAsyncData(
  cacheKey,
  () => useApi()<{ days: { date: string; matches: Match[] }[] }>(`/agenda?${scopedQs({ scope: apiScope })}`),
  { watch: [scope] },
);

// "Ao vivo" é buscado à parte (scope=live): um jogo que começou ontem e ainda roda
// precisa aparecer no topo independentemente do dia.
const { data: liveData, refresh: refreshLive } = await useAsyncData(
  `${cacheKey}:live`,
  () => useApi()<{ days: { date: string; matches: Match[] }[] }>(`/agenda?${scopedQs({ scope: 'live' })}`),
  { watch: [scope] },
);

// Feedback de loading só em ação do usuário (troca de escopo) — um refresh de
// fundo (robô SSE) fica SILENCIOSO pra lista não piscar.
const switching = ref(false);
watch(scope, () => {
  switching.value = true;
});
watch(pending, (p) => {
  if (!p) switching.value = false;
});

const liveMatches = computed<Match[]>(() => (liveData.value?.days ?? []).flatMap((d) => d.matches));
const liveIds = computed(() => new Set(liveMatches.value.map((m) => m.id)));

// Grupos por dia, já sem os jogos que estão no "Ao vivo" (pra não duplicar). Dias
// que ficam vazios (só tinham o jogo ao vivo) somem do corpo.
const groups = computed(() => {
  const days = data.value?.days ?? [];
  return days
    .map((d) => ({ date: d.date, matches: d.matches.filter((m) => !liveIds.value.has(m.id)) }))
    .filter((d) => d.matches.length);
});
const tomorrow = addDays(today, 1);

// Tira de datas: SÓ os dias que têm jogo (espelha o feed — nada de dias vazios).
const strip = computed(() =>
  groups.value
    .filter((g) => g.date !== 'postponed')
    .map((g) => {
      const d = new Date(`${g.date}T12:00:00-03:00`);
      const isToday = g.date === today;
      const wd = d
        .toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'America/Sao_Paulo' })
        .replace(/\./g, '');
      return {
        date: g.date,
        weekday: isToday ? 'Hoje' : g.date === tomorrow ? 'Amanhã' : wd.charAt(0).toUpperCase() + wd.slice(1),
        daynum: d.toLocaleDateString('pt-BR', { day: '2-digit', timeZone: 'America/Sao_Paulo' }),
        month: d
          .toLocaleDateString('pt-BR', { month: 'short', timeZone: 'America/Sao_Paulo' })
          .replace(/\./g, ''),
        isToday,
      };
    }),
);

// Rótulo do header de dia: "Hoje" / "Amanhã" / "Qua, 24 jun"; "A definir" p/ POSTPONED.
function dayLabel(date: string): string {
  if (date === 'postponed') return 'A definir';
  if (date === today) return 'Hoje';
  if (date === addDays(today, 1)) return 'Amanhã';
  const d = new Date(`${date}T12:00:00-03:00`);
  const s = d
    .toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' })
    .replace(/\./g, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
// Só "Hoje"/"Amanhã" ganham uma data por extenso ao lado (os outros dias já a têm
// no rótulo principal).
function daySub(date: string): string {
  if (date !== today && date !== addDays(today, 1)) return '';
  const d = new Date(`${date}T12:00:00-03:00`);
  return d
    .toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' })
    .replace(/\./g, '');
}

// Scroll até o grupo de um dia (ou o próximo dia com jogo, se aquele estiver vazio).
// <section> é elemento nativo → o ref de função recebe o HTMLElement direto.
const dayEls = new Map<string, HTMLElement>();
function setDayEl(date: string, el: unknown) {
  if (el instanceof HTMLElement) dayEls.set(date, el);
  else dayEls.delete(date);
}
const activeDate = ref(today);
// Ao abrir, se a lista começa ANTES de hoje (ex.: agenda COMPLETA de um campeonato,
// que inclui jogos já encerrados), pula direto pro dia de hoje (ou o próximo com
// jogo) em vez de começar nos jogos antigos. No-op na agenda global (já é de hoje
// em diante).
onMounted(() => {
  nextTick(() => {
    const gs = groups.value;
    if (gs.length < 2 || gs[0].date === 'postponed') return;
    const target = gs.find((g) => g.date !== 'postponed' && g.date >= today)?.date;
    if (!target || gs[0].date === target) return;
    activeDate.value = target;
    dayEls.get(target)?.scrollIntoView({ block: 'start' });
  });
});
function goToDate(date: string) {
  activeDate.value = date;
  dayEls.get(date)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
// Atalho LIVE → rola pro bloco "Ao vivo" (no começo da listagem).
function goLive() {
  activeDate.value = 'live';
  dayEls.get('live')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Setas de navegação da tira (aparecem só quando ela transborda) + pílula ativa
// sempre visível.
const rootEl = ref<HTMLElement | null>(null);
const stripWrapEl = ref<HTMLElement | null>(null);
const stripEl = ref<HTMLElement | null>(null);
const pillEls = new Map<string, HTMLElement>();

// A altura da tira (sticky) vira `--strip-h` no root, e o header de dia cola logo
// abaixo dela (`.ghead top: var(--strip-h)`). Assim o offset se ajusta sozinho se
// o conteúdo dos pills mudar — sem número mágico pra perseguir.
let stripRo: ResizeObserver | null = null;
function syncStripH() {
  if (rootEl.value && stripWrapEl.value)
    rootEl.value.style.setProperty('--strip-h', `${stripWrapEl.value.offsetHeight}px`);
}
onMounted(() => {
  syncStripH();
  if (typeof ResizeObserver !== 'undefined' && stripWrapEl.value) {
    stripRo = new ResizeObserver(syncStripH);
    stripRo.observe(stripWrapEl.value);
  }
});
onUnmounted(() => stripRo?.disconnect());
function setPillEl(date: string, el: unknown) {
  if (el instanceof HTMLElement) pillEls.set(date, el);
  else pillEls.delete(date);
}
const canLeft = ref(false);
const canRight = ref(false);
function updateArrows() {
  const el = stripEl.value;
  if (!el) return;
  canLeft.value = el.scrollLeft > 4;
  canRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
}
function nudge(dir: number) {
  const el = stripEl.value;
  if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: 'smooth' });
}
// Roda do mouse vertical → rola a tira na horizontal (quando há overflow). Gestos
// predominantemente horizontais (trackpad) seguem o comportamento nativo.
function onWheel(e: WheelEvent) {
  const el = stripEl.value;
  if (!el || el.scrollWidth <= el.clientWidth) return;
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  el.scrollLeft += e.deltaY;
  e.preventDefault();
}
onMounted(() => {
  updateArrows();
  stripEl.value?.addEventListener('scroll', updateArrows, { passive: true });
  stripEl.value?.addEventListener('wheel', onWheel, { passive: false });
  if (typeof window !== 'undefined') window.addEventListener('resize', updateArrows);
});
onUnmounted(() => {
  stripEl.value?.removeEventListener('scroll', updateArrows);
  stripEl.value?.removeEventListener('wheel', onWheel);
  if (typeof window !== 'undefined') window.removeEventListener('resize', updateArrows);
});
// Re-mede quando a tira muda (carregar mais / realtime) e garante uma ativa válida.
// 'live' é um estado válido (atalho LIVE), não pertence à lista de datas.
watch(strip, (s) => {
  if (s.length && activeDate.value !== 'live' && !s.some((d) => d.date === activeDate.value))
    activeDate.value = s[0].date;
  nextTick(updateArrows);
});
// Centra a pílula ativa na tira — scroll SÓ horizontal (scrollBy no próprio .strip),
// nunca vertical, senão (com a tira fora da tela) puxaria a página de volta pro topo.
// O atalho LIVE é fixo (fora do scroller) → não precisa centralizar.
watch(activeDate, (d) => {
  if (d === 'live') return;
  nextTick(() => {
    const pill = pillEls.get(d);
    const el = stripEl.value;
    if (!pill || !el) return;
    const pr = pill.getBoundingClientRect();
    const sr = el.getBoundingClientRect();
    el.scrollBy({ left: pr.left - sr.left - (sr.width - pr.width) / 2, behavior: 'smooth' });
  });
});

// Scroll-spy: a pílula ativa acompanha o dia que está no topo do scroll.
let io: IntersectionObserver | null = null;
onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') return;
  io = new IntersectionObserver(
    (entries) => {
      const top = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      const date = top?.target.getAttribute('data-date');
      if (date && date !== 'postponed') activeDate.value = date;
    },
    { rootMargin: '-90px 0px -70% 0px', threshold: 0 },
  );
  watchEffect(() => {
    if (!io) return;
    // depende dos grupos + ao vivo: re-observa quando os dias ou o bloco LIVE mudam.
    void groups.value.length;
    void liveMatches.value.length;
    io.disconnect();
    nextTick(() => {
      for (const el of dayEls.values()) io?.observe(el);
    });
  });
});
onUnmounted(() => io?.disconnect());

// Reflete mudanças ao vivo (gols/status): assina os torneios presentes e re-busca.
const liveChannels = computed(() =>
  [
    ...new Set(
      [...(groups.value.flatMap((g) => g.matches)), ...liveMatches.value]
        .map((m) => m.seasonId)
        .filter(Boolean),
    ),
  ].map((seasonId) => `tournament:${seasonId}`),
);
useRealtime(
  () => liveChannels.value,
  () => {
    refresh();
    refreshLive();
  },
);

const hasAny = computed(() => groups.value.length > 0 || liveMatches.value.length > 0);
</script>

<template>
  <div ref="rootEl" class="afeed">
    <!-- tira de datas (só dias com jogo) + atalho LIVE fixo à esquerda -->
    <div v-if="strip.length || liveMatches.length" ref="stripWrapEl" class="stripwrap">
      <!-- atalho LIVE: quadrado fixo no início (fora do scroller), só com jogo ao vivo -->
      <button
        v-if="liveMatches.length"
        :ref="(el) => setPillEl('live', el)"
        type="button"
        class="pill live-pill"
        :class="{ on: activeDate === 'live' }"
        aria-label="Jogos ao vivo"
        @click="goLive"
      >
        <span class="lvdot" />
        <span class="lp-txt">LIVE</span>
      </button>
      <div class="strip-scroll" :class="{ 'fade-l': canLeft, 'fade-r': canRight }">
        <button v-show="canLeft" type="button" class="snav-arrow left" aria-label="Datas anteriores" @click="nudge(-1)">
          <AppIcon name="chevronLeft" :size="18" :stroke="2.6" />
        </button>
        <div ref="stripEl" class="strip" role="tablist" aria-label="Datas">
          <button
            v-for="d in strip"
            :key="d.date"
            :ref="(el) => setPillEl(d.date, el)"
            type="button"
            class="pill"
            :class="{ on: activeDate === d.date, today: d.isToday }"
            :aria-selected="activeDate === d.date"
            @click="goToDate(d.date)"
          >
            <span class="pwd">{{ d.weekday }}</span>
            <span class="pdn">{{ d.daynum }}</span>
            <span class="pmon">{{ d.month }}</span>
          </button>
        </div>
        <button v-show="canRight" type="button" class="snav-arrow right" aria-label="Próximas datas" @click="nudge(1)">
          <AppIcon name="chevronRight" :size="18" :stroke="2.6" />
        </button>
      </div>
    </div>

    <SkeletonList v-if="switching || (pending && !data)" variant="match" :count="4" />

    <div v-else-if="!hasAny" class="empty">
      <p class="muted">Nenhum jogo encontrado.</p>
    </div>

    <div v-else class="body">
      <!-- AO VIVO (sempre no começo da listagem) -->
      <section v-if="liveMatches.length" :ref="(el) => setDayEl('live', el)" data-date="live" class="grp">
        <header class="ghead live"><span class="lvdot" />Ao vivo</header>
        <MatchCard :matches="liveMatches" show-season />
      </section>

      <!-- DIAS -->
      <section
        v-for="g in groups"
        :key="g.date"
        :ref="(el) => setDayEl(g.date, el)"
        :data-date="g.date"
        class="grp day"
      >
        <header class="ghead">
          <span class="gh-main">{{ dayLabel(g.date) }}</span>
          <span v-if="daySub(g.date)" class="gh-sub">{{ daySub(g.date) }}</span>
        </header>
        <MatchCard :matches="g.matches" show-season />
      </section>
    </div>
  </div>
</template>

<style scoped>
.afeed {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
/* Tira de datas — STICKY no topo do scroll (o <main>/doc é o container). O wrapper
   segura as setas (absolutas) e os fades das bordas; .strip é o scroller horizontal.
   Altura ~78px → o header de dia cola logo ABAIXO dela (.ghead top: 78px). */
.stripwrap {
  position: sticky;
  top: var(--header-h, 0px);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 0;
  background: color-mix(in srgb, var(--bg-base) 92%, transparent);
  backdrop-filter: blur(10px);
}
/* Área das datas (rola na horizontal). Relative p/ ancorar as setas e os fades só
   sobre as datas — o atalho LIVE fica FORA dela, fixo à esquerda. */
.strip-scroll {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}
.strip {
  display: flex;
  gap: 7px;
  width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
  scroll-padding-inline: 40px;
}
.strip::-webkit-scrollbar {
  display: none;
}
.snav-arrow {
  position: absolute;
  z-index: 2;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text);
  cursor: pointer;
  box-shadow: 0 4px 12px -4px rgba(15, 22, 32, 0.25);
  transition: color 0.13s, border-color 0.13s;
}
.snav-arrow.left {
  left: 0;
}
.snav-arrow.right {
  right: 0;
}
.snav-arrow:hover {
  color: var(--azure);
  border-color: color-mix(in srgb, var(--azure) 50%, var(--border));
}
/* fade nas bordas quando há mais datas pra rolar (sinaliza overflow) */
.strip-scroll.fade-l::before,
.strip-scroll.fade-r::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 46px;
  z-index: 1;
  pointer-events: none;
}
.strip-scroll.fade-l::before {
  left: 0;
  background: linear-gradient(90deg, var(--bg-base), transparent);
}
.strip-scroll.fade-r::after {
  right: 0;
  background: linear-gradient(270deg, var(--bg-base), transparent);
}
.pill {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 62px;
  padding: 8px 6px 7px;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: var(--bg-surface);
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  transition: border-color 0.14s, color 0.14s, background 0.14s;
}
.pill:hover {
  border-color: color-mix(in srgb, var(--azure) 40%, var(--border));
}
.pwd {
  font-size: var(--fs-2xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
}
.pdn {
  font-family: 'Oswald', sans-serif;
  font-size: var(--fs-base);
  font-weight: 700;
  line-height: 1;
  color: var(--text);
}
.pmon {
  font-size: var(--fs-2xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  line-height: 1;
}
.pill.today .pwd {
  color: var(--emerald);
}
.pill.on {
  border-color: transparent;
  background: var(--azure);
}
.pill.on .pwd,
.pill.on .pdn,
.pill.on .pmon {
  color: #fff;
}
/* atalho LIVE: quadrado fixo no início, acento escarlate + dot pulsante */
.live-pill {
  flex: none;
  justify-content: center;
  gap: 5px;
  border-color: color-mix(in srgb, var(--scarlet) 55%, var(--border));
}
.live-pill:hover {
  border-color: color-mix(in srgb, var(--scarlet) 75%, var(--border));
}
.lp-txt {
  font-size: var(--fs-xs);
  font-weight: 800;
  letter-spacing: 0.05em;
  color: var(--scarlet);
  line-height: 1;
}
.live-pill.on {
  border-color: transparent;
  background: var(--scarlet);
}
.live-pill.on .lp-txt {
  color: #fff;
}
.live-pill.on .lvdot {
  background: #fff;
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.3);
}
.body {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.grp {
  display: grid;
  gap: 10px;
  /* compensa header global + tira ao rolar até um dia clicado na tira */
  scroll-margin-top: calc(var(--header-h, 0px) + var(--strip-h, 66px) + 8px);
}
/* Header de dia: STICKY logo ABAIXO da tira (que também é sticky em top:0). z-index
   menor que a tira; o offset = altura medida da tira (--strip-h), senão o topo some. */
.ghead {
  position: sticky;
  top: calc(var(--header-h, 0px) + var(--strip-h, 66px));
  z-index: 10;
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 0;
  background: color-mix(in srgb, var(--bg-base) 92%, transparent);
  backdrop-filter: blur(6px);
}
.gh-main {
  font-family: 'Oswald', sans-serif;
  font-weight: 600;
  font-size: var(--fs-sm);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text);
}
.gh-sub {
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--muted);
}
.ghead.live {
  color: var(--scarlet);
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: var(--fs-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  align-items: center;
  gap: 7px;
}
.lvdot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--scarlet);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--scarlet) 22%, transparent);
  animation: liveDot 1.1s ease-in-out infinite;
}
.empty {
  padding: 2.5rem 0;
  text-align: center;
}
</style>
