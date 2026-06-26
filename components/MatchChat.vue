<script setup lang="ts">
import type { ChatEvent, ChatListResult, ChatMessage } from '~/types/api';

// Chat AO VIVO da partida, escopado ao bolão. O histórico vem do banco
// (fonte da verdade); as mensagens novas chegam pelo SSE (payload-push) na room
// pool:<poolId>:match:<matchId>:chat. Um evento SEM payload (reconexão/foco)
// dispara um reconcile contra o banco — assim nada se perde se o SSE pular um.
// A sala só ACEITA ESCRITA no dia/durante o jogo (campo `open` do backend); fora
// disso o histórico continua legível. Só renderiza no contexto de bolão.
const props = defineProps<{ poolId: string; matchId: string; active?: boolean }>();

const auth = useAuthStore();
const ui = useUiStore();
const api = useApi();
const authLink = useAuthLink();
const { track } = useTrack();

const room = computed(() => `pool:${props.poolId}:match:${props.matchId}:chat`);
const base = computed(() => `/pools/${props.poolId}/matches/${props.matchId}/chat`);

const messages = ref<ChatMessage[]>([]);
const open = ref(false);
const hasMore = ref(false);
const canModerate = ref(false); // dono/admin do bolão ou admin global → apaga qualquer msg
const presence = ref(0); // "X na sala" (atualizado ao vivo via evento 'presence')
const loaded = ref(false);
const loading = ref(false);
const loadingOlder = ref(false);
const sending = ref(false);
const text = ref('');

const listRef = ref<HTMLElement | null>(null);
const endRef = ref<HTMLElement | null>(null);

const myId = computed(() => auth.user?.id ?? null);

function errMsg(e: unknown, fallback: string): string {
  return (e as { data?: { message?: string } })?.data?.message ?? fallback;
}
function byCreated(a: ChatMessage, b: ChatMessage): number {
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1;
}
function newNonce(): string {
  return globalThis.crypto?.randomUUID?.() ?? `n-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function isMine(m: ChatMessage): boolean {
  return !!myId.value && m.author.id === myId.value;
}
// Mostra avatar + nome só no 1º de uma sequência do mesmo autor (agrupa as seguidas).
function showMeta(i: number): boolean {
  const prev = messages.value[i - 1];
  return !prev || prev.author.id !== messages.value[i].author.id;
}
// Cor estável por usuário p/ o nome (estilo chat de grupo), derivada do id.
function nameColor(uid: string): string {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) % 360;
  return `hsl(${h} 55% 38%)`;
}

// ─────────────────────────────────────────────────────────── scroll
function nearBottom(): boolean {
  const el = listRef.value;
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
}
async function scrollToEnd(force = false): Promise<void> {
  if (import.meta.server) return;
  if (!force && !nearBottom()) return;
  await nextTick();
  endRef.value?.scrollIntoView({ block: 'end' });
}

// ─────────────────────────────────────────────────────────── fetch / merge
async function load(): Promise<void> {
  if (import.meta.server) return;
  loading.value = true;
  try {
    const res = await api<ChatListResult>(base.value);
    messages.value = [...res.messages].sort(byCreated);
    open.value = res.open;
    hasMore.value = res.hasMore;
    canModerate.value = res.canModerate;
    presence.value = res.presence;
    loaded.value = true;
    await scrollToEnd(true);
  } catch (e) {
    ui.toast('error', errMsg(e, 'Não foi possível carregar o chat.'));
  } finally {
    loading.value = false;
  }
}

// Reconexão: rebusca a página recente e mescla por id (cobre o gap típico de uma
// queda curta de SSE). Silencioso — se falhar, tenta de novo no próximo sinal.
async function reconcile(): Promise<void> {
  if (!loaded.value) return load();
  try {
    const res = await api<ChatListResult>(base.value);
    open.value = res.open;
    canModerate.value = res.canModerate;
    presence.value = res.presence;
    const seen = new Set(messages.value.map((m) => m.id));
    const fresh = res.messages.filter((m) => !seen.has(m.id));
    if (fresh.length) {
      messages.value = [...messages.value, ...fresh].sort(byCreated);
      await scrollToEnd();
    }
  } catch {
    /* noop */
  }
}

async function loadOlder(): Promise<void> {
  if (!messages.value.length || loadingOlder.value) return;
  loadingOlder.value = true;
  const before = messages.value[0].createdAt;
  const el = listRef.value;
  const prevH = el?.scrollHeight ?? 0;
  try {
    const res = await api<ChatListResult>(`${base.value}?before=${encodeURIComponent(before)}`);
    hasMore.value = res.hasMore;
    const seen = new Set(messages.value.map((m) => m.id));
    const older = res.messages.filter((m) => !seen.has(m.id));
    messages.value = [...older, ...messages.value].sort(byCreated);
    await nextTick();
    if (el) el.scrollTop = el.scrollHeight - prevH; // preserva a posição após prepend
  } catch (e) {
    ui.toast('error', errMsg(e, 'Erro ao carregar mensagens.'));
  } finally {
    loadingOlder.value = false;
  }
}

// ─────────────────────────────────────────────────────────── realtime
function appendMessage(msg: ChatMessage): void {
  // dedup por id, e por nonce (caso o eco do SSE chegue depois da própria
  // mensagem otimista já inserida) — confirma trocando o registro temporário.
  const i = messages.value.findIndex(
    (m) => m.id === msg.id || (!!msg.nonce && m.nonce === msg.nonce),
  );
  if (i >= 0) {
    messages.value[i] = msg;
    return;
  }
  messages.value = [...messages.value, msg].sort(byCreated);
  void scrollToEnd();
}
function removeLocal(id: string): void {
  messages.value = messages.value.filter((m) => m.id !== id);
}
function onEvent(data?: unknown): void {
  if (!data) {
    void reconcile(); // sinal sem payload = reconexão/foco
    return;
  }
  const ev = data as ChatEvent;
  if (ev.type === 'msg') appendMessage(ev.message);
  else if (ev.type === 'del') removeLocal(ev.id);
  else if (ev.type === 'presence') presence.value = ev.count;
}
// Assina a room só quando a aba está aberta e o usuário logado (gating zera o custo
// nas outras abas). onEvent recebe o payload da mensagem, ou nada na reconexão.
useRealtime(
  () => (props.active && auth.isAuthenticated ? [room.value] : []),
  onEvent,
);

// ─────────────────────────────────────────────────────────── ações
async function send(): Promise<void> {
  const body = text.value.trim();
  if (!body || sending.value || !auth.user) return;
  const nonce = newNonce();
  const optimistic: ChatMessage = {
    id: `tmp-${nonce}`,
    text: body,
    createdAt: new Date().toISOString(),
    nonce,
    author: { id: auth.user.id, name: auth.user.name, avatarUrl: auth.user.avatarUrl ?? null },
  };
  messages.value = [...messages.value, optimistic];
  text.value = '';
  await scrollToEnd(true);
  sending.value = true;
  try {
    const saved = await api<ChatMessage>(base.value, { method: 'POST', body: { text: body, nonce } });
    track('chat_mensagem', { match_id: props.matchId });
    const i = messages.value.findIndex((m) => m.nonce === nonce);
    if (i >= 0) messages.value[i] = saved; // troca a otimista pela salva (id real)
  } catch (e) {
    messages.value = messages.value.filter((m) => m.nonce !== nonce); // rollback
    text.value = body; // devolve o texto pro usuário
    ui.toast('error', errMsg(e, 'Não foi possível enviar a mensagem.'));
  } finally {
    sending.value = false;
  }
}

function canDelete(m: ChatMessage): boolean {
  if (m.id.startsWith('tmp-')) return false; // mensagem otimista ainda não confirmada
  // O AUTOR apaga a própria; dono/admin do bolão e admin global (canModerate)
  // apagam qualquer uma. O backend reautoriza em ambos os casos.
  return canModerate.value || (!!myId.value && m.author.id === myId.value);
}
async function remove(m: ChatMessage): Promise<void> {
  if (!globalThis.confirm?.('Apagar esta mensagem?')) return;
  const prev = messages.value;
  messages.value = messages.value.filter((x) => x.id !== m.id); // otimista
  try {
    await api(`/chat/${m.id}`, { method: 'DELETE' });
  } catch (e) {
    messages.value = prev; // rollback
    ui.toast('error', errMsg(e, 'Não foi possível apagar.'));
  }
}

// Enter envia; Shift+Enter quebra linha.
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    void send();
  }
}

// Carrega ao abrir a aba pela primeira vez; reativa o scroll ao voltar pra ela.
watch(
  () => props.active,
  (a) => {
    if (!a) return;
    if (auth.isAuthenticated && !loaded.value) void load();
    else if (loaded.value) void scrollToEnd(true);
  },
  { immediate: true },
);
</script>

<template>
  <section class="chat" aria-label="Chat da partida">
    <!-- DESLOGADO: convite a entrar (a sala é dos membros do bolão). -->
    <div v-if="!auth.isAuthenticated" class="cstate">
      <AppIcon name="users" :size="28" class="cstate-ic" />
      <p class="cstate-txt">Entre para conversar com a galera do seu bolão durante o jogo.</p>
      <div class="cstate-cta">
        <NuxtLink :to="authLink('/entrar')" class="btn btn-gold btn-block">Entrar</NuxtLink>
        <NuxtLink :to="authLink('/cadastro')" class="btn btn-block">Criar conta</NuxtLink>
      </div>
    </div>

    <template v-else>
      <div class="cbox">
        <!-- cabeçalho: título + presença ao vivo -->
        <header class="cbar">
          <span class="cbar-title">Bate-papo da partida</span>
          <span v-if="presence > 0" class="cbar-presence">
            <span class="cp-dot" aria-hidden="true" />
            {{ presence }} online
          </span>
        </header>

        <!-- LISTA -->
        <div ref="listRef" class="clist">
          <div v-if="loading && !loaded" class="cloading">
            <span class="spin" aria-hidden="true" /> Carregando o chat…
          </div>

          <button v-if="hasMore" class="cmore" :disabled="loadingOlder" @click="loadOlder">
            {{ loadingOlder ? 'Carregando…' : 'Ver mensagens anteriores' }}
          </button>

          <div v-if="loaded && !messages.length" class="cempty">
            <span class="cempty-emoji" aria-hidden="true">💬</span>
            <p>Ainda não tem ninguém no papo.<br >Seja o primeiro a comentar!</p>
          </div>

          <div
            v-for="(m, i) in messages"
            :key="m.id"
            class="cmsg"
            :class="{ mine: isMine(m), grouped: !showMeta(i), pending: m.id.startsWith('tmp-') }"
          >
            <div class="cmsg-avwrap">
              <UserAvatar
                v-if="!isMine(m) && showMeta(i)"
                :name="m.author.name"
                :src="m.author.avatarUrl"
                :size="30"
              />
            </div>
            <div class="cmsg-content">
              <span
                v-if="!isMine(m) && showMeta(i)"
                class="cmsg-name"
                :style="{ color: nameColor(m.author.id) }"
              >{{ m.author.name }}</span>
              <div class="cmsg-bubble">
                <p class="cmsg-text">{{ m.text }}</p>
                <span class="cmsg-meta">
                  <span class="cmsg-time">{{ timeLabel(m.createdAt) }}</span>
                  <button v-if="canDelete(m)" class="cmsg-del" title="Apagar mensagem" @click="remove(m)">
                    <AppIcon name="trash" :size="11" :stroke="2" />
                  </button>
                </span>
              </div>
            </div>
          </div>
          <div ref="endRef" />
        </div>

        <!-- COMPOSER / sala fechada -->
        <form v-if="open" class="ccompose" @submit.prevent="send">
          <textarea
            v-model="text"
            class="cinput"
            rows="1"
            maxlength="2000"
            placeholder="Escreva uma mensagem…"
            @keydown="onKeydown"
          />
          <button class="csend" :disabled="sending || !text.trim()" aria-label="Enviar">
            <AppIcon name="arrowRight" :size="18" :stroke="2.6" />
          </button>
        </form>
        <div v-else-if="loaded" class="cclosed">
          <AppIcon name="lock" :size="14" :stroke="2" />
          <span>O chat abre no dia do jogo. Volte na hora da partida para comentar.</span>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* estados (deslogado / vazio / fechado) */
.cstate {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 24px 8px;
}
.cstate-ic {
  color: var(--muted);
}
.cstate-txt {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--muted);
  max-width: 34ch;
  margin: 0;
}
.cstate-cta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 300px;
}

/* a CAIXA do chat */
.cbox {
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(15, 22, 32, 0.05);
}

/* cabeçalho com título + presença */
.cbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-base);
}
.cbar-title {
  font-size: var(--fs-xs);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}
.cbar-presence {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--emerald);
}
.cp-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--emerald);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--emerald) 20%, transparent);
  animation: cpulse 2s ease-in-out infinite;
}
@keyframes cpulse {
  50% {
    opacity: 0.45;
  }
}

/* lista de mensagens — rolagem própria */
.clist {
  display: flex;
  flex-direction: column;
  gap: 9px;
  max-height: min(56vh, 460px);
  overflow-y: auto;
  padding: 14px;
  scrollbar-width: thin;
}
.cloading,
.cempty {
  color: var(--muted);
  text-align: center;
  padding: 26px 8px;
}
.cempty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-sm);
  font-weight: 600;
  line-height: 1.5;
}
.cempty p {
  margin: 0;
}
.cempty-emoji {
  font-size: 32px;
  opacity: 0.9;
}
.cloading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: var(--fs-sm);
  font-weight: 600;
}
.spin {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--border);
  border-top-color: var(--gold);
  animation: cspin 0.7s linear infinite;
}
@keyframes cspin {
  to {
    transform: rotate(360deg);
  }
}
.cmore {
  align-self: center;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--muted);
  font: inherit;
  font-weight: 700;
  font-size: var(--fs-xs);
  border-radius: 999px;
  padding: 6px 14px;
  margin-bottom: 2px;
  cursor: pointer;
}
.cmore:hover {
  color: var(--text);
  border-color: color-mix(in srgb, var(--gold) 45%, var(--border));
}

/* mensagem — bolha à esquerda (outros) ou à direita (minhas) */
.cmsg {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}
.cmsg.mine {
  flex-direction: row-reverse;
}
/* consecutivas do mesmo autor ficam mais juntas */
.cmsg.grouped {
  margin-top: -5px;
}
.cmsg.pending {
  opacity: 0.55;
}
/* coluna do avatar — reservada mesmo quando agrupado, p/ alinhar as bolhas */
.cmsg-avwrap {
  width: 30px;
  flex: none;
}
.cmsg.mine .cmsg-avwrap {
  display: none;
}
.cmsg-content {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  max-width: 80%;
}
.cmsg.mine .cmsg-content {
  align-items: flex-end;
}
.cmsg-name {
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  padding-left: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.cmsg-bubble {
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: 14px 14px 14px 5px;
  padding: 7px 11px 5px;
}
.cmsg.mine .cmsg-bubble {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--gold) 22%, var(--bg-surface)),
    color-mix(in srgb, var(--gold) 11%, var(--bg-surface))
  );
  border-color: color-mix(in srgb, var(--gold) 38%, var(--border));
  border-radius: 14px 14px 5px 14px;
}
.cmsg-text {
  margin: 0;
  font-size: var(--fs-sm);
  line-height: 1.4;
  color: var(--text);
  white-space: pre-wrap;
  word-break: break-word;
}
.cmsg-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 1px;
}
.cmsg-time {
  font-size: 10px;
  font-weight: 600;
  color: var(--muted);
}
.cmsg.mine .cmsg-time {
  color: color-mix(in srgb, var(--text) 42%, transparent);
}
.cmsg-del {
  border: none;
  background: none;
  padding: 0;
  color: var(--muted);
  opacity: 0.5;
  cursor: pointer;
  display: inline-flex;
}
.cmsg-del:hover {
  color: var(--scarlet);
  opacity: 1;
}

/* composer — pílula + botão circular */
.ccompose {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--border);
  background: var(--bg-surface);
}
.cinput {
  flex: 1;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--bg-base);
  padding: 9px 14px;
  font: inherit;
  font-size: var(--fs-sm);
  line-height: 1.4;
  color: var(--text);
  resize: none;
  max-height: 120px;
}
.cinput::placeholder {
  color: var(--muted);
}
.cinput:focus {
  outline: none;
  background: var(--bg-surface);
  border-color: color-mix(in srgb, var(--gold) 55%, var(--border));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--gold) 16%, transparent);
}
.csend {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--gold);
  color: #0a0e14;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: filter 0.15s, transform 0.08s;
}
.csend:hover:not(:disabled) {
  filter: brightness(1.06);
}
.csend:active:not(:disabled) {
  transform: scale(0.92);
}
.csend:disabled {
  background: var(--border);
  color: var(--muted);
  cursor: default;
}
.cclosed {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  border-top: 1px solid var(--border);
  background: var(--bg-base);
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--muted);
  text-align: center;
}
</style>
