import 'dotenv/config';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import crypto from 'node:crypto';
import {
  pool,
  initSchema,
  createTeam,
  createInviteCode,
  joinTeamWithInvite,
  leaveTeam,
  AppError,
} from '../src/lib/team-service.js';

describe('Saathi: Race-Proof Team Formation Concurrency & Rules Suite', () => {
  beforeAll(async () => {
    await initSchema();
  });

  beforeEach(async () => {
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
    await pool.end();
  });

  it('PROVES CONCURRENCY: 50 people try to take the last seat at the exact same instant -> exactly 1 succeeds and 49 get 409 Conflict', async () => {
    const hackathonId = 'hack_2026';


    const userValues: string[] = [];
    for (let i = 1; i <= 53; i++) {
      userValues.push(`('User ${i}', 'user${i}@example.com')`);
    }
    const usersRes = await pool.query(
      `INSERT INTO users (name, email) VALUES ${userValues.join(',')} RETURNING id`
    );
    const allUsers = usersRes.rows.map((r) => r.id as string);

    const [leaderId, member2Id, member3Id, ...fiftyContenders] = allUsers;


    const { body: team } = await createTeam({
      userId: leaderId!,
      hackathonId,
      name: 'Team Locking Legends',
      minSize: 2,
      maxSize: 4,
    });


    const { body: invite } = await createInviteCode({
      leaderId: leaderId!,
      teamId: team.id,
      ttlMinutes: 30,
    });

    await joinTeamWithInvite({ userId: member2Id!, inviteCode: invite.code });
    await joinTeamWithInvite({ userId: member3Id!, inviteCode: invite.code });


    const beforeCheck = await pool.query(`SELECT current_member_count FROM teams WHERE id = $1`, [
      team.id,
    ]);
    expect(beforeCheck.rows[0].current_member_count).toBe(3);


    const results = await Promise.allSettled(
      fiftyContenders.map((contenderId) =>
        joinTeamWithInvite({
          userId: contenderId,
          inviteCode: invite.code,
          idempotencyKey: crypto.randomUUID(),
        })
      )
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failedWithTeamFull = results.filter(
      (r) =>
        r.status === 'rejected' &&
        r.reason instanceof AppError &&
        r.reason.statusCode === 409 &&
        r.reason.code === 'TEAM_FULL'
    );


    expect(succeeded.length).toBe(1);
    expect(failedWithTeamFull.length).toBe(49);


    const memberRows = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM team_members WHERE team_id = $1`,
      [team.id]
    );
    const teamRow = await pool.query(
      `SELECT current_member_count, is_looking_for_members FROM teams WHERE id = $1`,
      [team.id]
    );

    expect(memberRows.rows[0].cnt).toBe(4);
    expect(teamRow.rows[0].current_member_count).toBe(4);
    expect(teamRow.rows[0].is_looking_for_members).toBe(false);
  });

  it('PROVES IDEMPOTENCY: Retried / double-clicked requests never create duplicate teams or fail on retry', async () => {
    const userRes = await pool.query(
      `INSERT INTO users (name, email) VALUES ('Solo Hacker', 'solo@example.com') RETURNING id`
    );
    const userId = userRes.rows[0].id;
    const sameIdempotencyKey = crypto.randomUUID();


    const clicks = await Promise.all(
      Array.from({ length: 5 }).map(() =>
        createTeam({
          userId,
          hackathonId: 'hack_2026',
          name: 'Idempotent Innovators',
          idempotencyKey: sameIdempotencyKey,
        })
      )
    );


    const uniqueTeamIds = new Set(clicks.map((c) => c.body.id));
    expect(uniqueTeamIds.size).toBe(1);
    expect(clicks.filter((c) => c.replayed).length).toBe(4);
  });

  it('PROVES SUCCESSION & AUTO-DELETE: Leadership passes when leader leaves, and last member leaving deletes the team', async () => {
    const usersRes = await pool.query(
      `INSERT INTO users (name, email) VALUES ('Leader', 'l@e.com'), ('Second', 's@e.com') RETURNING id`
    );
    const [leaderId, secondId] = usersRes.rows.map((r) => r.id);

    const { body: team } = await createTeam({
      userId: leaderId,
      hackathonId: 'hack_2026',
      name: 'Succession Squad',
    });
    const { body: invite } = await createInviteCode({ leaderId, teamId: team.id });
    await joinTeamWithInvite({ userId: secondId, inviteCode: invite.code });


    const leave1 = await leaveTeam({ userId: leaderId, teamId: team.id });
    expect(leave1.body.deleted).toBe(false);
    expect(leave1.body.newLeaderId).toBe(secondId);


    const leave2 = await leaveTeam({ userId: secondId, teamId: team.id });
    expect(leave2.body.deleted).toBe(true);

    const teamCheck = await pool.query(`SELECT * FROM teams WHERE id = $1`, [team.id]);
    const auditCheck = await pool.query(`SELECT action FROM audit_logs WHERE team_id = $1`, [
      team.id,
    ]);
    expect(teamCheck.rowCount).toBe(0);
    expect(auditCheck.rows.map((r) => r.action)).toContain('LAST_MEMBER_LEFT_TEAM_DELETED');
  });
});