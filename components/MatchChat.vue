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
      <!-- presença ao vivo na sala -->
      <div v-if="presence > 0" class="cpresence">
        <span class="cp-dot" aria-hidden="true" />
        {{ presence }} {{ presence === 1 ? 'pessoa' : 'pessoas' }} na sala
      </div>

      <!-- LISTA -->
      <div ref="listRef" class="clist">
        <div v-if="loading && !loaded" class="cloading">
          <span class="spin" aria-hidden="true" /> Carregando o chat…
        </div>

        <button v-if="hasMore" class="cmore" :disabled="loadingOlder" @click="loadOlder">
          {{ loadingOlder ? 'Carregando…' : 'Ver mensagens anteriores' }}
        </button>

        <p v-if="loaded && !messages.length" class="cempty">
          Ainda não tem ninguém no papo. Seja o primeiro a comentar 👋
        </p>

        <div
          v-for="m in messages"
          :key="m.id"
          class="cmsg"
          :class="{ mine: m.author.id === myId, pending: m.id.startsWith('tmp-') }"
        >
          <UserAvatar :name="m.author.name" :src="m.author.avatarUrl" :size="32" class="cmsg-av" />
          <div class="cmsg-body">
            <div class="cmsg-head">
              <span class="cmsg-name">{{ m.author.name }}</span>
              <span class="cmsg-time">{{ timeLabel(m.createdAt) }}</span>
              <button v-if="canDelete(m)" class="cmsg-del" title="Apagar" @click="remove(m)">
                <AppIcon name="trash" :size="13" :stroke="2" />
              </button>
            </div>
            <p class="cmsg-text">{{ m.text }}</p>
          </div>
        </div>
        <div ref="endRef" />
      </div>

      <!-- COMPOSER / sala fechada -->
      <form v-if="open" class="ccompose" @submit.prevent="send">
        <textarea
          v-model="text"
          class="input cinput"
          rows="1"
          maxlength="2000"
          placeholder="Escreva uma mensagem…"
          @keydown="onKeydown"
        />
        <button class="btn btn-gold csend" :disabled="sending || !text.trim()" aria-label="Enviar">
          <AppIcon name="arrowRight" :size="18" :stroke="2.4" />
        </button>
      </form>
      <p v-else-if="loaded" class="cclosed">
        <AppIcon name="lock" :size="13" :stroke="2" />
        O chat abre no dia do jogo. Volte na hora da partida para comentar.
      </p>
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

/* presença ao vivo ("X na sala") */
.cpresence {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--muted);
  padding: 2px 2px 0;
}
.cp-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--emerald);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--emerald) 22%, transparent);
}

/* lista de mensagens — bloco com rolagem própria */
.clist {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: min(58vh, 520px);
  overflow-y: auto;
  padding: 4px 2px 2px;
  scrollbar-width: thin;
}
.cloading,
.cempty {
  text-align: center;
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--muted);
  padding: 18px 8px;
}
.cloading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
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
  cursor: pointer;
}
.cmore:hover {
  color: var(--text);
  border-color: color-mix(in srgb, var(--gold) 45%, var(--border));
}

/* mensagem */
.cmsg {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 9px;
  align-items: start;
}
.cmsg-av {
  margin-top: 2px;
}
.cmsg-body {
  min-width: 0;
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: 4px 13px 13px 13px;
  padding: 8px 12px;
}
.cmsg.mine .cmsg-body {
  background: linear-gradient(135deg, color-mix(in srgb, var(--gold) 12%, var(--bg-surface)), var(--bg-surface));
  border-color: color-mix(in srgb, var(--gold) 30%, var(--border));
}
.cmsg.pending {
  opacity: 0.6;
}
.cmsg-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}
.cmsg-name {
  font-size: var(--fs-xs);
  font-weight: 800;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cmsg-time {
  font-size: var(--fs-2xs, 0.6875rem);
  font-weight: 600;
  color: var(--muted);
  flex: none;
}
.cmsg-del {
  margin-left: auto;
  border: none;
  background: none;
  padding: 0;
  color: var(--muted);
  cursor: pointer;
  display: inline-flex;
  flex: none;
}
.cmsg-del:hover {
  color: var(--scarlet);
}
.cmsg-text {
  margin: 0;
  font-size: var(--fs-sm);
  line-height: 1.45;
  color: var(--text);
  white-space: pre-wrap;
  word-break: break-word;
}

/* composer */
.ccompose {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  border-top: 1px solid var(--border);
  padding-top: 10px;
}
.cinput {
  flex: 1;
  resize: none;
  max-height: 120px;
  line-height: 1.4;
}
.csend {
  flex: none;
  width: 44px;
  height: 44px;
  padding: 0;
  display: grid;
  place-items: center;
}
.cclosed {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border-top: 1px solid var(--border);
  padding: 14px 8px 4px;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--muted);
  text-align: center;
}
</style>
