import type {
  PoolDetail,
  PoolInviteView,
  PoolJoinPreview,
  PoolMatchPredictionsView,
  PoolMemberRole,
  PoolRunWithChampion,
  PoolSummary,
  PoolVisibility,
  RankingResponse,
} from '~/types/api';

/** Thin wrapper over the /pools API (see bolao-2026-docs/architecture/multi-bolao.md). */
export function usePools() {
  const api = useApi();
  return {
    listMine: () => api<PoolSummary[]>('/pools/me'),
    detail: (id: string) => api<PoolDetail>(`/pools/${id}`),
    create: (body: {
      name: string;
      description?: string;
      inviteDescription?: string;
      visibility?: PoolVisibility;
    }) => api<PoolDetail>('/pools', { method: 'POST', body }),
    update: (
      id: string,
      body: {
        name?: string;
        description?: string;
        inviteDescription?: string;
        visibility?: PoolVisibility;
      },
    ) => api<PoolDetail>(`/pools/${id}`, { method: 'PATCH', body }),
    remove: (id: string) => api(`/pools/${id}`, { method: 'DELETE' }),
    leave: (id: string) => api(`/pools/${id}/leave`, { method: 'POST' }),
    transfer: (id: string, userId: string) =>
      api<PoolDetail>(`/pools/${id}/transfer`, { method: 'POST', body: { userId } }),

    createInvite: (id: string, name: string) =>
      api<PoolInviteView>(`/pools/${id}/invites`, {
        method: 'POST',
        body: { name },
      }),
    updateInvite: (
      id: string,
      inviteId: string,
      body: { name?: string; isActive?: boolean },
    ) =>
      api<PoolInviteView>(`/pools/${id}/invites/${inviteId}`, {
        method: 'PATCH',
        body,
      }),
    deleteInvite: (id: string, inviteId: string) =>
      api(`/pools/${id}/invites/${inviteId}`, { method: 'DELETE' }),

    joinPreview: (code: string) =>
      api<PoolJoinPreview>(`/pools/join/${code}`),
    join: (code: string) =>
      api<PoolDetail>(`/pools/join/${code}`, { method: 'POST' }),

    setMemberRole: (id: string, userId: string, role: PoolMemberRole) =>
      api<PoolDetail>(`/pools/${id}/members/${userId}`, {
        method: 'PATCH',
        body: { role },
      }),
    removeMember: (id: string, userId: string) =>
      api(`/pools/${id}/members/${userId}`, { method: 'DELETE' }),

    // ── Temporadas (runs) ──
    listRuns: (id: string) =>
      api<PoolRunWithChampion[]>(`/pools/${id}/runs`),
    createRun: (
      id: string,
      body: { seasonId: string; label?: string; start?: boolean },
    ) => api<PoolDetail>(`/pools/${id}/runs`, { method: 'POST', body }),
    startRun: (id: string, runId: string) =>
      api<PoolDetail>(`/pools/${id}/runs/${runId}/start`, { method: 'POST' }),
    endRun: (id: string, runId: string) =>
      api<PoolDetail>(`/pools/${id}/runs/${runId}/end`, { method: 'POST' }),

    ranking: (id: string, runId?: string) =>
      api<RankingResponse>(
        `/pools/${id}/ranking${runId ? `?runId=${runId}` : ''}`,
      ),
    matchRanking: (id: string, matchId: string) =>
      api<RankingResponse>(`/pools/${id}/matches/${matchId}/ranking`),
    matchPredictions: (id: string, matchId: string) =>
      api<PoolMatchPredictionsView>(
        `/pools/${id}/matches/${matchId}/predictions`,
      ),
  };
}
