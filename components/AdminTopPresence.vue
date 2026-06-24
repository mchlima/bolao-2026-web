<script setup lang="ts">
// Presença ao vivo no centro do topbar do admin: só ícone + número (pessoas
// online e dispositivos conectados); o detalhe aparece num popover no hover.
// Faz o polling do /admin/dashboard/online (presença não é evento emitido).
interface Online {
  total: number;
  devices: number;
  others: number;
  liveMatches: number;
  users: { id: string; name: string; avatarUrl: string | null; devices: number; since: string }[];
}

const online = ref<Online | null>(null);
let timer: ReturnType<typeof setInterval> | undefined;
async function load(): Promise<void> {
  try {
    online.value = await useApi()<Online>('/admin/dashboard/online');
  } catch {
    /* transitório: mantém o último snapshot */
  }
}
onMounted(() => {
  load();
  timer = setInterval(load, 10000);
});
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});

const people = computed(() => online.value?.total ?? 0);
const devices = computed(() => online.value?.devices ?? 0);
const named = computed(() => online.value?.users ?? []);
const others = computed(() => online.value?.others ?? 0);
const live = computed(() => online.value?.liveMatches ?? 0);
</script>

<template>
  <div class="presence">
    <!-- pessoas online -->
    <button class="pill" type="button" aria-label="Pessoas online">
      <span class="live-dot" />
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      <b class="font-numeric">{{ people }}</b>
      <span class="pop" role="tooltip">
        <span class="pop-h">{{ people }} {{ people === 1 ? 'pessoa online' : 'pessoas online' }}</span>
        <span v-if="named.length" class="pop-list">
          <span v-for="u in named" :key="u.id" class="pop-u">
            <UserAvatar :name="u.name" :src="u.avatarUrl" :size="20" />
            <span class="pop-nm">{{ u.name }}</span>
            <b v-if="u.devices > 1" class="pop-d">{{ u.devices }}</b>
          </span>
        </span>
        <span v-if="others" class="pop-others">+{{ others }} não identificados</span>
        <span v-else-if="!named.length" class="pop-empty">Ninguém identificado no momento.</span>
      </span>
    </button>

    <!-- dispositivos conectados -->
    <button class="pill" type="button" aria-label="Dispositivos conectados">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
      </svg>
      <b class="font-numeric">{{ devices }}</b>
      <span class="pop" role="tooltip">
        <span class="pop-h">{{ devices }} {{ devices === 1 ? 'dispositivo conectado' : 'dispositivos conectados' }}</span>
        <span class="pop-empty">Sessões ativas no painel e no site agora.</span>
      </span>
    </button>

    <!-- jogos ao vivo (link p/ o Controle ao vivo) -->
    <NuxtLink to="/admin/live" class="pill live" :class="{ on: live > 0 }" aria-label="Jogos ao vivo">
      <span v-if="live > 0" class="live-dot scarlet" />
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="2" />
        <path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14" />
      </svg>
      <b class="font-numeric">{{ live }}</b>
      <span class="pop" role="tooltip">
        <span class="pop-h">{{ live === 1 ? '1 jogo ao vivo' : `${live} jogos ao vivo` }}</span>
        <span class="pop-empty">{{ live > 0 ? 'Clique para abrir o Controle ao vivo.' : 'Nenhuma partida em andamento agora.' }}</span>
      </span>
    </NuxtLink>
  </div>
</template>

<style scoped>
.presence { display: inline-flex; align-items: center; gap: 8px; }
.pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 11px 0 9px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-surface);
  color: var(--muted);
  cursor: default;
  transition: border-color 0.14s, color 0.14s, box-shadow 0.14s;
}
.pill:hover { border-color: color-mix(in srgb, var(--emerald) 45%, var(--border)); color: var(--text); }
.pill b { color: var(--text); font-size: var(--fs-base); line-height: 1; }
.pill svg { flex: none; }
.live-dot {
  width: 7px; height: 7px; border-radius: 50%; background: var(--emerald); flex: none;
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--emerald) 60%, transparent);
  animation: pres-pulse 2s infinite;
}
@keyframes pres-pulse {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--emerald) 55%, transparent); }
  70% { box-shadow: 0 0 0 6px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}
.live-dot.scarlet {
  background: var(--scarlet);
  animation: pres-pulse-red 2s infinite;
}
@keyframes pres-pulse-red {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--scarlet) 55%, transparent); }
  70% { box-shadow: 0 0 0 6px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}

/* pill de jogos ao vivo: é link (Controle ao vivo) e acende em vermelho quando há jogos */
.pill.live { cursor: pointer; text-decoration: none; }
.pill.live:hover { border-color: color-mix(in srgb, var(--scarlet) 45%, var(--border)); }
.pill.live.on { border-color: color-mix(in srgb, var(--scarlet) 40%, var(--border)); }
.pill.live.on svg, .pill.live.on b { color: var(--scarlet); }

/* popover (descrição no hover) */
.pop {
  position: absolute;
  top: calc(100% + 9px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  min-width: 180px;
  max-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 11px 13px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 16px 40px -12px rgba(15, 22, 32, 0.3);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.14s, transform 0.14s, visibility 0.14s;
  z-index: 60;
  text-align: left;
}
.pill:hover .pop { opacity: 1; visibility: visible; transform: translateX(-50%) translateY(0); }
.pop::before {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-bottom-color: var(--bg-surface);
  filter: drop-shadow(0 -1px 0 var(--border));
}
.pop-h { font-size: var(--fs-sm); font-weight: 800; color: var(--text); white-space: nowrap; }
.pop-list { display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto; }
.pop-u { display: inline-flex; align-items: center; gap: 8px; }
.pop-nm { font-size: var(--fs-sm); font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pop-d {
  margin-left: auto; font-size: var(--fs-2xs); font-weight: 700; color: var(--muted);
  background: var(--bg-base); border: 1px solid var(--border); border-radius: 999px; padding: 0 6px;
}
.pop-others, .pop-empty { font-size: var(--fs-xs); font-weight: 600; color: var(--muted); }
</style>
