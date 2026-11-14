import {
  User,
  Team,
  TeamMember,
  JoinRequest,
  InviteCode,
  AuditLog,
  Suggestion,
  DemoPersona,
  SimulationResult,
  ScaleStats,
} from './types';

let currentUserId: string = '';

export function setApiUserId(userId: string) {
  currentUserId = userId;
  localStorage.setItem('race_proof_user_id', userId);
}

export function getApiUserId(): string {
  if (!currentUserId) {
    currentUserId = localStorage.getItem('race_proof_user_id') || '';
  }
  return currentUserId;
}

function getHeaders(customHeaders: Record<string, string> = {}, hasBody = false): HeadersInit {
  const headers: Record<string, string> = {
    ...customHeaders,
  };
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }
  const uid = getApiUserId();
  if (uid) {
    headers['x-user-id'] = uid;
  }
  return headers;
}

export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const hasBody = options.body !== undefined && options.body !== null;
  const headers = getHeaders(
    (options.headers as Record<string, string>) || {},
    hasBody
  );
  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.error || `HTTP error ${res.status}`);
    (error as any).statusCode = res.status;
    (error as any).code = data.code;
    (error as any).details = data;
    throw error;
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// API METHODS
// ---------------------------------------------------------------------------

export async function fetchMyTeam(): Promise<{
  inTeam: boolean;
  user: User;
  team: Team | null;
  members: TeamMember[];
  pendingRequests: JoinRequest[];
  activeInvites: InviteCode[];
  sentRequest?: (JoinRequest & { team_name?: string }) | null;
}> {
  return apiRequest('/api/my-team');
}

export async function fetchMe(): Promise<{
  inTeam: boolean;
  user: User;
  team: Team | null;
  members: TeamMember[];
  pendingRequests: JoinRequest[];
  activeInvites: InviteCode[];
  sentRequest?: (JoinRequest & { team_name?: string }) | null;
}> {
  return apiRequest('/api/my-team');
}

export async function fetchDemoUsers(): Promise<DemoPersona[]> {
  return apiRequest('/api/demo-users');
}

export async function fetchBoard(params?: {
  hackathonId?: string;
  limit?: number;
  cursorCreatedAt?: string;
  cursorId?: string;
  skill?: string;
  search?: string;
  includeFull?: boolean;
}): Promise<{ items: Team[]; nextCursor: { cursorCreatedAt: string; cursorId: string } | null }> {
  const query = new URLSearchParams();
  query.set('hackathonId', params?.hackathonId || 'hack_2026');
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.cursorCreatedAt) query.set('cursorCreatedAt', params.cursorCreatedAt);
  if (params?.cursorId) query.set('cursorId', params.cursorId);
  if (params?.skill) query.set('skill', params.skill);
  if (params?.search) query.set('search', params.search);
  if (params?.includeFull) query.set('includeFull', 'true');

  return apiRequest(`/api/board?${query.toString()}`);
}

export async function createTeam(data: {
  hackathonId: string;
  name: string;
  description?: string;
  minSize?: number;
  maxSize?: number;
  requiredSkills?: string[];
}): Promise<Team> {
  return apiRequest('/api/teams', {
    method: 'POST',
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(data),
  });
}

export async function createInvite(teamId: string, ttlMinutes = 60): Promise<InviteCode> {
  return apiRequest(`/api/teams/${teamId}/invites`, {
    method: 'POST',
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({ ttlMinutes }),
  });
}

export async function joinTeamByInvite(inviteCode: string): Promise<Team> {
  return apiRequest('/api/teams/join-by-invite', {
    method: 'POST',
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({ inviteCode }),
  });
}

export async function submitJoinRequest(teamId: string, message?: string): Promise<JoinRequest> {
  return apiRequest(`/api/teams/${teamId}/requests`, {
    method: 'POST',
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({ message }),
  });
}

export async function respondToJoinRequest(
  requestId: string,
  decision: 'ACCEPTED' | 'DECLINED'
): Promise<JoinRequest> {
  return apiRequest(`/api/requests/${requestId}/respond`, {
    method: 'POST',
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({ decision }),
  });
}

export async function leaveTeam(teamId: string): Promise<{ deleted: boolean; newLeaderId: string | null; remainingMembers?: number }> {
  return apiRequest(`/api/teams/${teamId}/leave`, {
    method: 'POST',
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({}),
  });
}

export async function kickTeamMember(teamId: string, targetUserId: string): Promise<Team> {
  return apiRequest(`/api/teams/${teamId}/members/${targetUserId}`, {
    method: 'DELETE',
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
  });
}

export async function fetchSuggestions(limit = 10): Promise<Suggestion[]> {
  return apiRequest(`/api/suggestions?hackathonId=hack_2026&limit=${limit}`);
}

export async function fetchTeamAuditLogs(teamId: string): Promise<AuditLog[]> {
  return apiRequest(`/api/teams/${teamId}/audit-logs`);
}

export async function simulateRace(): Promise<SimulationResult> {
  return apiRequest('/api/demo/simulate-race', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function fetchScaleStats(): Promise<ScaleStats> {
  return apiRequest('/api/scale-stats');
}

export interface BenchmarkResult {
  totalRequests: number;
  succeeded: number;
  failed: number;
  totalDurationMs: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
  targetP95Ms: number;
  status: string;
}

export async function runBenchmarkBoard(): Promise<BenchmarkResult> {
  return apiRequest('/api/demo/benchmark-board', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

