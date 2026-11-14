import 'dotenv/config';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { pool, initSchema } from '../src/lib/team-service.js';
import { buildServer } from '../src/server.js';

interface AuditLogEntry {
  action: string;
}

interface DemoPersonaResponse {
  id: string;
  name: string;
  category: string;
}

describe('Saathi: Backend API Specification & Rule Verification Suite', () => {
  let server: ReturnType<typeof buildServer>;

  beforeAll(async () => {
    await initSchema();
    server = buildServer({ inviteRateLimitMax: 3, inviteRateLimitWindowMs: 60 * 1000 });
    await server.ready();
  });

  beforeEach(async () => {
    server.inviteRateLimiter.reset();
    await pool.query(`
      TRUNCATE TABLE
        idempotency_keys,
        audit_logs,
        join_requests,
        invite_codes,
        team_members,
        teams,
        users
      RESTART IDENTITY CASCADE;
    `);
  });

  afterAll(async () => {
    await server.close();
    await pool.end();
  });

  async function createTestUser(
    name: string,
    email: string,
    skills: string[] = ['React', 'Node.js'],
    desiredSkills: string[] = ['Python', 'Docker'],
    timezoneOffset: number = 5.5
  ) {
    const res = await pool.query(
      `INSERT INTO users (name, email, skills, desired_skills, timezone_offset)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, skills, desired_skills, timezone_offset`,
      [name, email, skills, desiredSkills, timezoneOffset]
    );
    return res.rows[0];
  }


  it('1. GET /health: returns 200 OK', async () => {
    const res = await server.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('ok');
  });

  it('2. Auth: Rejects unauthenticated mutating requests with 401 UNAUTHORIZED', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/teams',
      payload: { hackathonId: 'hack_2026', name: 'No Auth Team' },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('3. Auth: Accepts authentication via x-user-id header', async () => {
    const user = await createTestUser('Alice', 'alice@test.com');
    const res = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': user.id },
      payload: { hackathonId: 'hack_2026', name: 'Alice Team' },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.leader_id).toBe(user.id);
  });

  it('4. Auth: Accepts authentication via Authorization: Bearer <userId>', async () => {
    const user = await createTestUser('Bob', 'bob@test.com');
    const res = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { authorization: `Bearer ${user.id}` },
      payload: { hackathonId: 'hack_2026', name: 'Bob Team' },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.leader_id).toBe(user.id);
  });


  it('5. Validation: Fails with 400 when missing required team name or hackathonId', async () => {
    const user = await createTestUser('ValUser', 'val@test.com');
    const res = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': user.id },
      payload: { hackathonId: 'hack_2026' }, // missing name
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('6. Validation: Fails with 400 when minSize > maxSize', async () => {
    const user = await createTestUser('SizeUser', 'size@test.com');
    const res = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': user.id },
      payload: { hackathonId: 'hack_2026', name: 'Bad Size Team', minSize: 4, maxSize: 2 },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe('INVALID_SIZE');
  });

  it('7. Validation: Fails with 400 on malformed UUID in route parameters', async () => {
    const user = await createTestUser('UUIDUser', 'uuid@test.com');
    const res = await server.inject({
      method: 'POST',
      url: '/api/teams/not-a-valid-uuid/invites',
      headers: { 'x-user-id': user.id },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('8. POST /api/teams: Successfully creates team with leader and member count 1', async () => {
    const user = await createTestUser('Creator', 'creator@test.com');
    const res = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': user.id },
      payload: {
        hackathonId: 'hack_2026',
        name: 'The Architects',
        description: 'Building distributed systems',
        minSize: 2,
        maxSize: 4,
        requiredSkills: ['Node.js', 'PostgreSQL'],
      },
    });

    expect(res.statusCode).toBe(201);
    const team = JSON.parse(res.payload);
    expect(team.name).toBe('The Architects');
    expect(team.current_member_count).toBe(1);
    expect(team.leader_id).toBe(user.id);
    expect(team.is_looking_for_members).toBe(true);


    const members = await pool.query(`SELECT * FROM team_members WHERE team_id = $1`, [team.id]);
    expect(members.rowCount).toBe(1);
    expect(members.rows[0].role).toBe('LEADER');
  });

  it('9. POST /api/teams: Idempotency-Key returns identical response without creating duplicate teams', async () => {
    const user = await createTestUser('IdemUser', 'idem@test.com');
    const idempotencyKey = crypto.randomUUID();

    const res1 = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': user.id, 'Idempotency-Key': idempotencyKey },
      payload: { hackathonId: 'hack_2026', name: 'Idempotent Team' },
    });
    expect(res1.statusCode).toBe(201);
    const team1 = JSON.parse(res1.payload);


    const res2 = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': user.id, 'Idempotency-Key': idempotencyKey },
      payload: { hackathonId: 'hack_2026', name: 'Idempotent Team' },
    });
    expect(res2.statusCode).toBe(201);
    const team2 = JSON.parse(res2.payload);

    expect(team1.id).toBe(team2.id);


    const countRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM teams WHERE leader_id = $1`, [
      user.id,
    ]);
    expect(countRes.rows[0].cnt).toBe(1);
  });

  it('10. Rule: 1 Team Per User Per Hackathon - creating second team returns 409 ALREADY_IN_TEAM', async () => {
    const user = await createTestUser('OneTeam', 'oneteam@test.com');
    await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': user.id },
      payload: { hackathonId: 'hack_2026', name: 'First Team' },
    });

    const res2 = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': user.id },
      payload: { hackathonId: 'hack_2026', name: 'Second Team' },
    });
    expect(res2.statusCode).toBe(409);
    const body = JSON.parse(res2.payload);
    expect(body.code).toBe('ALREADY_IN_TEAM');
  });


  it('11. POST /api/teams/:teamId/invites: Leader generates high-entropy invite code (201)', async () => {
    const leader = await createTestUser('LeaderA', 'leadera@test.com');
    const teamRes = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': leader.id },
      payload: { hackathonId: 'hack_2026', name: 'Inviting Team' },
    });
    const team = JSON.parse(teamRes.payload);

    const inviteRes = await server.inject({
      method: 'POST',
      url: `/api/teams/${team.id}/invites`,
      headers: { 'x-user-id': leader.id },
      payload: { ttlMinutes: 120 },
    });
    expect(inviteRes.statusCode).toBe(201);
    const invite = JSON.parse(inviteRes.payload);
    expect(invite.code).toBeDefined();
    expect(invite.code.length).toBeGreaterThanOrEqual(16);
    expect(invite.revoked).toBe(false);
  });

  it('12. POST /api/teams/:teamId/invites: Non-leader cannot generate invite code (403 FORBIDDEN)', async () => {
    const leader = await createTestUser('LeaderB', 'leaderb@test.com');
    const nonLeader = await createTestUser('NonLeaderB', 'nonleaderb@test.com');
    const teamRes = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': leader.id },
      payload: { hackathonId: 'hack_2026', name: 'Protected Team' },
    });
    const team = JSON.parse(teamRes.payload);

    const res = await server.inject({
      method: 'POST',
      url: `/api/teams/${team.id}/invites`,
      headers: { 'x-user-id': nonLeader.id },
      payload: {},
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe('FORBIDDEN');
  });

  it('13. POST /api/teams/:teamId/invites: Non-existent team returns 404 TEAM_NOT_FOUND', async () => {
    const user = await createTestUser('GhostUser', 'ghost@test.com');
    const fakeTeamId = crypto.randomUUID();
    const res = await server.inject({
      method: 'POST',
      url: `/api/teams/${fakeTeamId}/invites`,
      headers: { 'x-user-id': user.id },
      payload: {},
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe('TEAM_NOT_FOUND');
  });


  it('14. POST /api/teams/join-by-invite: Successfully joins team with valid invite', async () => {
    const leader = await createTestUser('Lead14', 'lead14@test.com');
    const joiner = await createTestUser('Joiner14', 'joiner14@test.com');

    const teamRes = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': leader.id },
      payload: { hackathonId: 'hack_2026', name: 'Joinable Team', maxSize: 3 },
    });
    const team = JSON.parse(teamRes.payload);

    const inviteRes = await server.inject({
      method: 'POST',
      url: `/api/teams/${team.id}/invites`,
      headers: { 'x-user-id': leader.id },
      payload: {},
    });
    const invite = JSON.parse(inviteRes.payload);

    const joinRes = await server.inject({
      method: 'POST',
      url: '/api/teams/join-by-invite',
      headers: { 'x-user-id': joiner.id },
      payload: { inviteCode: invite.code },
    });
    expect(joinRes.statusCode).toBe(200);
    const updatedTeam = JSON.parse(joinRes.payload);
    expect(updatedTeam.current_member_count).toBe(2);

    const memberCheck = await pool.query(
      `SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [team.id, joiner.id]
    );
    expect(memberCheck.rowCount).toBe(1);
    expect(memberCheck.rows[0].role).toBe('MEMBER');
  });

  it('15. POST /api/teams/join-by-invite: Non-existent code returns 404 INVALID_INVITE', async () => {
    const joiner = await createTestUser('Joiner15', 'joiner15@test.com');
    const res = await server.inject({
      method: 'POST',
      url: '/api/teams/join-by-invite',
      headers: { 'x-user-id': joiner.id },
      payload: { inviteCode: 'non_existent_code_123' },
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe('INVALID_INVITE');
  });

  it('16. POST /api/teams/join-by-invite: Expired invite returns 410 INVITE_EXPIRED', async () => {
    const leader = await createTestUser('Lead16', 'lead16@test.com');
    const joiner = await createTestUser('Joiner16', 'joiner16@test.com');

    const teamRes = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': leader.id },
      payload: { hackathonId: 'hack_2026', name: 'Expired Invite Team' },
    });
    const team = JSON.parse(teamRes.payload);


    const expiredCode = 'expired_code_xyz';
    await pool.query(
      `INSERT INTO invite_codes (code, team_id, created_by, expires_at)
       VALUES ($1, $2, $3, NOW() - INTERVAL '1 hour')`,
      [expiredCode, team.id, leader.id]
    );

    const res = await server.inject({
      method: 'POST',
      url: '/api/teams/join-by-invite',
      headers: { 'x-user-id': joiner.id },
      payload: { inviteCode: expiredCode },
    });
    expect(res.statusCode).toBe(410);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe('INVITE_EXPIRED');
  });

  it('17. POST /api/teams/join-by-invite: Cannot join team if already in another team (409 ALREADY_IN_TEAM)', async () => {
    const leader1 = await createTestUser('Lead17A', 'lead17a@test.com');
    const leader2 = await createTestUser('Lead17B', 'lead17b@test.com');


    const team1Res = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': leader1.id },
      payload: { hackathonId: 'hack_2026', name: 'Team One 17' },
    });
    const team1 = JSON.parse(team1Res.payload);


    const team2Res = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': leader2.id },
      payload: { hackathonId: 'hack_2026', name: 'Team Two 17' },
    });
    const team2 = JSON.parse(team2Res.payload);

    const inviteRes = await server.inject({
      method: 'POST',
      url: `/api/teams/${team2.id}/invites`,
      headers: { 'x-user-id': leader2.id },
      payload: {},
    });
    const invite = JSON.parse(inviteRes.payload);


    const res = await server.inject({
      method: 'POST',
      url: '/api/teams/join-by-invite',
      headers: { 'x-user-id': leader1.id },
      payload: { inviteCode: invite.code },
    });
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe('ALREADY_IN_TEAM');
  });

  it('18. POST /api/teams/join-by-invite: Cannot join a full team (409 TEAM_FULL)', async () => {
    const leader = await createTestUser('Lead18', 'lead18@test.com');
    const member2 = await createTestUser('Mem18A', 'mem18a@test.com');
    const member3 = await createTestUser('Mem18B', 'mem18b@test.com');


    const teamRes = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': leader.id },
      payload: { hackathonId: 'hack_2026', name: 'Capacity 2 Team', minSize: 2, maxSize: 2 },
    });
    const team = JSON.parse(teamRes.payload);

    const inviteRes = await server.inject({
      method: 'POST',
      url: `/api/teams/${team.id}/invites`,
      headers: { 'x-user-id': leader.id },
      payload: {},
    });
    const invite = JSON.parse(inviteRes.payload);


    await server.inject({
      method: 'POST',
      url: '/api/teams/join-by-invite',
      headers: { 'x-user-id': member2.id },
      payload: { inviteCode: invite.code },
    });


    const res = await server.inject({
      method: 'POST',
      url: '/api/teams/join-by-invite',
      headers: { 'x-user-id': member3.id },
      payload: { inviteCode: invite.code },
    });
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe('TEAM_FULL');
  });

  it('19. Rate Limiting: Sliding-window rate limit triggers 429 after exceeding max attempts', async () => {
    const user = await createTestUser('RateUser', 'rate@test.com');

    for (let i = 0; i < 3; i++) {
      await server.inject({
        method: 'POST',
        url: '/api/teams/join-by-invite',
        headers: { 'x-user-id': user.id },
        payload: { inviteCode: `dummy_code_${i}` },
      });
    }


    const res = await server.inject({
      method: 'POST',
      url: '/api/teams/join-by-invite',
      headers: { 'x-user-id': user.id },
      payload: { inviteCode: 'dummy_code_blocked' },
    });
    expect(res.statusCode).toBe(429);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(res.headers['retry-after']).toBeDefined();
  });


  it('20. POST /api/teams/:teamId/requests: Non-member submits join request (201 PENDING)', async () => {
    const leader = await createTestUser('Lead20', 'lead20@test.com');
    const applicant = await createTestUser('App20', 'app20@test.com');

    const teamRes = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': leader.id },
      payload: { hackathonId: 'hack_2026', name: 'Open Request Team' },
    });
    const team = JSON.parse(teamRes.payload);

    const reqRes = await server.inject({
      method: 'POST',
      url: `/api/teams/${team.id}/requests`,
      headers: { 'x-user-id': applicant.id },
      payload: { message: 'I have deep Postgres and Fastify experience!' },
    });
    expect(reqRes.statusCode).toBe(201);
    const joinReq = JSON.parse(reqRes.payload);
    expect(joinReq.status).toBe('PENDING');
    expect(joinReq.team_id).toBe(team.id);
    expect(joinReq.user_id).toBe(applicant.id);
  });

  it('21. POST /api/teams/:teamId/requests: Duplicate request returns 409 CONFLICT', async () => {
    const leader = await createTestUser('Lead21', 'lead21@test.com');
    const applicant = await createTestUser('App21', 'app21@test.com');

    const teamRes = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': leader.id },
      payload: { hackathonId: 'hack_2026', name: 'Dup Request Team' },
    });
    const team = JSON.parse(teamRes.payload);

    await server.inject({
      method: 'POST',
      url: `/api/teams/${team.id}/requests`,
      headers: { 'x-user-id': applicant.id },
      payload: { message: 'First request' },
    });

    const dupRes = await server.inject({
      method: 'POST',
      url: `/api/teams/${team.id}/requests`,
      headers: { 'x-user-id': applicant.id },
      payload: { message: 'Second request' },
    });
    expect(dupRes.statusCode).toBe(409);
  });

  it('22. POST /api/requests/:requestId/respond: Leader accepts request -> adds member (200)', async () => {
    const leader = await createTestUser('Lead22', 'lead22@test.com');
    const applicant = await createTestUser('App22', 'app22@test.com');

    const teamRes = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': leader.id },
      payload: { hackathonId: 'hack_2026', name: 'Accepting Team' },
    });
    const team = JSON.parse(teamRes.payload);

    const reqRes = await server.inject({
      method: 'POST',
      url: `/api/teams/${team.id}/requests`,
      headers: { 'x-user-id': applicant.id },
      payload: {},
    });
    const joinReq = JSON.parse(reqRes.payload);

    const respondRes = await server.inject({
      method: 'POST',
      url: `/api/requests/${joinReq.id}/respond`,
      headers: { 'x-user-id': leader.id },
      payload: { decision: 'ACCEPTED' },
    });
    expect(respondRes.statusCode).toBe(200);
    const updatedReq = JSON.parse(respondRes.payload);
    expect(updatedReq.status).toBe('ACCEPTED');


    const memberCheck = await pool.query(
      `SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [team.id, applicant.id]
    );
    expect(memberCheck.rowCount).toBe(1);
  });

  it('23. POST /api/requests/:requestId/respond: Leader declines request -> status DECLINED, user not added', async () => {
    const leader = await createTestUser('Lead23', 'lead23@test.com');
    const applicant = await createTestUser('App23', 'app23@test.com');

    const teamRes = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': leader.id },
      payload: { hackathonId: 'hack_2026', name: 'Declining Team' },
    });
    const team = JSON.parse(teamRes.payload);

    const reqRes = await server.inject({
      method: 'POST',
      url: `/api/teams/${team.id}/requests`,
      headers: { 'x-user-id': applicant.id },
      payload: {},
    });
    const joinReq = JSON.parse(reqRes.payload);

    const respondRes = await server.inject({
      method: 'POST',
      url: `/api/requests/${joinReq.id}/respond`,
      headers: { 'x-user-id': leader.id },
      payload: { decision: 'DECLINED' },
    });
    expect(respondRes.statusCode).toBe(200);
    const updatedReq = JSON.parse(respondRes.payload);
    expect(updatedReq.status).toBe('DECLINED');

    const memberCheck = await pool.query(
      `SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [team.id, applicant.id]
    );
    expect(memberCheck.rowCount).toBe(0);
  });

  it('24. POST /api/requests/:requestId/respond: Non-leader cannot accept/decline request (403 FORBIDDEN)', async () => {
    const leader = await createTestUser('Lead24', 'lead24@test.com');
    const applicant = await createTestUser('App24', 'app24@test.com');
    const impostor = await createTestUser('Imp24', 'imp24@test.com');

    const teamRes = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': leader.id },
      payload: { hackathonId: 'hack_2026', name: 'Protected Decision Team' },
    });
    const team = JSON.parse(teamRes.payload);

    const reqRes = await server.inject({
      method: 'POST',
      url: `/api/teams/${team.id}/requests`,
      headers: { 'x-user-id': applicant.id },
      payload: {},
    });
    const joinReq = JSON.parse(reqRes.payload);

    const respondRes = await server.inject({
      method: 'POST',
      url: `/api/requests/${joinReq.id}/respond`,
      headers: { 'x-user-id': impostor.id },
      payload: { decision: 'ACCEPTED' },
    });
    expect(respondRes.statusCode).toBe(403);
    const body = JSON.parse(respondRes.payload);
    expect(body.code).toBe('FORBIDDEN');
  });

  it('25. POST /api/requests/:requestId/respond: Already processed request returns 409 ALREADY_PROCESSED', async () => {
    const leader = await createTestUser('Lead25', 'lead25@test.com');
    const applicant = await createTestUser('App25', 'app25@test.com');

    const teamRes = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': leader.id },
      payload: { hackathonId: 'hack_2026', name: 'Double Process Team' },
    });
    const team = JSON.parse(teamRes.payload);

    const reqRes = await server.inject({
      method: 'POST',
      url: `/api/teams/${team.id}/requests`,
      headers: { 'x-user-id': applicant.id },
      payload: {},
    });
    const joinReq = JSON.parse(reqRes.payload);

    await server.inject({
      method: 'POST',
      url: `/api/requests/${joinReq.id}/respond`,
      headers: { 'x-user-id': leader.id },
      payload: { decision: 'ACCEPTED' },
    });


    const secondRes = await server.inject({
      method: 'POST',
      url: `/api/requests/${joinReq.id}/respond`,
      headers: { 'x-user-id': leader.id },
      payload: { decision: 'DECLINED' },
    });
    expect(secondRes.statusCode).toBe(409);
    const body = JSON.parse(secondRes.payload);
    expect(body.code).toBe('ALREADY_PROCESSED');
  });


  it('26. POST /api/teams/:teamId/leave: Member leaves team, member count decrements (200)', async () => {
    const leader = await createTestUser('Lead26', 'lead26@test.com');
    const member = await createTestUser('Mem26', 'mem26@test.com');

    const teamRes = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': leader.id },
      payload: { hackathonId: 'hack_2026', name: 'Leave Team Test' },
    });
    const team = JSON.parse(teamRes.payload);

    const inviteRes = await server.inject({
      method: 'POST',
      url: `/api/teams/${team.id}/invites`,
      headers: { 'x-user-id': leader.id },
      payload: {},
    });
    const invite = JSON.parse(inviteRes.payload);

    await server.inject({
      method: 'POST',
      url: '/api/teams/join-by-invite',
      headers: { 'x-user-id': member.id },
      payload: { inviteCode: invite.code },
    });

    const leaveRes = await server.inject({
      method: 'POST',
      url: `/api/teams/${team.id}/leave`,
      headers: { 'x-user-id': member.id },
    });
    expect(leaveRes.statusCode).toBe(200);
    const result = JSON.parse(leaveRes.payload);
    expect(result.deleted).toBe(false);
    expect(result.remainingMembers).toBe(1);

    const memberCheck = await pool.query(`SELECT * FROM team_members WHERE team_id = $1`, [team.id]);
    expect(memberCheck.rowCount).toBe(1);
    expect(memberCheck.rows[0].user_id).toBe(leader.id);
  });

  it('27. POST /api/teams/:teamId/leave: Leader leaves -> leadership automatically passes to next member', async () => {
    const leader = await createTestUser('Lead27', 'lead27@test.com');
    const successor = await createTestUser('Succ27', 'succ27@test.com');

    const teamRes = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': leader.id },
      payload: { hackathonId: 'hack_2026', name: 'Successor Team' },
    });
    const team = JSON.parse(teamRes.payload);

    const inviteRes = await server.inject({
      method: 'POST',
      url: `/api/teams/${team.id}/invites`,
      headers: { 'x-user-id': leader.id },
      payload: {},
    });
    const invite = JSON.parse(inviteRes.payload);

    await server.inject({
      method: 'POST',
      url: '/api/teams/join-by-invite',
      headers: { 'x-user-id': successor.id },
      payload: { inviteCode: invite.code },
    });

    const leaveRes = await server.inject({
      method: 'POST',
      url: `/api/teams/${team.id}/leave`,
      headers: { 'x-user-id': leader.id },
    });
    expect(leaveRes.statusCode).toBe(200);
    const result = JSON.parse(leaveRes.payload);
    expect(result.deleted).toBe(false);
    expect(result.newLeaderId).toBe(successor.id);


    const teamCheck = await pool.query(`SELECT leader_id FROM teams WHERE id = $1`, [team.id]);
    expect(teamCheck.rows[0].leader_id).toBe(successor.id);
    const memberCheck = await pool.query(
      `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [team.id, successor.id]
    );
    expect(memberCheck.rows[0].role).toBe('LEADER');
  });

  it('28. POST /api/teams/:teamId/leave: Last member leaving deletes the team', async () => {
    const solo = await createTestUser('Solo28', 'solo28@test.com');
    const teamRes = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': solo.id },
      payload: { hackathonId: 'hack_2026', name: 'Delete on Leave Team' },
    });
    const team = JSON.parse(teamRes.payload);

    const leaveRes = await server.inject({
      method: 'POST',
      url: `/api/teams/${team.id}/leave`,
      headers: { 'x-user-id': solo.id },
    });
    expect(leaveRes.statusCode).toBe(200);
    const result = JSON.parse(leaveRes.payload);
    expect(result.deleted).toBe(true);

    const teamCheck = await pool.query(`SELECT * FROM teams WHERE id = $1`, [team.id]);
    expect(teamCheck.rowCount).toBe(0);
  });


  it('29. DELETE /api/teams/:teamId/members/:targetUserId: Leader can remove a member (200)', async () => {
    const leader = await createTestUser('Lead29', 'lead29@test.com');
    const member = await createTestUser('Mem29', 'mem29@test.com');

    const teamRes = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': leader.id },
      payload: { hackathonId: 'hack_2026', name: 'Kick Member Team' },
    });
    const team = JSON.parse(teamRes.payload);

    const inviteRes = await server.inject({
      method: 'POST',
      url: `/api/teams/${team.id}/invites`,
      headers: { 'x-user-id': leader.id },
      payload: {},
    });
    const invite = JSON.parse(inviteRes.payload);

    await server.inject({
      method: 'POST',
      url: '/api/teams/join-by-invite',
      headers: { 'x-user-id': member.id },
      payload: { inviteCode: invite.code },
    });

    const kickRes = await server.inject({
      method: 'DELETE',
      url: `/api/teams/${team.id}/members/${member.id}`,
      headers: { 'x-user-id': leader.id },
    });
    expect(kickRes.statusCode).toBe(200);
    const updatedTeam = JSON.parse(kickRes.payload);
    expect(updatedTeam.current_member_count).toBe(1);

    const memberCheck = await pool.query(
      `SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [team.id, member.id]
    );
    expect(memberCheck.rowCount).toBe(0);
  });

  it('30. DELETE /api/teams/:teamId/members/:targetUserId: Non-leader cannot remove a member (403 FORBIDDEN)', async () => {
    const leader = await createTestUser('Lead30', 'lead30@test.com');
    const member = await createTestUser('Mem30', 'mem30@test.com');
    const rogue = await createTestUser('Rogue30', 'rogue30@test.com');

    const teamRes = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': leader.id },
      payload: { hackathonId: 'hack_2026', name: 'No Rogue Kicking' },
    });
    const team = JSON.parse(teamRes.payload);

    const kickRes = await server.inject({
      method: 'DELETE',
      url: `/api/teams/${team.id}/members/${member.id}`,
      headers: { 'x-user-id': rogue.id },
    });
    expect(kickRes.statusCode).toBe(403);
    const body = JSON.parse(kickRes.payload);
    expect(body.code).toBe('FORBIDDEN');
  });

  it('31. DELETE /api/teams/:teamId/members/:targetUserId: Leader cannot kick themselves (400 CANNOT_KICK_SELF)', async () => {
    const leader = await createTestUser('Lead31', 'lead31@test.com');
    const teamRes = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': leader.id },
      payload: { hackathonId: 'hack_2026', name: 'Self Kick Team' },
    });
    const team = JSON.parse(teamRes.payload);

    const kickRes = await server.inject({
      method: 'DELETE',
      url: `/api/teams/${team.id}/members/${leader.id}`,
      headers: { 'x-user-id': leader.id },
    });
    expect(kickRes.statusCode).toBe(400);
    const body = JSON.parse(kickRes.payload);
    expect(body.code).toBe('CANNOT_KICK_SELF');
  });


  it('32. GET /api/board: Returns paginated open teams and supports skill filtering', async () => {
    const userA = await createTestUser('BoardUserA', 'boarda@test.com');
    const userB = await createTestUser('BoardUserB', 'boardb@test.com');

    await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': userA.id },
      payload: {
        hackathonId: 'hack_2026',
        name: 'Rust Masters',
        requiredSkills: ['Rust', 'WebAssembly'],
      },
    });

    await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': userB.id },
      payload: {
        hackathonId: 'hack_2026',
        name: 'Python AI Pioneers',
        requiredSkills: ['Python', 'PyTorch'],
      },
    });


    const boardRes = await server.inject({
      method: 'GET',
      url: '/api/board?hackathonId=hack_2026&limit=10',
    });
    expect(boardRes.statusCode).toBe(200);
    const board = JSON.parse(boardRes.payload);
    expect(board.items.length).toBe(2);


    const filteredRes = await server.inject({
      method: 'GET',
      url: '/api/board?hackathonId=hack_2026&skill=Python',
    });
    expect(filteredRes.statusCode).toBe(200);
    const filtered = JSON.parse(filteredRes.payload);
    expect(filtered.items.length).toBe(1);
    expect(filtered.items[0].name).toBe('Python AI Pioneers');
  });

  it('33. GET /api/suggestions: Returns ranked candidates with explainable scores', async () => {
    const requester = await createTestUser(
      'Requester',
      'req@test.com',
      ['TypeScript'],
      ['Python', 'FastAPI'],
      5.5
    );
    const candidateHigh = await createTestUser(
      'CandHigh',
      'candhigh@test.com',
      ['Python', 'FastAPI'],
      [],
      5.5
    );
    const candidateLow = await createTestUser(
      'CandLow',
      'candlow@test.com',
      ['C++'],
      [],
      -5.0
    );

    const res = await server.inject({
      method: 'GET',
      url: '/api/suggestions?hackathonId=hack_2026',
      headers: { 'x-user-id': requester.id },
    });
    expect(res.statusCode).toBe(200);
    const suggestions = JSON.parse(res.payload);
    expect(suggestions.length).toBe(2);
    expect(suggestions[0].user.id).toBe(candidateHigh.id);
    expect(suggestions[0].totalScore).toBeGreaterThan(suggestions[1].totalScore);
    expect(suggestions[0].explanation).toBeDefined();
    expect(suggestions[0].explanation.formula).toBe('0.65 * skillScore + 0.35 * timezoneScore');
  });

  it('34. GET /api/teams/:teamId/audit-logs: Returns chronological audit logs', async () => {
    const leader = await createTestUser('AuditLead', 'auditlead@test.com');
    const teamRes = await server.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': leader.id },
      payload: { hackathonId: 'hack_2026', name: 'Audited Team' },
    });
    const team = JSON.parse(teamRes.payload);

    await server.inject({
      method: 'POST',
      url: `/api/teams/${team.id}/invites`,
      headers: { 'x-user-id': leader.id },
      payload: {},
    });

    const logsRes = await server.inject({
      method: 'GET',
      url: `/api/teams/${team.id}/audit-logs`,
      headers: { 'x-user-id': leader.id },
    });
    expect(logsRes.statusCode).toBe(200);
    const logs = JSON.parse(logsRes.payload);
    expect(logs.length).toBeGreaterThanOrEqual(2);
    const actions = logs.map((l: AuditLogEntry) => l.action);
    expect(actions).toContain('TEAM_CREATED');
    expect(actions).toContain('INVITE_CREATED');
  });


  it('35. GET /api/events: Connects to SSE stream and receives broadcasted events', async () => {
    let capturedData = '';
    const mockClient = {
      write: (chunk: string) => {
        capturedData += chunk;
      },
      end: () => { },
    } as unknown as Parameters<typeof server.sseManager.addClient>[0];

    const cleanup = server.sseManager.addClient(mockClient);
    expect(server.sseManager.clientCount).toBe(1);

    server.sseManager.broadcast('team:created', { id: 'team-123', name: 'SSE Test Team' });

    expect(capturedData).toContain('event: team:created');
    expect(capturedData).toContain('team-123');

    cleanup();
    expect(server.sseManager.clientCount).toBe(0);
  });

  it('36. POST /api/demo/simulate-race: Accepts empty body with content-type application/json', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/demo/simulate-race',
      headers: {
        'content-type': 'application/json',
      },
    });
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.payload);
    expect(data.totalAttempts).toBe(50);
    expect(data.succeededCount).toBe(1);
    expect(data.failed409Count).toBe(49);
  }, 30000);

  it('37. GET /api/demo-users: Returns 6 sample users (1 Team Leader, 2 Members, 3 Solos)', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/demo-users',
    });
    expect(res.statusCode).toBe(200);
    const users = JSON.parse(res.payload) as DemoPersonaResponse[];
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBe(6);
    expect(users.some((u) => u.category === 'Team Leader')).toBe(true);
    expect(users.filter((u) => u.category === 'Team Member').length).toBe(2);
    expect(users.filter((u) => u.category === 'Solo Hacker').length).toBe(3);
  });

  it('38. GET /api/my-team: Given x-user-id, returns current team, roster, invites, and pending requests', async () => {
    const demoUsersRes = await server.inject({
      method: 'GET',
      url: '/api/demo-users',
    });
    const users = JSON.parse(demoUsersRes.payload) as DemoPersonaResponse[];
    const leader = users.find((u) => u.category === 'Team Leader');
    expect(leader).toBeDefined();

    const teamRes = await server.inject({
      method: 'GET',
      url: '/api/my-team',
      headers: { 'x-user-id': leader!.id },
    });
    expect(teamRes.statusCode).toBe(200);
    const data = JSON.parse(teamRes.payload);
    expect(data.inTeam).toBe(true);
    expect(data.team).toBeDefined();
    expect(data.team.leader_id).toBe(leader!.id);
    expect(data.members.length).toBeGreaterThanOrEqual(1);


    const solo = users.find((u) => u.category === 'Solo Hacker');
    const soloRes = await server.inject({
      method: 'GET',
      url: '/api/my-team',
      headers: { 'x-user-id': solo!.id },
    });
    expect(soloRes.statusCode).toBe(200);
    const soloData = JSON.parse(soloRes.payload);
    expect(soloData.inTeam).toBe(false);
    expect(soloData.team).toBeNull();
  });

  it('39. GET /api/scale-stats: Returns live scale telemetry, benchmark data, and architectural pillars', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/scale-stats',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.scale).toBeDefined();
    expect(typeof body.scale.totalUsers).toBe('number');
    expect(typeof body.scale.totalTeams).toBe('number');
    expect(body.benchmark).toBeDefined();
    expect(body.benchmark.status).toBe('PASSED');
    expect(body.benchmark.targetP95Ms).toBe(200);
    expect(body.benchmark.verifiedP95Ms).toBeLessThanOrEqual(200);
    expect(body.architecturalPillars.length).toBeGreaterThan(0);
    expect(body.cliCommands.loadtest).toBe('npm run loadtest');
  });
});

