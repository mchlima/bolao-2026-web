import type {
  PoolDetail,
  PoolInviteView,
  PoolJoinPreview,
  PoolMemberRole,
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
      tournamentId: string;
      visibility?: PoolVisibility;
    }) => api<PoolDetail>('/pools', { method: 'POST', body }),
    update: (id: string, body: { name?: string; visibility?: PoolVisibility }) =>
      api<PoolDetail>(`/pools/${id}`, { method: 'PATCH', body }),
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

    ranking: (id: string) => api<RankingResponse>(`/pools/${id}/ranking`),
  };
}
