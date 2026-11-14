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
      // Server not ready yet
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
    // Ensure all spawned server processes are cleaned up
    for (const proc of spawnedProcesses) {
      if (proc.pid && !proc.killed) {
        try {
          if (process.platform !== 'win32') {
            process.kill(-proc.pid, 'SIGKILL');
          } else {
            proc.kill('SIGKILL');
          }
        } catch {
          // Process already dead
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

    // 1. Seed Leader and Solo Candidate in DB
    await pool.query(
      `INSERT INTO users (id, name, email, skills, timezone_offset) VALUES
       ($1, 'Chaos Leader', 'leader@chaos.test', ARRAY['TypeScript', 'PostgreSQL'], 5.5),
       ($2, 'Chaos Candidate', 'candidate@chaos.test', ARRAY['React', 'Node.js'], 5.5)`,
      [leaderId, candidateId]
    );

    // 2. Seed Team (min 2, max 4, starting with leader = 1 member)
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

    // 3. Create Valid Expiring Invite Code
    await pool.query(
      `INSERT INTO invite_codes (code, team_id, created_by, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')`,
      [inviteCode, teamId, leaderId]
    );

    // Verify initial ground-truth state
    const initialTeamRes = await pool.query(`SELECT current_member_count FROM teams WHERE id = $1`, [teamId]);
    expect(initialTeamRes.rows[0].current_member_count).toBe(1);

    const initialMembersRes = await pool.query(`SELECT COUNT(*)::int AS count FROM team_members WHERE team_id = $1`, [teamId]);
    expect(initialMembersRes.rows[0].count).toBe(1);

    // 4. Spawn Standalone Fastify Server on an isolated port
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

    // 5. Wait for server to boot and respond
    await waitForServer(serverUrl);

    // 6. Fire Join Request with a 3000ms delay inside the transaction
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

    // 7. Wait 500ms for server to execute SELECT ... FOR UPDATE, INSERT member, and enter delay
    await new Promise((r) => setTimeout(r, 500));

    // 8. CHAOS EVENT: Abruptly kill the server process via SIGKILL
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

    // Await the abrupt network drop and process termination
    await inflightJoin;
    expect(networkErrorCaught).toBe(true);

    // Allow PostgreSQL 500ms to detect broken TCP connection and execute transaction ROLLBACK
    await new Promise((r) => setTimeout(r, 500));

    // 9. VERIFY POSTGRESQL ATOMIC ROLLBACK (Zero Corrupted State)
    // Invariant A: Member count MUST NOT be incremented to 2
    const postCrashTeam = await pool.query(
      `SELECT current_member_count, is_looking_for_members FROM teams WHERE id = $1`,
      [teamId]
    );
    expect(postCrashTeam.rows[0].current_member_count).toBe(1);
    expect(postCrashTeam.rows[0].is_looking_for_members).toBe(true);

    // Invariant B: Candidate MUST NOT be present in team_members
    const postCrashMembers = await pool.query(
      `SELECT * FROM team_members WHERE team_id = $1`,
      [teamId]
    );
    expect(postCrashMembers.rowCount).toBe(1);
    expect(postCrashMembers.rows[0].user_id).toBe(leaderId);
    expect(postCrashMembers.rows.some((m) => m.user_id === candidateId)).toBe(false);

    // Invariant C: Audit log for MEMBER_JOINED_VIA_INVITE was NOT committed
    const auditRes = await pool.query(
      `SELECT * FROM audit_logs WHERE team_id = $1 AND action = 'MEMBER_JOINED_VIA_INVITE'`,
      [teamId]
    );
    expect(auditRes.rowCount).toBe(0);

    // 10. VERIFY RECOVERY: The row lock is released, and subsequent transactions succeed cleanly
    const recoveryJoin = await joinTeamWithInvite({
      userId: candidateId,
      inviteCode,
    });
    expect(recoveryJoin.statusCode).toBe(200);
    expect(recoveryJoin.body.current_member_count).toBe(2);

    // Verify final state in DB
    const finalTeam = await pool.query(`SELECT current_member_count FROM teams WHERE id = $1`, [teamId]);
    expect(finalTeam.rows[0].current_member_count).toBe(2);

    const finalMembers = await pool.query(`SELECT user_id FROM team_members WHERE team_id = $1 ORDER BY joined_at ASC`, [teamId]);
    expect(finalMembers.rowCount).toBe(2);
    expect(finalMembers.rows.map((r) => r.user_id)).toContain(candidateId);
  }, 30000);
});

