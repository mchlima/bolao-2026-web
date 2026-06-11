<script setup lang="ts">
import type { RankingResponse } from '~/types/api';

const route = useRoute();
const id = route.params.id as string;

const { data, pending, error } = await useAsyncData(`ranking-${id}`, () =>
  useApi()<RankingResponse>(`/tournaments/${id}/ranking`),
);

const me = computed(() => data.value?.currentUser ?? null);
const inTop = computed(
  () =>
    !!me.value &&
    (data.value?.entries ?? []).some((e) => e.user.id === me.value!.user.id),
);
</script>

<template>
  <section>
    <p><NuxtLink :to="`/tournaments/${id}`" class="muted">← Voltar</NuxtLink></p>
    <h1>Ranking</h1>
    <p v-if="pending" class="muted">Carregando…</p>
    <p v-else-if="error || !data" class="muted">Ranking indisponível.</p>
    <template v-else>
      <p class="muted">{{ data.totalParticipants }} participante(s)</p>
      <table class="rank card">
        <thead>
          <tr>
            <th>#</th>
            <th>Participante</th>
            <th class="num">Cravadas</th>
            <th class="num">Pontos</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="e in data.entries"
            :key="e.user.id"
            :class="{ me: me && e.user.id === me.user.id }"
          >
            <td>{{ e.rank }}</td>
            <td>{{ e.user.name }}</td>
            <td class="num">{{ e.exactCount }}</td>
            <td class="num pts">{{ e.points }}</td>
          </tr>
        </tbody>
      </table>

      <!-- sticky row for the logged user when outside the top 100 -->
      <table v-if="me && !inTop" class="rank card sticky">
        <tbody>
          <tr class="me">
            <td>{{ me.rank }}</td>
            <td>{{ me.user.name }} (você)</td>
            <td class="num">{{ me.exactCount }}</td>
            <td class="num pts">{{ me.points }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </section>
</template>

<style scoped>
.rank {
  width: 100%;
  border-collapse: collapse;
  overflow: hidden;
}
th,
td {
  padding: 0.6rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--border);
}
th {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--muted);
}
.num {
  text-align: right;
}
.pts {
  font-weight: 800;
  color: var(--primary);
}
tr.me {
  background: color-mix(in srgb, var(--primary) 12%, transparent);
}
.sticky {
  position: sticky;
  bottom: 0.5rem;
  margin-top: 0.5rem;
}
tbody tr:last-child td {
  border-bottom: none;
}
</style>
