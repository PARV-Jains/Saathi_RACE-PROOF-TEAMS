import 'dotenv/config';
import { Pool, PoolClient } from 'pg';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
  max: 20,
});

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

export interface TeamRecord {
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
  created_at: string;
  updated_at?: string;
}

export interface InviteCodeRecord {
  id: string;
  code: string;
  team_id: string;
  created_by: string;
  expires_at: string;
  revoked: boolean;
  created_at: string;
}

export interface JoinRequestRecord {
  id: string;
  team_id: string;
  hackathon_id: string;
  user_id: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  message: string;
  created_at: string;
  updated_at: string;
}

export async function initSchema() {
  const sqlPath = path.join(process.cwd(), 'src/db/schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  await pool.query(sql);
}


async function withTransactionAndIdempotency<T>(
  userId: string,
  action: string,
  idempotencyKey: string | undefined,
  fn: (client: PoolClient) => Promise<{ statusCode: number; body: T }>
): Promise<{ statusCode: number; body: T; replayed: boolean }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (idempotencyKey) {

      await client.query(
        `SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2))`,
        [userId, idempotencyKey]
      );

      const existing = await client.query(
        `SELECT status_code, response_body FROM idempotency_keys WHERE key = $1 AND user_id = $2`,
        [idempotencyKey, userId]
      );

      if (existing.rowCount && existing.rowCount > 0) {
        await client.query('COMMIT');
        return {
          statusCode: existing.rows[0].status_code,
          body: existing.rows[0].response_body as T,
          replayed: true,
        };
      }
    }

    const result = await fn(client);

    if (idempotencyKey) {
      await client.query(
        `INSERT INTO idempotency_keys (key, user_id, action, status_code, response_body)
         VALUES ($1, $2, $3, $4, $5)`,
        [idempotencyKey, userId, action, result.statusCode, JSON.stringify(result.body)]
      );
    }

    await client.query('COMMIT');
    return { ...result, replayed: false };
  } catch (err: unknown) {
    await client.query('ROLLBACK');


    const pgErr = err as { code?: string; constraint?: string };
    if (pgErr.code === '23505') {
      if (pgErr.constraint === 'one_team_per_user_per_hackathon') {
        throw new AppError(409, 'ALREADY_IN_TEAM', 'User is already in a team for this hackathon');
      }
      throw new AppError(409, 'CONFLICT', 'Resource conflict or duplicate name');
    }
    throw err;
  } finally {
    client.release();
  }
}

async function writeAuditLog(
  client: PoolClient,
  teamId: string,
  hackathonId: string,
  actorId: string,
  action: string,
  metadata: Record<string, unknown> = {}
) {
  await client.query(
    `INSERT INTO audit_logs (team_id, hackathon_id, actor_id, action, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [teamId, hackathonId, actorId, action, JSON.stringify(metadata)]
  );
}


export async function createTeam(params: {
  userId: string;
  hackathonId: string;
  name: string;
  description?: string;
  minSize?: number;
  maxSize?: number;
  requiredSkills?: string[];
  idempotencyKey?: string;
}) {
  return withTransactionAndIdempotency(
    params.userId,
    'CREATE_TEAM',
    params.idempotencyKey,
    async (client) => {
      const minSize = params.minSize ?? 2;
      const maxSize = params.maxSize ?? 4;

      if (minSize < 1 || maxSize < minSize) {
        throw new AppError(400, 'INVALID_SIZE', 'Invalid team min/max size bounds');
      }

      const teamRes = await client.query(
        `INSERT INTO teams (hackathon_id, name, description, leader_id, min_size, max_size, current_member_count, required_skills, is_looking_for_members)
         VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8)
         RETURNING *`,
        [
          params.hackathonId,
          params.name,
          params.description ?? '',
          params.userId,
          minSize,
          maxSize,
          params.requiredSkills ?? [],
          1 < maxSize,
        ]
      );
      const team = teamRes.rows[0];

      await client.query(
        `INSERT INTO team_members (team_id, hackathon_id, user_id, role)
         VALUES ($1, $2, $3, 'LEADER')`,
        [team.id, params.hackathonId, params.userId]
      );

      await writeAuditLog(client, team.id, params.hackathonId, params.userId, 'TEAM_CREATED', {
        name: team.name,
        maxSize: team.max_size,
      });

      return { statusCode: 201, body: team };
    }
  );
}


export async function createInviteCode(params: {
  leaderId: string;
  teamId: string;
  ttlMinutes?: number;
  idempotencyKey?: string;
}) {
  return withTransactionAndIdempotency(
    params.leaderId,
    'CREATE_INVITE',
    params.idempotencyKey,
    async (client) => {
      const teamRes = await client.query(`SELECT * FROM teams WHERE id = $1 FOR UPDATE`, [
        params.teamId,
      ]);
      if (teamRes.rowCount === 0) throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found');
      const team = teamRes.rows[0];

      if (team.leader_id !== params.leaderId) {
        throw new AppError(403, 'FORBIDDEN', 'Only the team leader can generate invite codes');
      }


      const code = crypto.randomBytes(12).toString('base64url');
      const ttl = params.ttlMinutes ?? 60;

      const inviteRes = await client.query(
        `INSERT INTO invite_codes (code, team_id, created_by, expires_at)
         VALUES ($1, $2, $3, NOW() + ($4 || ' minutes')::interval)
         RETURNING *`,
        [code, team.id, params.leaderId, ttl.toString()]
      );

      await writeAuditLog(client, team.id, team.hackathon_id, params.leaderId, 'INVITE_CREATED', {
        code,
        expiresAt: inviteRes.rows[0].expires_at,
      });

      return { statusCode: 201, body: inviteRes.rows[0] };
    }
  );
}


export async function joinTeamWithInvite(params: {
  userId: string;
  inviteCode: string;
  idempotencyKey?: string;
  delayMs?: number;
}) {
  return withTransactionAndIdempotency(
    params.userId,
    'JOIN_BY_INVITE',
    params.idempotencyKey,
    async (client) => {
      const inviteRes = await client.query(
        `SELECT * FROM invite_codes WHERE code = $1`,
        [params.inviteCode]
      );
      if (inviteRes.rowCount === 0) {
        throw new AppError(404, 'INVALID_INVITE', 'Invite code does not exist');
      }
      const invite = inviteRes.rows[0];

      if (invite.revoked || new Date(invite.expires_at) <= new Date()) {
        throw new AppError(410, 'INVITE_EXPIRED', 'Invite code has expired or been revoked');
      }


      const teamRes = await client.query(
        `SELECT * FROM teams WHERE id = $1 FOR UPDATE`,
        [invite.team_id]
      );
      if (teamRes.rowCount === 0) {
        throw new AppError(404, 'TEAM_NOT_FOUND', 'Team no longer exists');
      }
      const team = teamRes.rows[0];

      if (team.current_member_count >= team.max_size) {
        throw new AppError(409, 'TEAM_FULL', 'Team has already reached maximum capacity');
      }


      await client.query(
        `INSERT INTO team_members (team_id, hackathon_id, user_id, role)
         VALUES ($1, $2, $3, 'MEMBER')`,
        [team.id, team.hackathon_id, params.userId]
      );

      const newCount = team.current_member_count + 1;
      const updatedTeamRes = await client.query(
        `UPDATE teams
         SET current_member_count = $1,
             is_looking_for_members = CASE WHEN $1 >= max_size THEN FALSE ELSE is_looking_for_members END
         WHERE id = $2
         RETURNING *`,
        [newCount, team.id]
      );

      await writeAuditLog(client, team.id, team.hackathon_id, params.userId, 'MEMBER_JOINED_VIA_INVITE', {
        inviteCode: params.inviteCode,
        memberCountAfter: newCount,
      });

      if (params.delayMs || process.env.CHAOS_DELAY_MS) {
        const ms = params.delayMs ?? Number(process.env.CHAOS_DELAY_MS);
        if (ms > 0) {
          await new Promise((resolve) => setTimeout(resolve, ms));
        }
      }

      return { statusCode: 200, body: updatedTeamRes.rows[0] };
    }
  );
}


export async function submitJoinRequest(params: {
  userId: string;
  teamId: string;
  message?: string;
  idempotencyKey?: string;
}) {
  return withTransactionAndIdempotency(
    params.userId,
    'SUBMIT_JOIN_REQUEST',
    params.idempotencyKey,
    async (client) => {
      const teamRes = await client.query(`SELECT * FROM teams WHERE id = $1`, [params.teamId]);
      if (teamRes.rowCount === 0) throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found');
      const team = teamRes.rows[0];

      if (team.current_member_count >= team.max_size) {
        throw new AppError(409, 'TEAM_FULL', 'Team is already full');
      }

      const reqRes = await client.query(
        `INSERT INTO join_requests (team_id, hackathon_id, user_id, status, message)
         VALUES ($1, $2, $3, 'PENDING', $4)
         RETURNING *`,
        [team.id, team.hackathon_id, params.userId, params.message ?? '']
      );

      await writeAuditLog(client, team.id, team.hackathon_id, params.userId, 'JOIN_REQUEST_SUBMITTED', {
        requestId: reqRes.rows[0].id,
      });

      return { statusCode: 201, body: reqRes.rows[0] };
    }
  );
}

export async function respondToJoinRequest(params: {
  leaderId: string;
  requestId: string;
  decision: 'ACCEPTED' | 'DECLINED';
  idempotencyKey?: string;
}) {
  return withTransactionAndIdempotency(
    params.leaderId,
    'RESPOND_JOIN_REQUEST',
    params.idempotencyKey,
    async (client) => {
      const reqRes = await client.query(
        `SELECT * FROM join_requests WHERE id = $1 FOR UPDATE`,
        [params.requestId]
      );
      if (reqRes.rowCount === 0) throw new AppError(404, 'REQUEST_NOT_FOUND', 'Join request not found');
      const joinReq = reqRes.rows[0];

      if (joinReq.status !== 'PENDING') {
        throw new AppError(409, 'ALREADY_PROCESSED', 'Join request was already processed');
      }


      const teamRes = await client.query(`SELECT * FROM teams WHERE id = $1 FOR UPDATE`, [
        joinReq.team_id,
      ]);
      const team = teamRes.rows[0];

      if (team.leader_id !== params.leaderId) {
        throw new AppError(403, 'FORBIDDEN', 'Only the team leader can accept or decline requests');
      }

      if (params.decision === 'DECLINED') {
        const updatedReq = await client.query(
          `UPDATE join_requests SET status = 'DECLINED', updated_at = NOW() WHERE id = $1 RETURNING *`,
          [joinReq.id]
        );
        await writeAuditLog(client, team.id, team.hackathon_id, params.leaderId, 'JOIN_REQUEST_DECLINED', {
          targetUserId: joinReq.user_id,
        });
        return { statusCode: 200, body: updatedReq.rows[0] };
      }


      if (team.current_member_count >= team.max_size) {
        throw new AppError(409, 'TEAM_FULL', 'Team is already full');
      }

      await client.query(
        `INSERT INTO team_members (team_id, hackathon_id, user_id, role)
         VALUES ($1, $2, $3, 'MEMBER')`,
        [team.id, team.hackathon_id, joinReq.user_id]
      );

      const newCount = team.current_member_count + 1;
      await client.query(
        `UPDATE teams
         SET current_member_count = $1,
             is_looking_for_members = CASE WHEN $1 >= max_size THEN FALSE ELSE is_looking_for_members END
         WHERE id = $2`,
        [newCount, team.id]
      );

      const updatedReq = await client.query(
        `UPDATE join_requests SET status = 'ACCEPTED', updated_at = NOW() WHERE id = $1 RETURNING *`,
        [joinReq.id]
      );

      await writeAuditLog(client, team.id, team.hackathon_id, params.leaderId, 'JOIN_REQUEST_ACCEPTED', {
        targetUserId: joinReq.user_id,
        memberCountAfter: newCount,
      });

      return { statusCode: 200, body: updatedReq.rows[0] };
    }
  );
}


export interface LeaveTeamResult {
  deleted: boolean;
  newLeaderId: string | null;
  remainingMembers?: number;
}

export async function leaveTeam(params: {
  userId: string;
  teamId: string;
  idempotencyKey?: string;
}) {
  return withTransactionAndIdempotency<LeaveTeamResult>(
    params.userId,
    'LEAVE_TEAM',
    params.idempotencyKey,
    async (client) => {
      const teamRes = await client.query(`SELECT * FROM teams WHERE id = $1 FOR UPDATE`, [
        params.teamId,
      ]);
      if (teamRes.rowCount === 0) throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found');
      const team = teamRes.rows[0];

      const delRes = await client.query(
        `DELETE FROM team_members WHERE team_id = $1 AND user_id = $2 RETURNING *`,
        [team.id, params.userId]
      );
      if (delRes.rowCount === 0) {
        throw new AppError(404, 'NOT_A_MEMBER', 'User is not a member of this team');
      }

      const remainingRes = await client.query(
        `SELECT user_id FROM team_members WHERE team_id = $1 ORDER BY joined_at ASC`,
        [team.id]
      );


      if (remainingRes.rowCount === 0) {
        await writeAuditLog(client, team.id, team.hackathon_id, params.userId, 'LAST_MEMBER_LEFT_TEAM_DELETED');
        await client.query(`DELETE FROM teams WHERE id = $1`, [team.id]);
        return {
          statusCode: 200,
          body: { deleted: true, newLeaderId: null },
        };
      }

      let newLeaderId = team.leader_id;


      if (team.leader_id === params.userId) {
        newLeaderId = remainingRes.rows[0].user_id;
        await client.query(
          `UPDATE team_members SET role = 'LEADER' WHERE team_id = $1 AND user_id = $2`,
          [team.id, newLeaderId]
        );
        await writeAuditLog(client, team.id, team.hackathon_id, params.userId, 'LEADERSHIP_TRANSFERRED', {
          previousLeaderId: params.userId,
          newLeaderId,
        });
      }

      const newCount = remainingRes.rowCount!;
      await client.query(
        `UPDATE teams
         SET current_member_count = $1,
             leader_id = $2
         WHERE id = $3`,
        [newCount, newLeaderId, team.id]
      );

      await writeAuditLog(client, team.id, team.hackathon_id, params.userId, 'MEMBER_LEFT', {
        memberCountAfter: newCount,
      });

      return {
        statusCode: 200,
        body: { deleted: false, newLeaderId, remainingMembers: newCount },
      };
    }
  );
}


export async function removeTeamMember(params: {
  leaderId: string;
  teamId: string;
  targetUserId: string;
  idempotencyKey?: string;
}) {
  return withTransactionAndIdempotency(
    params.leaderId,
    'REMOVE_MEMBER',
    params.idempotencyKey,
    async (client) => {
      if (params.leaderId === params.targetUserId) {
        throw new AppError(400, 'CANNOT_KICK_SELF', 'Use leaveTeam instead of kicking yourself');
      }

      const teamRes = await client.query(`SELECT * FROM teams WHERE id = $1 FOR UPDATE`, [
        params.teamId,
      ]);
      if (teamRes.rowCount === 0) throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found');
      const team = teamRes.rows[0];

      if (team.leader_id !== params.leaderId) {
        throw new AppError(403, 'FORBIDDEN', 'Only the team leader can remove members');
      }

      const delRes = await client.query(
        `DELETE FROM team_members WHERE team_id = $1 AND user_id = $2 RETURNING *`,
        [team.id, params.targetUserId]
      );
      if (delRes.rowCount === 0) {
        throw new AppError(404, 'NOT_A_MEMBER', 'Target user is not in this team');
      }

      const newCount = team.current_member_count - 1;
      const updatedTeam = await client.query(
        `UPDATE teams
         SET current_member_count = $1,
             is_looking_for_members = TRUE
         WHERE id = $2
         RETURNING *`,
        [newCount, team.id]
      );

      await writeAuditLog(client, team.id, team.hackathon_id, params.leaderId, 'MEMBER_REMOVED', {
        removedUserId: params.targetUserId,
        memberCountAfter: newCount,
      });

      return { statusCode: 200, body: updatedTeam.rows[0] };
    }
  );
}


export async function getOpenTeamsBoard(params: {
  hackathonId: string;
  limit?: number;
  cursorCreatedAt?: string;
  cursorId?: string;
  skillFilter?: string;
  search?: string;
  includeFull?: boolean;
}) {
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);

  const values: unknown[] = [params.hackathonId];
  let whereClause = `
    WHERE hackathon_id = $1
  `;

  if (!params.includeFull) {
    whereClause += `
      AND is_looking_for_members = TRUE
      AND current_member_count < max_size
    `;
  }

  if (params.skillFilter) {
    values.push(params.skillFilter);
    whereClause += ` AND $${values.length} = ANY(required_skills)`;
  }

  if (params.search && params.search.trim()) {
    values.push(`%${params.search.trim()}%`);
    whereClause += ` AND (name ILIKE $${values.length} OR description ILIKE $${values.length})`;
  }

  if (params.cursorCreatedAt && params.cursorId) {
    values.push(params.cursorCreatedAt, params.cursorId);
    whereClause += ` AND (created_at, id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`;
  }

  values.push(limit);

  const res = await pool.query(
    `SELECT id, hackathon_id, name, description, leader_id, min_size, max_size,
            current_member_count, required_skills, is_looking_for_members, created_at
     FROM teams
     ${whereClause}
     ORDER BY created_at DESC, id DESC
     LIMIT $${values.length}`,
    values
  );

  const items = res.rows;
  const last = items[items.length - 1];

  return {
    items,
    nextCursor: last ? { cursorCreatedAt: last.created_at, cursorId: last.id } : null,
  };
}


export async function getTeammateSuggestions(params: {
  userId: string;
  hackathonId: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(params.limit ?? 10, 1), 30);

  const userRes = await pool.query(`SELECT * FROM users WHERE id = $1`, [params.userId]);
  if (userRes.rowCount === 0) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  const requester = userRes.rows[0];

  const desiredSkills: string[] =
    requester.desired_skills?.length > 0 ? requester.desired_skills : ['React', 'Node.js', 'Python'];
  const requesterTz = Number(requester.timezone_offset);

  const candidatesRes = await pool.query(
    `SELECT u.id, u.name, u.email, u.skills, u.desired_skills, u.timezone_offset
     FROM users u
     WHERE u.id != $1
       AND NOT EXISTS (
         SELECT 1 FROM team_members tm
         WHERE tm.hackathon_id = $2 AND tm.user_id = u.id
       )
     LIMIT 300`,
    [params.userId, params.hackathonId]
  );

  const scored = candidatesRes.rows.map((candidate) => {
    const candidateSkills: string[] = candidate.skills || [];
    const matchedSkills = desiredSkills.filter((s) => candidateSkills.includes(s));

    const skillScore = desiredSkills.length > 0 ? matchedSkills.length / desiredSkills.length : 0;
    const tzDiffHours = Math.abs(requesterTz - Number(candidate.timezone_offset));
    const timezoneScore = Math.max(0, 1 - tzDiffHours / 12);

    const totalScore = Number((0.65 * skillScore + 0.35 * timezoneScore).toFixed(4));

    return {
      user: {
        id: candidate.id,
        name: candidate.name,
        skills: candidateSkills,
        timezoneOffset: Number(candidate.timezone_offset),
      },
      totalScore,
      explanation: {
        formula: '0.65 * skillScore + 0.35 * timezoneScore',
        matchedSkills,
        desiredSkillsCount: desiredSkills.length,
        skillScore: Number(skillScore.toFixed(3)),
        timezoneDiffHours: Number(tzDiffHours.toFixed(2)),
        timezoneScore: Number(timezoneScore.toFixed(3)),
        summary: `Matches ${matchedSkills.length}/${desiredSkills.length} desired skills (${matchedSkills.join(', ') || 'none'
          }) and is ${tzDiffHours}h from your timezone.`,
      },
    };
  });

  scored.sort((a, b) => b.totalScore - a.totalScore);
  return scored.slice(0, limit);
}


export async function getTeamAuditLogs(teamId: string) {
  const res = await pool.query(
    `SELECT id, team_id, actor_id, action, metadata, created_at
     FROM audit_logs
     WHERE team_id = $1
     ORDER BY created_at DESC`,
    [teamId]
  );
  return res.rows;
}

