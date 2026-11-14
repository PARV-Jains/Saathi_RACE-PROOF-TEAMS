import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  pool,
  initSchema,
  joinTeamWithInvite,
} from '../src/lib/team-service.js';

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const address = srv.address();
      if (!address || typeof address === 'string') {
        srv.close(() => reject(new Error('Failed to obtain port')));
        return;
      }
      const port = address.port;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

async function waitForServer(url: string, timeoutMs = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/board`);
      if (res.status === 200) return;
    } catch {

    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Server at ${url} failed to start within ${timeoutMs}ms`);
}

describe('Saathi: Chaos & Crash Resilience Suite', () => {
  let spawnedProcesses: ChildProcess[] = [];

  beforeAll(async () => {
    await initSchema();
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

    for (const proc of spawnedProcesses) {
      if (proc.pid && !proc.killed) {
        try {
          if (process.platform !== 'win32') {
            process.kill(-proc.pid, 'SIGKILL');
          } else {
            proc.kill('SIGKILL');
          }
        } catch {

        }
      }
    }
    await pool.end();
  });

  it('PROVES ATOMIC ROLLBACK: Server killed mid-flight (SIGKILL) during join transaction -> PostgreSQL rolls back with zero corrupted member counts', async () => {
    const hackathonId = 'hack_chaos_2026';
    const leaderId = crypto.randomUUID();
    const candidateId = crypto.randomUUID();
    const teamId = crypto.randomUUID();
    const inviteCode = 'CHAOS_INVITE_' + crypto.randomBytes(4).toString('hex');


    await pool.query(
      `INSERT INTO users (id, name, email, skills, timezone_offset) VALUES
       ($1, 'Chaos Leader', 'leader@chaos.test', ARRAY['TypeScript', 'PostgreSQL'], 5.5),
       ($2, 'Chaos Candidate', 'candidate@chaos.test', ARRAY['React', 'Node.js'], 5.5)`,
      [leaderId, candidateId]
    );


    await pool.query(
      `INSERT INTO teams (id, hackathon_id, name, description, leader_id, min_size, max_size, current_member_count, is_looking_for_members)
       VALUES ($1, $2, 'Chaos Resistant Team', 'Testing ungraceful shutdown', $3, 2, 4, 1, TRUE)`,
      [teamId, hackathonId, leaderId]
    );

    await pool.query(
      `INSERT INTO team_members (team_id, hackathon_id, user_id, role)
       VALUES ($1, $2, $3, 'LEADER')`,
      [teamId, hackathonId, leaderId]
    );


    await pool.query(
      `INSERT INTO invite_codes (code, team_id, created_by, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')`,
      [inviteCode, teamId, leaderId]
    );


    const initialTeamRes = await pool.query(`SELECT current_member_count FROM teams WHERE id = $1`, [teamId]);
    expect(initialTeamRes.rows[0].current_member_count).toBe(1);

    const initialMembersRes = await pool.query(`SELECT COUNT(*)::int AS count FROM team_members WHERE team_id = $1`, [teamId]);
    expect(initialMembersRes.rows[0].count).toBe(1);


    const port = await getFreePort();
    const serverUrl = `http://127.0.0.1:${port}`;
    const tsxBin = path.resolve(process.cwd(), 'node_modules/.bin/tsx');

    const serverProc = spawn(tsxBin, ['src/server.ts'], {
      env: {
        ...process.env,
        PORT: String(port),
        HOST: '127.0.0.1',
      },
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    spawnedProcesses.push(serverProc);


    await waitForServer(serverUrl);


    let networkErrorCaught = false;
    const inflightJoin = fetch(`${serverUrl}/api/teams/join-by-invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': candidateId,
        'x-chaos-delay-ms': '3000',
      },
      body: JSON.stringify({ inviteCode }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      })
      .catch((err) => {
        networkErrorCaught = true;
      });


    await new Promise((r) => setTimeout(r, 500));


    if (serverProc.pid) {
      try {
        if (process.platform !== 'win32') {
          process.kill(-serverProc.pid, 'SIGKILL');
        } else {
          serverProc.kill('SIGKILL');
        }
      } catch {
        serverProc.kill('SIGKILL');
      }
    }


    await inflightJoin;
    expect(networkErrorCaught).toBe(true);


    await new Promise((r) => setTimeout(r, 500));


    const postCrashTeam = await pool.query(
      `SELECT current_member_count, is_looking_for_members FROM teams WHERE id = $1`,
      [teamId]
    );
    expect(postCrashTeam.rows[0].current_member_count).toBe(1);
    expect(postCrashTeam.rows[0].is_looking_for_members).toBe(true);


    const postCrashMembers = await pool.query(
      `SELECT * FROM team_members WHERE team_id = $1`,
      [teamId]
    );
    expect(postCrashMembers.rowCount).toBe(1);
    expect(postCrashMembers.rows[0].user_id).toBe(leaderId);
    expect(postCrashMembers.rows.some((m) => m.user_id === candidateId)).toBe(false);


    const auditRes = await pool.query(
      `SELECT * FROM audit_logs WHERE team_id = $1 AND action = 'MEMBER_JOINED_VIA_INVITE'`,
      [teamId]
    );
    expect(auditRes.rowCount).toBe(0);


    const recoveryJoin = await joinTeamWithInvite({
      userId: candidateId,
      inviteCode,
    });
    expect(recoveryJoin.statusCode).toBe(200);
    expect(recoveryJoin.body.current_member_count).toBe(2);


    const finalTeam = await pool.query(`SELECT current_member_count FROM teams WHERE id = $1`, [teamId]);
    expect(finalTeam.rows[0].current_member_count).toBe(2);

    const finalMembers = await pool.query(`SELECT user_id FROM team_members WHERE team_id = $1 ORDER BY joined_at ASC`, [teamId]);
    expect(finalMembers.rowCount).toBe(2);
    expect(finalMembers.rows.map((r) => r.user_id)).toContain(candidateId);
  }, 30000);
});

