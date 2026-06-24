<script setup lang="ts">
import type { Match, MatchNote, MatchStats, MatchTimeline, StatRow, TimelineEvent } from '~/types/api';

// key por id → ao trocar de partida na barra, a página remonta e recarrega tudo.
definePageMeta({ layout: 'admin', middleware: 'admin', key: (route) => route.params.id as string });
const route = useRoute();
const ui = useUiStore();
const tz = useTz();
const matchId = route.params.id as string;

// Narração humana da ESPN ingerida (read-only) — o que o robô capturou do feed
// `commentary`. É o que alimenta facts.narracaoEspn na geração; aqui o admin VÊ e
// pode puxar uma linha como base de um comentário editorial seu.
interface EspnLine {
  id: string;
  minute: string | null;
  period: number;
  type: string | null;
  side: 'home' | 'away' | null;
  text: string;
}

const match = ref<Match | null>(null);
const notes = ref<MatchNote[]>([]);
const espn = ref<EspnLine[]>([]);
// Feed de eventos-chave (gols/cartões) da linha do tempo do nosso banco.
const events = ref<TimelineEvent[]>([]);
const KEY_TYPES = ['GOAL', 'OWN_GOAL', 'PENALTY_GOAL', 'YELLOW', 'RED', 'SECOND_YELLOW'];
const text = ref('');
const sending = ref(false);
const generating = ref(false);
const streamEl = ref<HTMLElement | null>(null);
const espnEl = ref<HTMLElement | null>(null);
const composerEl = ref<HTMLTextAreaElement | null>(null);
// Tempo automático ligado = usa o relógio ao vivo; desligado = input manual (pode ir vazio).
const autoTime = ref(true);
const manualTime = ref('');
// Estatísticas da partida (do nosso banco) — renderização própria desta tela:
// lista plana, sem cabeçalho de times nem títulos de grupo (o lado já é inferido).
const stats = ref<StatRow[]>([]);
const statsOk = ref(false);
// Quadro 2 (coluna do meio) alterna entre números, escalação lado a lado e em campo.
const panelView = ref<'stats' | 'lista' | 'campo'>('stats');
const lineupOk = ref(false);
// Partidas ao vivo (barra de troca acima do placar).
const liveMatches = ref<Match[]>([]);
// Edição inline de um comentário (mantém a posição — ordena por createdAt, que não muda).
const editingId = ref<string | null>(null);
const editText = ref('');
const editMinute = ref('');

function err(e: unknown) {
  ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro');
}

async function loadMatch() {
  try {
    match.value = await useApi()<Match>(`/matches/${matchId}`);
  } catch (e) { err(e); }
}
async function loadNotes() {
  try {
    notes.value = await useApi()<MatchNote[]>(`/admin/matches/${matchId}/notes`);
    scrollDown(streamEl);
  } catch (e) { err(e); }
}
async function loadEspn() {
  try {
    const prev = espn.value.length;
    espn.value = await useApi()<EspnLine[]>(`/admin/matches/${matchId}/commentary`);
    if (espn.value.length !== prev) scrollDown(espnEl);
  } catch { /* feed opcional — silencioso */ }
}
async function loadEvents() {
  try {
    const tl = await useApi()<MatchTimeline>(`/matches/${matchId}/events`);
    // Guarda TODOS os eventos: o feed filtra gols/cartões; as substituições vão pra
    // barra de placar.
    events.value = (tl.periods ?? []).flatMap((p) => p.events);
  } catch { /* feed opcional — silencioso */ }
}
async function loadStats() {
  try {
    const s = await useApi()<MatchStats>(`/matches/${matchId}/stats`);
    statsOk.value = !!s.available;
    stats.value = s.rows ?? [];
  } catch { /* feed opcional — silencioso */ }
}
function statNum(v: string | null): number {
  const n = parseFloat((v ?? '').replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
}
function statHomePct(r: StatRow): number {
  const h = statNum(r.home);
  const a = statNum(r.away);
  return h + a <= 0 ? 50 : Math.round((h / (h + a)) * 100);
}
function statFmt(v: string | null, key: string): string {
  if (v == null) return '—';
  return key === 'possessionPct' ? `${v}%` : v;
}
async function loadLive() {
  try {
    const r = await useApi()<{ days: { matches: Match[] }[] }>(`/agenda?scope=live`);
    liveMatches.value = (r.days ?? []).flatMap((d) => d.matches);
  } catch { /* silencioso */ }
}
function scrollDown(el: typeof streamEl) {
  nextTick(() => { if (el.value) el.value.scrollTop = el.value.scrollHeight; });
}

onMounted(() => { void loadMatch(); void loadNotes(); void loadEspn(); void loadEvents(); void loadStats(); void loadLive(); });

// Placar/relógio + novos lances ao vivo: o robô emite no canal da partida → re-busca.
useRealtime(() => [`match:${matchId}`], () => { void loadMatch(); void loadEspn(); void loadEvents(); void loadStats(); void loadLive(); });
// Rede de segurança: re-puxa a narração da ESPN a cada 20s enquanto o jogo rola
// (o feed pode chegar sem um evento de realtime correspondente).
let poll: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  poll = setInterval(() => {
    void loadLive(); // a barra de partidas ao vivo atualiza mesmo se a atual não estiver LIVE
    if (match.value?.status === 'LIVE') { void loadEspn(); void loadEvents(); void loadStats(); }
  }, 20_000);
});
onBeforeUnmount(() => clearInterval(poll));

const isLive = computed(() => match.value?.status === 'LIVE');
const isFinished = computed(() => match.value?.status === 'FINISHED');

async function send() {
  const t = text.value.trim();
  if (!t || sending.value) return;
  // Auto: relógio ao vivo (pode ser nulo se não estiver LIVE). Manual: o que foi digitado (ou vazio).
  const minute = autoTime.value ? match.value?.liveClock || null : manualTime.value.trim() || null;
  sending.value = true;
  try {
    const note = await useApi()<MatchNote>(`/admin/matches/${matchId}/notes`, { method: 'POST', body: { text: t, minute } });
    notes.value = [...notes.value, note];
    text.value = '';
    scrollDown(streamEl);
  } catch (e) { err(e); } finally { sending.value = false; }
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
}
async function removeNote(id: string) {
  const prev = notes.value;
  notes.value = notes.value.filter((n) => n.id !== id); // otimista
  try {
    await useApi()(`/admin/matches/${matchId}/notes/${id}`, { method: 'DELETE' });
  } catch (e) { notes.value = prev; err(e); }
}

function startEdit(n: MatchNote) {
  editingId.value = n.id;
  editText.value = n.text;
  editMinute.value = n.minute ?? '';
}
function cancelEdit() { editingId.value = null; }
async function saveEdit() {
  const id = editingId.value;
  const t = editText.value.trim();
  if (!id || !t) return;
  try {
    const updated = await useApi()<MatchNote>(`/admin/matches/${matchId}/notes/${id}`, {
      method: 'PATCH',
      body: { text: t, minute: editMinute.value.trim() || null },
    });
    notes.value = notes.value.map((n) => (n.id === id ? updated : n)); // mesma posição
    editingId.value = null;
  } catch (e) { err(e); }
}
function onEditKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void saveEdit(); }
  else if (e.key === 'Escape') { cancelEdit(); }
}

// Puxa uma linha da ESPN pro composer como BASE de um comentário editorial: o tempo
// vai pro campo manual e o texto pro corpo (o admin reescreve em PT do seu jeito).
function useLine(l: EspnLine) {
  text.value = l.text;
  if (l.minute) { autoTime.value = false; manualTime.value = l.minute; }
  nextTick(() => composerEl.value?.focus());
}

async function generate(force = false) {
  generating.value = true;
  try {
    const item = await useApi()<{ id: string }>(`/admin/matches/${matchId}/generate-report${force ? '?force=true' : ''}`, { method: 'POST' });
    ui.toast('success', 'Matéria gerada! Abrindo na Revisão.');
    navigateTo(`/admin/content/revisao/${item.id}`);
  } catch (e: unknown) {
    const ex = e as { data?: { code?: string; message?: string } };
    if (ex?.data?.code === 'CAP_EXCEEDED') {
      generating.value = false;
      if (await ui.confirm({ title: 'Limite do dia atingido', msg: ex.data.message ?? '', confirmLabel: 'Gerar mesmo assim', danger: true })) {
        await generate(true);
      }
      return;
    }
    err(e);
  } finally { generating.value = false; }
}

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tz.value }).format(new Date(iso));
}

// Rótulo/categoria pt-BR de um tipo de lance da ESPN (pra colorir e marcar a linha).
function espnMeta(type: string | null): { label: string; cls: string } | null {
  const t = (type ?? '').toLowerCase();
  if (!t) return null;
  if (t.includes('goal')) return { label: 'Gol', cls: 'goal' };
  if (t.includes('yellow')) return { label: 'Amarelo', cls: 'card' };
  if (t.includes('red')) return { label: 'Vermelho', cls: 'red' };
  if (t.includes('substitution')) return { label: 'Subst.', cls: 'sub' };
  if (t.includes('shot') || t.includes('save')) return { label: 'Finalização', cls: 'shot' };
  if (t.includes('corner')) return { label: 'Escanteio', cls: 'shot' };
  if (t.includes('foul')) return { label: 'Falta', cls: 'foul' };
  if (t.includes('offside')) return { label: 'Impedimento', cls: 'foul' };
  if (t.includes('var') || t.includes('review')) return { label: 'VAR', cls: 'var' };
  if (t.includes('penalty')) return { label: 'Pênalti', cls: 'goal' };
  if (t.includes('delay')) return { label: 'Pausa', cls: 'muted' };
  return null;
}
const sideName = (s: 'home' | 'away' | null) =>
  s === 'home' ? (match.value?.homeTeam?.shortName ?? match.value?.homeTeam?.name ?? '')
  : s === 'away' ? (match.value?.awayTeam?.shortName ?? match.value?.awayTeam?.name ?? '')
  : '';
const sideTeam = (s: 'home' | 'away' | null) =>
  s === 'home' ? (match.value?.homeTeam ?? null) : s === 'away' ? (match.value?.awayTeam ?? null) : null;

// Linhas do feed de eventos-chave: ícone (bola/cartão), nome, minuto, time.
const keyRows = computed(() =>
  events.value
    .filter((e) => KEY_TYPES.includes(e.type))
    .map((e) => {
    const goal = e.type.includes('GOAL');
    let cls = 'goal';
    let card: 'yellow' | 'red' | 'two' | null = null;
    let tag: string | null = null;
    if (e.type === 'YELLOW') { cls = 'yellow'; card = 'yellow'; }
    else if (e.type === 'RED') { cls = 'red'; card = 'red'; }
    else if (e.type === 'SECOND_YELLOW') { cls = 'red'; card = 'two'; tag = '2º amarelo'; }
    else if (e.type === 'OWN_GOAL') { tag = 'contra'; }
    else if (e.type === 'PENALTY_GOAL') { tag = 'pênalti'; }
    return { minute: e.minute, player: e.player || 'A definir', side: e.side, goal, cls, card, tag };
  }),
);
const homeRows = computed(() => keyRows.value.filter((r) => r.side === 'home'));
const awayRows = computed(() => keyRows.value.filter((r) => r.side === 'away'));

// Substituições (barra de placar): entrou (player) / saiu (related), por lado.
function surname(name: string | null): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || name;
}
const subs = computed(() =>
  events.value
    .filter((e) => e.type === 'SUBSTITUTION')
    .map((e) => ({ in: surname(e.player), out: surname(e.related), minute: e.minute, side: e.side })),
);
const homeSubs = computed(() => subs.value.filter((s) => s.side === 'home'));
const awaySubs = computed(() => subs.value.filter((s) => s.side === 'away'));
// Diretiva: roda do mouse (vertical) rola o elemento na horizontal. Listener
// NÃO-passivo (preventDefault precisa); reanexa sozinho quando a barra (v-if) monta.
const vHscroll = {
  mounted(el: HTMLElement) {
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || !e.deltaY) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    (el as HTMLElement & { _hscroll?: (e: WheelEvent) => void })._hscroll = onWheel;
    el.addEventListener('wheel', onWheel, { passive: false });
  },
  unmounted(el: HTMLElement & { _hscroll?: (e: WheelEvent) => void }) {
    if (el._hscroll) el.removeEventListener('wheel', el._hscroll);
  },
};

// Totais do footer: gols vêm do PLACAR (trata gol contra/pênalti certo); amarelos
// e vermelhos (incl. 2º amarelo) contados dos eventos por lado. Sempre 0 no vazio.
const totals = computed(() => {
  const mk = () => ({ goals: 0, yellow: 0, red: 0 });
  const home = mk();
  const away = mk();
  for (const e of events.value) {
    const b = e.side === 'home' ? home : e.side === 'away' ? away : null;
    if (!b) continue;
    if (e.type === 'YELLOW') b.yellow++;
    else if (e.type === 'RED' || e.type === 'SECOND_YELLOW') b.red++;
  }
  home.goals = match.value?.homeScore ?? 0;
  away.goals = match.value?.awayScore ?? 0;
  const total = { goals: home.goals + away.goals, yellow: home.yellow + away.yellow, red: home.red + away.red };
  return { home, away, total };
});
</script>

<template>
  <div v-if="match" class="narr-page">
    <AdminPageHeader
      title="Narração ao vivo"
      :subtitle="`${match.homeTeam?.name ?? '—'} x ${match.awayTeam?.name ?? '—'}${match.season ? '  ·  ' + match.season.name : ''} — seus comentários viram fatos da matéria`"
    >
      <template #actions>
        <NuxtLink to="/admin/live" class="btn">Voltar</NuxtLink>
        <button
          class="btn btn-primary"
          :disabled="generating || !isFinished"
          :title="isFinished ? 'Gera a matéria usando seus comentários como fatos' : 'Disponível após o apito (jogo encerrado)'"
          @click="generate(false)"
        >
          <AppIcon name="refresh" :size="14" :stroke="2.2" :class="{ spin: generating }" /> {{ generating ? 'Gerando…' : 'Gerar matéria' }}
        </button>
      </template>
    </AdminPageHeader>

    <!-- Barra de troca entre partidas ao vivo (sempre visível) -->
    <div class="livebar">
      <span class="lb-label" :class="{ off: !liveMatches.length }"><span class="ld" />Ao vivo</span>
      <div v-if="liveMatches.length" class="lb-scroll">
        <NuxtLink
          v-for="m in liveMatches" :key="m.id"
          :to="`/admin/narracao/${m.id}`"
          class="lb-chip" :class="{ active: m.id === matchId }"
          :title="`${m.homeTeam?.name ?? '—'} x ${m.awayTeam?.name ?? '—'}`"
        >
          <TeamBadge :team="m.homeTeam" :size="16" />
          <span class="lb-sc">{{ m.homeScore ?? 0 }}-{{ m.awayScore ?? 0 }}</span>
          <TeamBadge :team="m.awayTeam" :size="16" />
          <span v-if="m.liveClock" class="lb-clock">{{ m.liveClock }}</span>
        </NuxtLink>
      </div>
      <span v-else class="lb-empty">Nenhuma partida ao vivo agora.</span>
    </div>

    <!-- Faixa de placar ao vivo -->
    <div class="scorebar" :class="{ live: isLive }">
      <div class="sb-team">
        <TeamBadge :team="match.homeTeam" :size="34" />
        <span class="sb-name">{{ match.homeTeam?.shortName ?? match.homeTeam?.name ?? '—' }}</span>
      </div>
      <div class="sb-mid">
        <span class="sb-score">{{ match.homeScore ?? 0 }} <span class="sb-x">×</span> {{ match.awayScore ?? 0 }}</span>
        <span class="sb-status">
          <span v-if="isLive" class="ld" />{{ isLive ? (match.liveClock || 'AO VIVO') : match.status === 'FINISHED' ? 'Encerrado' : 'Agendado' }}
        </span>
      </div>
      <div class="sb-team end">
        <span class="sb-name">{{ match.awayTeam?.shortName ?? match.awayTeam?.name ?? '—' }}</span>
        <TeamBadge :team="match.awayTeam" :size="34" />
      </div>
    </div>

    <div class="cols">
      <!-- COLUNA 1 — substituições da casa (esq.) + seus comentários -->
      <div class="sidecol">
        <div v-if="homeSubs.length" v-hscroll class="subbar2 left">
          <span v-for="(s, i) in homeSubs" :key="`sh${i}`" class="subcard">
            <span class="sub-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path class="up" d="M17 7v12M17 7l-3 3M17 7l3 3" /><path class="down" d="M7 17V5M7 17l-3-3M7 17l3-3" /></svg>
            </span>
            <span class="sub-names"><span class="sub-in">{{ s.in }}</span><span class="sub-out">{{ s.out }}</span></span>
            <span v-if="s.minute" class="sub-min">{{ s.minute }}</span>
          </span>
        </div>
        <section class="card adm-panel chat">
        <header class="col-head">
          <h3 class="col-h">Seus comentários</h3>
          <span class="col-tag gold">vira fato da matéria</span>
        </header>
        <div ref="streamEl" class="stream">
          <p v-if="!notes.length" class="empty">Comece a narrar — escreva o que você vê. Cada comentário entra como fato da matéria. Dica: clique em “usar” num lance da ESPN ao lado pra puxar como base.</p>
          <div v-for="n in notes" :key="n.id" class="eline mine" :class="{ editing: editingId === n.id }">
            <template v-if="editingId === n.id">
              <div class="edit-row">
                <input v-model="editMinute" class="input edit-min" maxlength="12" placeholder="tempo" />
                <textarea v-model="editText" class="input edit-ta" rows="2" @keydown="onEditKeydown" />
              </div>
              <div class="edit-acts">
                <button class="btn btn-sm" @click="cancelEdit">Cancelar</button>
                <button class="btn btn-sm btn-primary" :disabled="!editText.trim()" @click="saveEdit">Salvar</button>
              </div>
            </template>
            <template v-else>
              <div class="eline-top">
                <span v-if="n.minute" class="eline-min">{{ n.minute }}</span>
                <span class="eline-tag mine">Seu</span>
                <span class="eline-time">{{ fmtTime(n.createdAt) }}</span>
                <span class="eline-acts">
                  <button class="msg-act" title="Editar" @click="startEdit(n)"><AppIcon name="edit" :size="12" :stroke="2.2" /></button>
                  <button class="msg-act del" title="Excluir" @click="removeNote(n.id)"><AppIcon name="close" :size="12" :stroke="2.4" /></button>
                </span>
              </div>
              <p class="eline-text">{{ n.text }}</p>
            </template>
          </div>
        </div>
        <div class="composer">
          <div class="time-ctl">
            <label class="autochk">
              <input v-model="autoTime" type="checkbox" />
              <span>Tempo automático</span>
            </label>
            <span v-if="autoTime" class="auto-hint">
              {{ match.liveClock ? `→ marca ${match.liveClock}` : '→ sem tempo (jogo não está ao vivo)' }}
            </span>
            <input
              v-else v-model="manualTime" class="input time-in" maxlength="12"
              placeholder="tempo (ex.: 67') — pode deixar vazio"
            />
          </div>
          <div class="composer-row">
            <textarea
              ref="composerEl" v-model="text" class="input ta" rows="2"
              placeholder="Escreva um comentário e Enter para enviar (Shift+Enter quebra linha)…"
              @keydown="onKeydown"
            />
            <button class="btn btn-primary send" :disabled="!text.trim() || sending" @click="send">
              <AppIcon name="arrowUp" :size="16" :stroke="2.4" />
            </button>
          </div>
        </div>
        </section>
      </div>

      <!-- COLUNA 2 — quadro de gols/cartões EM CIMA do quadro da narração ESPN -->
      <div class="midcol">
        <!-- Quadro 1: feed de eventos-chave (gols, amarelos, vermelhos) -->
        <section class="card adm-panel kfeed-card">
          <header class="col-head">
            <h3 class="col-h">Gols e cartões</h3>
            <span class="col-tag" :class="{ liveon: isLive }">
              <span v-if="isLive" class="ld sm" />{{ keyRows.length }} {{ keyRows.length === 1 ? 'evento' : 'eventos' }}
            </span>
          </header>
          <div class="kf-body">
            <div class="kf-grid">
              <div class="kf-col">
                <template v-if="homeRows.length">
                  <div v-for="(r, i) in homeRows" :key="`h${i}`" class="kf-row" :class="{ goalrow: r.goal }">
                    <span class="kf-min">{{ r.minute || '—' }}</span>
                    <span class="kf-ico">
                      <span v-if="r.goal" class="kf-ball">⚽</span>
                      <span v-else-if="r.card === 'two'" class="kf-card2" aria-hidden="true"><i class="kf-card yellow" /><i class="kf-card red" /></span>
                      <i v-else class="kf-card" :class="r.card" />
                    </span>
                    <span class="kf-name">{{ r.player }}<small v-if="r.tag" class="kf-tag" :class="{ danger: r.cls === 'red' }">{{ r.tag }}</small></span>
                  </div>
                </template>
                <div v-else class="kf-empty">
                  <svg class="kf-sleep" viewBox="0 0 48 48" width="38" height="38" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="21" cy="29" r="12" />
                    <path d="M13 27q3 2.6 6 0M23 27q3 2.6 6 0M17 34h7" />
                    <text x="33" y="16" font-size="9" font-weight="700" stroke="none" fill="currentColor">z</text>
                    <text x="39" y="11" font-size="12" font-weight="700" stroke="none" fill="currentColor">Z</text>
                  </svg>
                  <span class="kf-zzz">zzzZZZ</span>
                </div>
              </div>
              <div class="kf-col away">
                <template v-if="awayRows.length">
                  <div v-for="(r, i) in awayRows" :key="`a${i}`" class="kf-row mirror" :class="{ goalrow: r.goal }">
                    <span class="kf-name">{{ r.player }}<small v-if="r.tag" class="kf-tag" :class="{ danger: r.cls === 'red' }">{{ r.tag }}</small></span>
                    <span class="kf-ico">
                      <span v-if="r.goal" class="kf-ball">⚽</span>
                      <span v-else-if="r.card === 'two'" class="kf-card2" aria-hidden="true"><i class="kf-card yellow" /><i class="kf-card red" /></span>
                      <i v-else class="kf-card" :class="r.card" />
                    </span>
                    <span class="kf-min">{{ r.minute || '—' }}</span>
                  </div>
                </template>
                <div v-else class="kf-empty">
                  <svg class="kf-sleep" viewBox="0 0 48 48" width="38" height="38" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="21" cy="29" r="12" />
                    <path d="M13 27q3 2.6 6 0M23 27q3 2.6 6 0M17 34h7" />
                    <text x="33" y="16" font-size="9" font-weight="700" stroke="none" fill="currentColor">z</text>
                    <text x="39" y="11" font-size="12" font-weight="700" stroke="none" fill="currentColor">Z</text>
                  </svg>
                  <span class="kf-zzz">zzzZZZ</span>
                </div>
              </div>
            </div>
          </div>
          <!-- Footer: totais por time (cada lado) + total da partida no meio -->
          <footer class="kf-foot">
            <div class="kff-side">
              <span class="kff-stat"><span class="kf-ball">⚽</span>{{ totals.home.goals }}</span>
              <span class="kff-stat"><i class="kf-card yellow" />{{ totals.home.yellow }}</span>
              <span class="kff-stat"><i class="kf-card red" />{{ totals.home.red }}</span>
            </div>
            <div class="kff-mid">
              <span class="kff-stat"><span class="kf-ball">⚽</span>{{ totals.total.goals }}</span>
              <span class="kff-stat"><i class="kf-card yellow" />{{ totals.total.yellow }}</span>
              <span class="kff-stat"><i class="kf-card red" />{{ totals.total.red }}</span>
            </div>
            <div class="kff-side end">
              <span class="kff-stat"><span class="kf-ball">⚽</span>{{ totals.away.goals }}</span>
              <span class="kff-stat"><i class="kf-card yellow" />{{ totals.away.yellow }}</span>
              <span class="kff-stat"><i class="kf-card red" />{{ totals.away.red }}</span>
            </div>
          </footer>
        </section>

        <!-- Quadro 2: alterna entre estatísticas, escalação lado a lado e em campo -->
        <section class="card adm-panel stats-col">
          <header class="col-head">
            <div class="pv-seg" role="tablist" aria-label="Modo de visualização do quadro">
              <button
                class="pv-btn" :class="{ on: panelView === 'stats' }"
                role="tab" :aria-selected="panelView === 'stats'" @click="panelView = 'stats'"
              >
                <AppIcon name="dashboard" :size="13" :stroke="2.2" /><span>Estatísticas</span>
              </button>
              <button
                class="pv-btn" :class="{ on: panelView === 'lista' }"
                role="tab" :aria-selected="panelView === 'lista'" @click="panelView = 'lista'"
              >
                <AppIcon name="list" :size="13" :stroke="2.2" /><span>Esc. lista</span>
              </button>
              <button
                class="pv-btn" :class="{ on: panelView === 'campo' }"
                role="tab" :aria-selected="panelView === 'campo'" @click="panelView = 'campo'"
              >
                <AppIcon name="stadium" :size="13" :stroke="2.2" /><span>Esc. campo</span>
              </button>
            </div>
          </header>
          <div class="stream stats-stream">
            <!-- ESTATÍSTICAS -->
            <template v-if="panelView === 'stats'">
              <div v-if="statsOk && stats.length" class="nstats">
                <div v-for="r in stats" :key="r.key" class="nst-row">
                  <div class="nst-head">
                    <span class="nst-val">{{ statFmt(r.home, r.key) }}</span>
                    <span class="nst-lbl">{{ r.label }}</span>
                    <span class="nst-val">{{ statFmt(r.away, r.key) }}</span>
                  </div>
                  <div class="nst-bar">
                    <span class="bh" :style="{ width: `${statHomePct(r)}%` }" />
                    <span class="ba" :style="{ width: `${100 - statHomePct(r)}%` }" />
                  </div>
                </div>
              </div>
              <p v-else class="empty">
                Sem estatísticas ainda. O robô ingere posse, finalizações, faltas e cartões durante o jogo (em produção) — aparecem aqui e atualizam ao vivo.
              </p>
            </template>
            <!-- ESCALAÇÃO (lado a lado / em campo) — MatchLineup controlado e sem card -->
            <template v-else>
              <MatchLineup
                :match="match"
                :view="panelView === 'campo' ? 'campo' : 'lista'"
                flat
                @available="lineupOk = $event"
              />
              <p v-if="!lineupOk" class="empty">
                Escalação ainda não disponível. As formações chegam cerca de 1h antes do apito inicial (em produção) e atualizam com as substituições ao vivo.
              </p>
            </template>
          </div>
        </section>
      </div>

      <!-- COLUNA 3 — substituições do visitante (dir.) + narração ESPN -->
      <div class="sidecol">
        <div v-if="awaySubs.length" v-hscroll class="subbar2 right">
          <span v-for="(s, i) in awaySubs" :key="`sa${i}`" class="subcard">
            <span v-if="s.minute" class="sub-min">{{ s.minute }}</span>
            <span class="sub-names end"><span class="sub-in">{{ s.in }}</span><span class="sub-out">{{ s.out }}</span></span>
            <span class="sub-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path class="up" d="M17 7v12M17 7l-3 3M17 7l3 3" /><path class="down" d="M7 17V5M7 17l-3-3M7 17l3-3" /></svg>
            </span>
          </span>
        </div>
        <section class="card adm-panel espn">
        <header class="col-head">
          <h3 class="col-h">Narração ESPN</h3>
          <span class="col-tag" :class="{ liveon: isLive }">
            <span v-if="isLive" class="ld sm" />{{ espn.length }} {{ espn.length === 1 ? 'lance' : 'lances' }}
          </span>
        </header>
        <div ref="espnEl" class="stream espn-stream">
          <p v-if="!espn.length" class="empty">
            Sem narração da ESPN ainda. O robô captura o feed humano lance a lance durante o jogo (em produção) — aparece aqui e alimenta os fatos da matéria.
          </p>
          <div v-for="l in espn" :key="l.id" class="eline" :class="espnMeta(l.type)?.cls">
            <div class="eline-top">
              <span v-if="l.minute" class="eline-min">{{ l.minute }}</span>
              <span v-if="espnMeta(l.type)" class="eline-tag" :class="espnMeta(l.type)?.cls">{{ espnMeta(l.type)?.label }}</span>
              <TeamBadge v-if="sideTeam(l.side)" :team="sideTeam(l.side)" :size="16" class="eline-flag" :title="sideName(l.side)" />
              <button class="eline-use" title="Usar como base de um comentário seu" @click="useLine(l)">
                <AppIcon name="arrowUp" :size="11" :stroke="2.4" /> usar
              </button>
            </div>
            <p class="eline-text">{{ l.text }}</p>
          </div>
        </div>
        </section>
      </div>
    </div>
  </div>
  <div v-else class="muted-txt">Carregando…</div>
</template>

<style scoped>
.narr-page { display: flex; flex-direction: column; gap: 14px; }
/* barra de troca entre partidas ao vivo */
.livebar { display: flex; align-items: center; gap: 10px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 12px; padding: 7px 12px; }
.lb-label { flex: none; display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--scarlet); }
.lb-label.off { color: var(--muted); }
.lb-label.off .ld { background: var(--muted); animation: none; box-shadow: none; }
.lb-empty { font-size: var(--fs-xs); font-weight: 600; color: var(--muted); }
.lb-scroll { display: flex; gap: 8px; overflow-x: auto; min-width: 0; }
.lb-chip { flex: none; display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border); border-radius: 999px; padding: 4px 10px; text-decoration: none; color: var(--text); background: var(--bg-base); transition: border-color 0.14s, background 0.14s; }
.lb-chip:hover { border-color: color-mix(in srgb, var(--scarlet) 40%, var(--border)); }
.lb-chip.active { border-color: var(--scarlet); background: color-mix(in srgb, var(--scarlet) 10%, var(--bg-base)); }
.lb-sc { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: var(--fs-sm); font-variant-numeric: tabular-nums; }
.lb-clock { font-size: var(--fs-2xs); font-weight: 800; color: var(--scarlet); font-variant-numeric: tabular-nums; }
.scorebar { display: flex; align-items: center; justify-content: center; gap: 18px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 12px; padding: 10px 16px; }
/* substituições — 2 barras (1 por time) acima das colunas laterais; scroll lateral
   pela roda do mouse, sem barra de rolagem visível. Casa à esq., visitante à dir. */
.subbar2 { flex: 0 0 auto; display: flex; gap: 8px; overflow-x: auto; overflow-y: hidden; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 12px; padding: 7px 10px; scrollbar-width: none; }
.subbar2::-webkit-scrollbar { display: none; }
/* alinha o grupo à direita sem quebrar o scroll (evita o bug do justify flex-end) */
.subbar2.right > .subcard:first-child { margin-inline-start: auto; }
.subcard { flex: none; display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg-base); padding: 4px 9px; }
.sub-ico { display: grid; place-items: center; flex: none; }
.sub-ico .up { stroke: var(--emerald); }
.sub-ico .down { stroke: var(--scarlet, #e23744); }
.sub-names { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; }
.sub-names.end { text-align: right; }
.sub-in { font-size: var(--fs-xs); font-weight: 800; color: var(--emerald); white-space: nowrap; }
.sub-out { font-size: var(--fs-2xs); font-weight: 700; color: var(--muted); white-space: nowrap; }
.sub-min { font-family: 'Oswald', sans-serif; font-size: var(--fs-2xs); font-weight: 700; color: var(--muted); font-variant-numeric: tabular-nums; flex: none; }
.scorebar.live { border-color: color-mix(in srgb, var(--scarlet) 40%, var(--border)); }
.sb-team { display: flex; align-items: center; gap: 9px; min-width: 0; flex: 1; }
.sb-team.end { justify-content: flex-end; }
.sb-name { font-weight: 800; font-size: var(--fs-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sb-mid { display: flex; flex-direction: column; align-items: center; gap: 2px; flex: 0 0 auto; }
.sb-score { font-family: 'Oswald', sans-serif; font-size: var(--fs-2xl); font-weight: 700; line-height: 1; }
.sb-x { color: var(--muted); font-size: var(--fs-lg); }
.sb-status { font-size: var(--fs-xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); display: inline-flex; align-items: center; gap: 5px; }
.ld { width: 7px; height: 7px; border-radius: 50%; background: var(--scarlet); box-shadow: 0 0 0 0 color-mix(in srgb, var(--scarlet) 60%, transparent); animation: pulse 1.4s infinite; }
.ld.sm { width: 6px; height: 6px; }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--scarlet) 55%, transparent); } 70% { box-shadow: 0 0 0 6px transparent; } }

.cols { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; height: calc(100vh - 250px); min-height: 440px; }
@media (max-width: 1180px) { .cols { grid-template-columns: 1fr 1fr; height: auto; } }
@media (max-width: 760px) { .cols { grid-template-columns: 1fr; } }
.stats-stream { padding: 14px; }
/* switch de 3 estados do quadro do meio (estatísticas / lado a lado / campo) */
.pv-seg { display: inline-flex; flex: 1 1 auto; min-width: 0; gap: 2px; padding: 2px; border: 1px solid var(--border); border-radius: 999px; background: var(--bg-base); }
.pv-btn { flex: 1 1 0; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 5px; border: 0; background: transparent; color: var(--muted); font-weight: 700; font-size: var(--fs-2xs); text-transform: uppercase; letter-spacing: 0.03em; padding: 5px 6px; border-radius: 999px; cursor: pointer; white-space: nowrap; transition: background 0.16s, color 0.16s; }
.pv-btn svg { flex: none; }
.pv-btn:hover:not(.on) { color: var(--text); }
.pv-btn.on { background: var(--text); color: #fff; }
.stats-col .col-tag { flex: none; }
@media (max-width: 1320px) { .pv-btn span { display: none; } .pv-btn { padding: 6px 8px; } }
/* estatísticas — lista plana desta tela (sem cabeçalho de times nem grupos) */
.nstats { display: flex; flex-direction: column; gap: 13px; }
.nst-head { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; margin-bottom: 5px; }
.nst-val { font-size: var(--fs-sm); font-weight: 800; font-variant-numeric: tabular-nums; }
.nst-val:first-child { text-align: left; }
.nst-val:last-child { text-align: right; }
.nst-lbl { font-size: var(--fs-xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); text-align: center; }
.nst-bar { display: flex; height: 6px; border-radius: 3px; overflow: hidden; background: var(--bg-base); gap: 2px; }
.nst-bar .bh { background: var(--azure, #2b7fff); border-radius: 3px 0 0 3px; }
.nst-bar .ba { background: var(--scarlet, #e23744); border-radius: 0 3px 3px 0; }

.adm-panel { display: flex; flex-direction: column; padding: 0; overflow: hidden; }
.col-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--border); background: var(--bg-surface); }
.col-h { font-size: var(--fs-xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 0; }
.col-tag { font-size: var(--fs-xs); font-weight: 700; color: var(--muted); display: inline-flex; align-items: center; gap: 5px; }
.col-tag.gold { color: var(--gold); }
.col-tag.liveon { color: var(--scarlet); }

.stream { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
@media (max-width: 1180px) { .stream { max-height: 52vh; } }
.empty { color: var(--muted); font-size: var(--fs-sm); line-height: 1.5; margin: auto; text-align: center; max-width: 320px; }

/* seus comentários — MESMO cartão da narração ESPN (.eline), com borda dourada
   marcando que é seu, e ações editar/excluir revelando no hover. */
.msg-act { display: inline-flex; border: none; background: none; color: var(--muted); cursor: pointer; padding: 1px; border-radius: 4px; opacity: 0; transition: opacity 0.12s, color 0.12s; }
.eline.mine:hover .msg-act { opacity: 1; }
.msg-act:hover { color: var(--azure); }
.msg-act.del:hover { color: var(--scarlet); }
.eline.mine.editing { background: var(--bg-surface); }
.edit-row { display: flex; gap: 6px; }
.edit-min { flex: 0 0 70px; font-size: var(--fs-xs); padding: 6px 8px; }
.edit-ta { flex: 1; resize: none; font-size: var(--fs-sm); }
.edit-acts { display: flex; justify-content: flex-end; gap: 6px; margin-top: 6px; }
.btn-sm { padding: 4px 10px; font-size: var(--fs-xs); }
.composer { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-top: 1px solid var(--border); background: var(--bg-surface); }
.time-ctl { display: flex; align-items: center; gap: 10px; }
.autochk { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-xs); font-weight: 600; color: var(--text); cursor: pointer; user-select: none; white-space: nowrap; }
.autochk input { cursor: pointer; accent-color: var(--azure); }
.auto-hint { font-size: var(--fs-xs); color: var(--muted); font-weight: 600; }
.time-in { flex: 1; max-width: 260px; font-size: var(--fs-sm); padding: 6px 10px; }
.composer-row { display: flex; gap: 8px; }
.ta { resize: none; flex: 1; }
.send { flex: 0 0 auto; align-self: stretch; padding: 0 16px; }

/* coluna do meio = dois quadros empilhados (gols/cartões EM CIMA + narração ESPN) */
.midcol { display: flex; flex-direction: column; gap: 16px; min-width: 0; min-height: 0; }
/* colunas laterais: barra de substituição (topo) + card preenchendo o resto */
.sidecol { display: flex; flex-direction: column; gap: 16px; min-width: 0; min-height: 0; }
.sidecol > .card { flex: 1 1 auto; min-height: 0; }
.kfeed-card { flex: 0 0 auto; max-height: 180px; min-height: 96px; }
.midcol .stats-col { flex: 1 1 auto; min-height: 0; }
.kf-body { flex: 1; overflow-y: auto; min-height: 0; display: flex; flex-direction: column; }
@media (max-width: 1180px) { .kfeed-card { max-height: none; } .kf-body { max-height: 38vh; } }

/* feed de eventos-chave (gols/cartões) — 2 colunas: casa | visitante */
.kf-grid { display: grid; grid-template-columns: 1fr 1fr; align-items: stretch; flex: 1; min-height: 0; }
.kf-col { display: flex; flex-direction: column; min-width: 0; }
/* empty state por coluna — carinha dormindo + zzzZZZ */
.kf-empty { margin: auto; display: flex; flex-direction: column; align-items: center; gap: 5px; color: var(--muted); padding: 14px 8px; }
.kf-sleep { opacity: 0.65; }
.kf-zzz { font-size: var(--fs-2xs); font-weight: 800; letter-spacing: 0.12em; color: var(--muted); }
.kf-col.away { border-left: 1px solid var(--border); }
.kf-row { display: grid; grid-template-columns: auto 18px minmax(0, 1fr); align-items: center; gap: 6px; padding: 3px 10px; border-top: 1px solid var(--border); }
/* coluna do visitante espelhada: nome · ícone · minuto, alinhada à direita */
.kf-row.mirror { grid-template-columns: minmax(0, 1fr) 18px auto; }
.kf-row.mirror .kf-name { text-align: right; }
.kf-col .kf-row:first-child { border-top: none; }
.kf-row.goalrow { background: color-mix(in srgb, var(--emerald) 8%, transparent); }
.kf-min { font-family: 'Oswald', sans-serif; font-size: var(--fs-2xs); font-weight: 700; color: var(--muted); font-variant-numeric: tabular-nums; text-align: center; }
.kf-row.goalrow .kf-min { color: var(--emerald); }
.kf-ico { display: grid; place-items: center; width: 18px; height: 18px; }
.kf-ball { font-size: var(--fs-sm); line-height: 1; }
.kf-card { display: inline-block; width: 10px; height: 13px; border-radius: 2px; border: 1px solid rgba(0, 0, 0, 0.3); }
.kf-card.yellow { background: #f5c518; }
.kf-card.red { background: var(--scarlet, #e23744); }
.kf-card2 { position: relative; width: 16px; height: 16px; }
.kf-card2 .kf-card { position: absolute; }
.kf-card2 .yellow { top: 0; left: 1px; transform: rotate(-14deg); }
.kf-card2 .red { bottom: 0; right: 1px; transform: rotate(10deg); }
.kf-name { font-size: var(--fs-xs); font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kf-tag { margin-left: 6px; font-size: var(--fs-2xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--gold); border: 1px solid color-mix(in srgb, var(--gold) 45%, transparent); border-radius: 4px; padding: 1px 4px; vertical-align: middle; }
.kf-tag.danger { color: var(--scarlet, #e23744); border-color: color-mix(in srgb, var(--scarlet, #e23744) 45%, transparent); }
/* footer de totais: time A | total | time B */
.kf-foot { flex: 0 0 auto; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; padding: 8px 14px; border-top: 1px solid var(--border); background: var(--bg-surface); }
.kff-side { display: flex; align-items: center; gap: 11px; min-width: 0; }
.kff-side.end { justify-content: flex-end; }
.kff-mid { display: flex; align-items: center; gap: 11px; padding: 2px 12px; border-left: 1px solid var(--border); border-right: 1px solid var(--border); }
.kff-stat { display: inline-flex; align-items: center; gap: 4px; font-size: var(--fs-xs); font-weight: 800; color: var(--text); font-variant-numeric: tabular-nums; }
.kff-stat .kf-card { width: 9px; height: 12px; }
.kff-stat .kf-ball { font-size: var(--fs-sm); line-height: 1; }

/* narração ESPN (read-only) */
.espn-stream { gap: 8px; }
.eline { background: var(--bg-base); border: 1px solid var(--border); border-radius: 10px; padding: 8px 11px; border-left: 3px solid var(--border); }
.eline.goal { border-left-color: var(--emerald); }
.eline.shot { border-left-color: var(--azure); }
.eline.card { border-left-color: var(--gold); }
.eline.red { border-left-color: var(--scarlet); }
.eline.foul { border-left-color: #e07b39; }
.eline.sub { border-left-color: var(--emerald); }
.eline.var { border-left-color: var(--azure); }
.eline-top { display: flex; align-items: center; gap: 7px; margin-bottom: 3px; }
.eline-min { font-family: 'Oswald', sans-serif; font-size: var(--fs-xs); font-weight: 700; color: var(--muted); font-variant-numeric: tabular-nums; }
.eline-tag { font-size: var(--fs-xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; border-radius: 4px; padding: 1px 6px; color: var(--muted); border: 1px solid var(--border); }
.eline-tag.goal { color: var(--emerald); border-color: color-mix(in srgb, var(--emerald) 45%, transparent); }
.eline-tag.shot { color: var(--azure); border-color: color-mix(in srgb, var(--azure) 45%, transparent); }
.eline-tag.card { color: var(--gold); border-color: color-mix(in srgb, var(--gold) 45%, transparent); }
.eline-tag.red { color: var(--scarlet); border-color: color-mix(in srgb, var(--scarlet) 45%, transparent); }
.eline-tag.foul { color: #e07b39; border-color: color-mix(in srgb, #e07b39 45%, transparent); }
.eline-tag.var { color: var(--azure); border-color: color-mix(in srgb, var(--azure) 45%, transparent); }
.eline-side { font-size: var(--fs-xs); font-weight: 700; color: var(--muted); }
/* variante "seu comentário": mesmo cartão, acento dourado */
.eline.mine { border-left-color: var(--gold); }
.eline-tag.mine { color: var(--gold); border-color: color-mix(in srgb, var(--gold) 45%, transparent); }
.eline-time { margin-left: auto; font-size: var(--fs-xs); font-weight: 600; color: var(--muted); }
.eline-acts { display: inline-flex; align-items: center; gap: 4px; }
.eline-use { margin-left: auto; display: inline-flex; align-items: center; gap: 3px; border: 1px solid var(--border); background: var(--bg-surface); color: var(--muted); font-size: var(--fs-xs); font-weight: 700; border-radius: 999px; padding: 2px 8px; cursor: pointer; transition: color 0.12s, border-color 0.12s; }
.eline-use:hover { color: var(--gold); border-color: color-mix(in srgb, var(--gold) 50%, var(--border)); }
.eline-text { font-size: var(--fs-sm); line-height: 1.45; color: var(--text); margin: 0; word-break: break-word; }

.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.muted-txt { font-size: var(--fs-sm); color: var(--muted); }
</style>
