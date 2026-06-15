<script setup lang="ts">
// Pool shell: a slim header (back + badge + name) with the section tabs as pill
// tags, then <NuxtPage> — mirrors the tournament shell. The pool home/overview
// (member standing, meta, manage/leave actions) is the base route (index.vue);
// each tab is its own nested route, so switching swaps only the content.
const route = useRoute();
const id = route.params.id as string;

const { data: pool, pending, error } = await usePoolDetail(id);

const canManage = computed(
  () => pool.value?.myRole === 'OWNER' || pool.value?.myRole === 'ADMIN',
);

// Active section from the URL. The base path is the overview (no tab lit); a
// match-detail page keeps the Jogos tab lit.
const section = computed<string>(() => {
  const p = route.path;
  if (p.endsWith('/ranking')) return 'ranking';
  if (p.endsWith('/members')) return 'members';
  if (p.endsWith('/invites')) return 'invites';
  if (p.includes(`/pools/${id}/matches`)) return 'matches';
  return 'overview';
});
// Tabs are peers now (Resumo included), so back just leaves the pool.
const backTo = '/pools';

const tabs = computed(() => {
  const t = [
    { key: 'overview', label: 'Resumo', to: `/pools/${id}` },
    { key: 'matches', label: 'Jogos', to: `/pools/${id}/matches` },
    { key: 'ranking', label: 'Ranking', to: `/pools/${id}/ranking` },
    { key: 'members', label: 'Membros', to: `/pools/${id}/members` },
  ];
  if (canManage.value) t.push({ key: 'invites', label: 'Convites', to: `/pools/${id}/invites` });
  return t;
});

function badge(name: string): string {
  const clean = name.trim();
  const w = clean.split(/\s+/).filter((x) => x.length > 2 && !/^\d+$/.test(x));
  if (w.length >= 2) return (w[0][0] + w[1][0]).toUpperCase();
  return (w[0] ?? clean).slice(0, 2).toUpperCase();
}

const unavailable = computed(() => {
  const status = (error.value as { statusCode?: number } | null)?.statusCode;
  if (status === 403) {
    return {
      title: 'Você não faz parte deste bolão',
      msg: 'Talvez você tenha saído ou sido removido. Peça um novo convite para voltar.',
    };
  }
  return {
    title: 'Bolão não encontrado',
    msg: 'Este bolão não existe mais ou o link está incorreto. Ele pode ter sido excluído pelo dono.',
  };
});
</script>

<template>
  <div class="page">
    <SkeletonList v-if="pending && !pool" variant="row" :count="6" />

    <div v-else-if="error || !pool" class="unavail">
      <div class="ic"><AppIcon name="search" :size="28" :stroke="1.8" /></div>
      <h1 class="font-display u-title">{{ unavailable.title }}</h1>
      <p class="muted u-msg">{{ unavailable.msg }}</p>
      <NuxtLink to="/pools" class="btn btn-gold">Ver meus bolões</NuxtLink>
    </div>

    <template v-else>
      <header class="thead">
        <div class="trow">
          <NuxtLink :to="backTo" class="back" aria-label="Voltar">
            <AppIcon name="arrowLeft" :size="18" :stroke="2.4" />
          </NuxtLink>
          <NuxtLink :to="`/pools/${id}`" class="brandmark font-display" aria-label="Visão geral do bolão">
            {{ badge(pool.name) }}
          </NuxtLink>
          <div class="htitle">
            <span class="ht-main font-display">{{ pool.name }}</span>
          </div>
        </div>

        <!-- Section tabs: route-based pill tags; clicking swaps only <NuxtPage>. -->
        <nav class="tabs" aria-label="Seções do bolão">
          <NuxtLink
            v-for="t in tabs"
            :key="t.key"
            :to="t.to"
            class="tab"
            :class="{ on: section === t.key }"
            :aria-current="section === t.key ? 'page' : undefined"
          >
            {{ t.label }}
          </NuxtLink>
        </nav>
      </header>

      <NuxtPage />
    </template>
  </div>
</template>

<style scoped>
.page {
  padding: 6px 0 44px;
}
.unavail {
  max-width: 420px;
  margin: 8vh auto 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.unavail .ic {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  font-size: 28px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
}
.u-title {
  font-weight: 700;
  font-size: clamp(20px, 5vw, 26px);
  text-transform: uppercase;
  line-height: 1.1;
}
.u-msg {
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 6px;
}

/* Slim header (matches the tournament shell). */
.thead {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 6px 0 16px;
}
.trow {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}
.back {
  flex: none;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text);
}
.back:hover {
  border-color: color-mix(in srgb, var(--gold) 45%, var(--border));
}
.brandmark {
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: var(--grad-pitch);
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 700;
  font-size: 14px;
}
.htitle {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.ht-main {
  font-weight: 700;
  font-size: clamp(17px, 4.4vw, 24px);
  text-transform: uppercase;
  line-height: 1.05;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Section tabs — small pill tags. Single row that scrolls sideways (full-bleed
   to the screen edges) when it overflows the container, instead of wrapping. */
.tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  margin-left: -16px;
  margin-right: -16px;
  padding-left: 16px;
  padding-right: 16px;
}
.tabs::-webkit-scrollbar {
  display: none;
}
@media (max-width: 420px) {
  .tabs {
    margin-left: -13px;
    margin-right: -13px;
    padding-left: 13px;
    padding-right: 13px;
  }
}
.tab {
  flex: none;
  padding: 7px 15px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--muted);
  font-weight: 700;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.tab:hover {
  color: var(--text);
  border-color: color-mix(in srgb, var(--gold) 45%, var(--border));
}
.tab.on {
  background: var(--grad-pitch);
  color: #fff;
  border-color: transparent;
}
</style>
