export interface User {
  id: string;
  name: string;
  email: string;
  skills: string[];
  desired_skills: string[];
  timezone_offset: number;
}

export interface Team {
  id: string;
  hackathon_id: string;
  name: string;
  description: string;
  leader_id: string;
  min_size: number;
  max_size: number;
  current_member_count: number;
  required_skills: string[];
  is_looking_for_members: boolean;
  role?: 'LEADER' | 'MEMBER';
  joined_at?: string;
  created_at?: string;
}

export interface TeamMember {
  id: string;
  user_id?: string;
  name: string;
  email: string;
  role: 'LEADER' | 'MEMBER';
  skills: string[];
  timezone_offset: number;
  joined_at: string;
}

export interface JoinRequest {
  id: string;
  team_id: string;
  user_id: string;
  name?: string;
  email?: string;
  skills?: string[];
  timezone_offset?: number;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  message: string;
  created_at: string;
  team_name?: string;
}

export interface InviteCode {
  code: string;
  team_id: string;
  created_by: string;
  expires_at: string;
  revoked: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  team_id: string;
  actor_id: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Suggestion {
  user: {
    id: string;
    name: string;
    skills: string[];
    timezoneOffset: number;
  };
  totalScore: number;
  explanation: {
    formula: string;
    matchedSkills: string[];
    desiredSkillsCount: number;
    skillScore: number;
    timezoneDiffHours: number;
    timezoneScore: number;
    summary: string;
  };
}

export interface DemoPersona {
  id: string;
  name: string;
  email: string;
  role: 'LEADER' | 'MEMBER' | 'SOLO';
  team_id?: string | null;
  team_name?: string | null;
  label: string;
  category: string;
}

export interface SimulationResult {
  team: { id: string; name: string; maxSize: number };
  inviteCode: string;
  totalAttempts: number;
  succeededCount: number;
  failed409Count: number;
  durationMs: number;
  membersInDb: Array<{ user_id: string; name: string; role: string; joined_at: string }>;
  winner: { user_id: string; name: string; role: string } | null;
}

export interface ScaleStats {
  scale: {
    totalUsers: number;
    totalTeams: number;
    openTeams: number;
    isSeededScale: boolean;
  };
  benchmark: {
    targetObjective: string;
    targetP95Ms: number;
    verifiedP95Ms: number;
    concurrentConnections: number;
    durationSeconds: number;
    totalRequests: number;
    requestsPerSec: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    socketTimeouts: number;
    httpErrors: number;
    status: string;
  };
  architecturalPillars: Array<{
    name: string;
    detail: string;
  }>;
  cliCommands: {
    test: string;
    seed: string;
    loadtest: string;
  };
}

