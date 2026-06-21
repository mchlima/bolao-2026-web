<script setup lang="ts">
import type { Match, MatchNote } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
const route = useRoute();
const ui = useUiStore();
const tz = useTz();
const matchId = route.params.id as string;

const match = ref<Match | null>(null);
const notes = ref<MatchNote[]>([]);
const text = ref('');
const sending = ref(false);
const generating = ref(false);
const streamEl = ref<HTMLElement | null>(null);
// Tempo automático ligado = usa o relógio ao vivo; desligado = input manual (pode ir vazio).
const autoTime = ref(true);
const manualTime = ref('');

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
    scrollDown();
  } catch (e) { err(e); }
}
function scrollDown() {
  nextTick(() => { if (streamEl.value) streamEl.value.scrollTop = streamEl.value.scrollHeight; });
}

onMounted(() => { void loadMatch(); void loadNotes(); });

// Placar/relógio ao vivo: o robô emite eventos no canal da partida → re-busca o match.
useRealtime(() => [`match:${matchId}`], () => loadMatch());

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
    scrollDown();
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
      <!-- Narração (chat) -->
      <section class="card adm-panel chat">
        <div ref="streamEl" class="stream">
          <p v-if="!notes.length" class="empty">Comece a narrar — escreva o que você vê. Cada comentário entra como fato da matéria.</p>
          <div v-for="n in notes" :key="n.id" class="msg">
            <div class="msg-body"><span v-if="n.minute" class="msg-min">{{ n.minute }}</span>{{ n.text }}</div>
            <div class="msg-foot">
              <span class="msg-time">{{ fmtTime(n.createdAt) }}</span>
              <button class="msg-del" title="Excluir" @click="removeNote(n.id)"><AppIcon name="close" :size="12" :stroke="2.4" /></button>
            </div>
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
              v-model="text" class="input ta" rows="2"
              placeholder="Escreva um comentário e Enter para enviar (Shift+Enter quebra linha)…"
              @keydown="onKeydown"
            />
            <button class="btn btn-primary send" :disabled="!text.trim() || sending" @click="send">
              <AppIcon name="arrowUp" :size="16" :stroke="2.4" />
            </button>
          </div>
        </div>
      </section>

      <!-- Escalação ao vivo -->
      <section class="card adm-panel lineup">
        <h3 class="col-h">Escalação ao vivo</h3>
        <MatchLineup :match="match" :active="true" />
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
@keyframes pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--scarlet) 55%, transparent); } 70% { box-shadow: 0 0 0 6px transparent; } }

.cols { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(300px, 0.9fr); gap: 16px; height: calc(100vh - 250px); min-height: 420px; }
@media (max-width: 980px) { .cols { grid-template-columns: 1fr; height: auto; } }

/* Chat */
.chat { display: flex; flex-direction: column; padding: 0; overflow: hidden; }
.stream { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
@media (max-width: 980px) { .stream { max-height: 56vh; } }
.empty { color: var(--muted); font-size: 13.5px; line-height: 1.5; margin: auto; text-align: center; max-width: 320px; }
.msg { align-self: flex-start; max-width: 88%; background: var(--bg-base); border: 1px solid var(--border); border-radius: 12px; border-top-left-radius: 4px; padding: 9px 12px; }
.msg-body { font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
.msg-min { display: inline-block; font-size: 11px; font-weight: 800; color: var(--azure); background: color-mix(in srgb, var(--azure) 12%, transparent); border-radius: 5px; padding: 1px 6px; margin-right: 7px; vertical-align: 1px; font-variant-numeric: tabular-nums; }
.msg-foot { display: flex; align-items: center; gap: 8px; margin-top: 3px; }
.msg-time { font-size: 10.5px; color: var(--muted); font-weight: 600; }
.msg-del { display: inline-flex; border: none; background: none; color: var(--muted); cursor: pointer; padding: 1px; border-radius: 4px; opacity: 0; transition: opacity 0.12s, color 0.12s; }
.msg:hover .msg-del { opacity: 1; }
.msg-del:hover { color: var(--scarlet); }
.composer { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-top: 1px solid var(--border); background: var(--bg-surface); }
.time-ctl { display: flex; align-items: center; gap: 10px; }
.autochk { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--text); cursor: pointer; user-select: none; white-space: nowrap; }
.autochk input { cursor: pointer; accent-color: var(--azure); }
.auto-hint { font-size: 11.5px; color: var(--muted); font-weight: 600; }
.time-in { flex: 1; max-width: 260px; font-size: 13px; padding: 6px 10px; }
.composer-row { display: flex; gap: 8px; }
.ta { resize: none; flex: 1; }
.send { flex: 0 0 auto; align-self: stretch; padding: 0 16px; }

/* Lineup column */
.lineup { overflow-y: auto; }
.col-h { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 0 0 12px; }
.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.muted-txt { font-size: 13px; color: var(--muted); }
</style>
