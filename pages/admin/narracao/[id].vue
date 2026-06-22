<script setup lang="ts">
import type { Match, MatchNote } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
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
const text = ref('');
const sending = ref(false);
const generating = ref(false);
const streamEl = ref<HTMLElement | null>(null);
const espnEl = ref<HTMLElement | null>(null);
const composerEl = ref<HTMLTextAreaElement | null>(null);
// Tempo automático ligado = usa o relógio ao vivo; desligado = input manual (pode ir vazio).
const autoTime = ref(true);
const manualTime = ref('');
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
function scrollDown(el: typeof streamEl) {
  nextTick(() => { if (el.value) el.value.scrollTop = el.value.scrollHeight; });
}

onMounted(() => { void loadMatch(); void loadNotes(); void loadEspn(); });

// Placar/relógio + novos lances ao vivo: o robô emite no canal da partida → re-busca.
useRealtime(() => [`match:${matchId}`], () => { void loadMatch(); void loadEspn(); });
// Rede de segurança: re-puxa a narração da ESPN a cada 20s enquanto o jogo rola
// (o feed pode chegar sem um evento de realtime correspondente).
let poll: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  poll = setInterval(() => { if (match.value?.status === 'LIVE') void loadEspn(); }, 20_000);
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
      <!-- COLUNA 1 — seus comentários (viram fatos) -->
      <section class="card adm-panel chat">
        <header class="col-head">
          <h3 class="col-h">Seus comentários</h3>
          <span class="col-tag gold">vira fato da matéria</span>
        </header>
        <div ref="streamEl" class="stream">
          <p v-if="!notes.length" class="empty">Comece a narrar — escreva o que você vê. Cada comentário entra como fato da matéria. Dica: clique em “usar” num lance da ESPN ao lado pra puxar como base.</p>
          <div v-for="n in notes" :key="n.id" class="msg" :class="{ editing: editingId === n.id }">
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
              <div class="msg-body"><span v-if="n.minute" class="msg-min">{{ n.minute }}</span>{{ n.text }}</div>
              <div class="msg-foot">
                <span class="msg-time">{{ fmtTime(n.createdAt) }}</span>
                <button class="msg-act" title="Editar" @click="startEdit(n)"><AppIcon name="edit" :size="12" :stroke="2.2" /></button>
                <button class="msg-act del" title="Excluir" @click="removeNote(n.id)"><AppIcon name="close" :size="12" :stroke="2.4" /></button>
              </div>
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

      <!-- COLUNA 2 — narração humana da ESPN (ingerida, read-only) -->
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
              <span v-if="l.side" class="eline-side">{{ sideName(l.side) }}</span>
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
  <div v-else class="muted-txt">Carregando…</div>
</template>

<style scoped>
.narr-page { display: flex; flex-direction: column; gap: 14px; }
.scorebar { display: flex; align-items: center; justify-content: center; gap: 18px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 12px; padding: 10px 16px; }
.scorebar.live { border-color: color-mix(in srgb, var(--scarlet) 40%, var(--border)); }
.sb-team { display: flex; align-items: center; gap: 9px; min-width: 0; flex: 1; }
.sb-team.end { justify-content: flex-end; }
.sb-name { font-weight: 800; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sb-mid { display: flex; flex-direction: column; align-items: center; gap: 2px; flex: 0 0 auto; }
.sb-score { font-family: 'Oswald', sans-serif; font-size: 26px; font-weight: 700; line-height: 1; }
.sb-x { color: var(--muted); font-size: 18px; }
.sb-status { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); display: inline-flex; align-items: center; gap: 5px; }
.ld { width: 7px; height: 7px; border-radius: 50%; background: var(--scarlet); box-shadow: 0 0 0 0 color-mix(in srgb, var(--scarlet) 60%, transparent); animation: pulse 1.4s infinite; }
.ld.sm { width: 6px; height: 6px; }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--scarlet) 55%, transparent); } 70% { box-shadow: 0 0 0 6px transparent; } }

.cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; height: calc(100vh - 250px); min-height: 440px; }
@media (max-width: 980px) { .cols { grid-template-columns: 1fr; height: auto; } }

.adm-panel { display: flex; flex-direction: column; padding: 0; overflow: hidden; }
.col-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--border); background: var(--bg-surface); }
.col-h { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 0; }
.col-tag { font-size: 10.5px; font-weight: 700; color: var(--muted); display: inline-flex; align-items: center; gap: 5px; }
.col-tag.gold { color: var(--gold); }
.col-tag.liveon { color: var(--scarlet); }

.stream { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
@media (max-width: 980px) { .stream { max-height: 52vh; } }
.empty { color: var(--muted); font-size: 13px; line-height: 1.5; margin: auto; text-align: center; max-width: 320px; }

/* chat (seus comentários) */
.msg { align-self: flex-start; max-width: 88%; background: var(--bg-base); border: 1px solid var(--border); border-radius: 12px; border-top-left-radius: 4px; padding: 9px 12px; }
.msg-body { font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
.msg-min { display: inline-block; font-size: 11px; font-weight: 800; color: var(--azure); background: color-mix(in srgb, var(--azure) 12%, transparent); border-radius: 5px; padding: 1px 6px; margin-right: 7px; vertical-align: 1px; font-variant-numeric: tabular-nums; }
.msg-foot { display: flex; align-items: center; gap: 8px; margin-top: 3px; }
.msg-time { font-size: 10.5px; color: var(--muted); font-weight: 600; }
.msg-act { display: inline-flex; border: none; background: none; color: var(--muted); cursor: pointer; padding: 1px; border-radius: 4px; opacity: 0; transition: opacity 0.12s, color 0.12s; }
.msg:hover .msg-act { opacity: 1; }
.msg-act:hover { color: var(--azure); }
.msg-act.del:hover { color: var(--scarlet); }
.msg.editing { align-self: stretch; max-width: 100%; background: var(--bg-surface); }
.edit-row { display: flex; gap: 6px; }
.edit-min { flex: 0 0 70px; font-size: 12px; padding: 6px 8px; }
.edit-ta { flex: 1; resize: none; font-size: 14px; }
.edit-acts { display: flex; justify-content: flex-end; gap: 6px; margin-top: 6px; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.composer { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-top: 1px solid var(--border); background: var(--bg-surface); }
.time-ctl { display: flex; align-items: center; gap: 10px; }
.autochk { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--text); cursor: pointer; user-select: none; white-space: nowrap; }
.autochk input { cursor: pointer; accent-color: var(--azure); }
.auto-hint { font-size: 11.5px; color: var(--muted); font-weight: 600; }
.time-in { flex: 1; max-width: 260px; font-size: 13px; padding: 6px 10px; }
.composer-row { display: flex; gap: 8px; }
.ta { resize: none; flex: 1; }
.send { flex: 0 0 auto; align-self: stretch; padding: 0 16px; }

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
.eline-min { font-family: 'Oswald', sans-serif; font-size: 12px; font-weight: 700; color: var(--muted); font-variant-numeric: tabular-nums; }
.eline-tag { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; border-radius: 4px; padding: 1px 6px; color: var(--muted); border: 1px solid var(--border); }
.eline-tag.goal { color: var(--emerald); border-color: color-mix(in srgb, var(--emerald) 45%, transparent); }
.eline-tag.shot { color: var(--azure); border-color: color-mix(in srgb, var(--azure) 45%, transparent); }
.eline-tag.card { color: var(--gold); border-color: color-mix(in srgb, var(--gold) 45%, transparent); }
.eline-tag.red { color: var(--scarlet); border-color: color-mix(in srgb, var(--scarlet) 45%, transparent); }
.eline-tag.foul { color: #e07b39; border-color: color-mix(in srgb, #e07b39 45%, transparent); }
.eline-tag.var { color: var(--azure); border-color: color-mix(in srgb, var(--azure) 45%, transparent); }
.eline-side { font-size: 10.5px; font-weight: 700; color: var(--muted); }
.eline-use { margin-left: auto; display: inline-flex; align-items: center; gap: 3px; border: 1px solid var(--border); background: var(--bg-surface); color: var(--muted); font-size: 10.5px; font-weight: 700; border-radius: 999px; padding: 2px 8px; cursor: pointer; transition: color 0.12s, border-color 0.12s; }
.eline-use:hover { color: var(--gold); border-color: color-mix(in srgb, var(--gold) 50%, var(--border)); }
.eline-text { font-size: 13px; line-height: 1.45; color: var(--text); margin: 0; word-break: break-word; }

.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.muted-txt { font-size: 13px; color: var(--muted); }
</style>
