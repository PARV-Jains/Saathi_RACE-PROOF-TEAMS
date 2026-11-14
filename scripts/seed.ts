import 'dotenv/config';
import { pool, initSchema } from '../src/lib/team-service.js';
import crypto from 'node:crypto';

const TOTAL_USERS = 10_000;
const TOTAL_TEAMS = 2_000;
const HACKATHON_ID = 'hack_2026';
const BATCH_SIZE = 500;

const SKILLS_POOL = [
  'React',
  'TypeScript',
  'Node.js',
  'Next.js',
  'PostgreSQL',
  'Python',
  'PyTorch',
  'Rust',
  'Go',
  'Docker',
  'Kubernetes',
  'GraphQL',
  'Tailwind CSS',
  'AWS',
  'Solidity',
  'FastAPI',
];

const TIMEZONES = [-8, -5, -3, 0, 1, 2, 3.5, 5.5, 7, 8, 9];

function getRandomSubset<T>(arr: T[], min: number, max: number): T[] {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

async function seed() {
  console.log('🚀 Initializing database schema...');
  await initSchema();

  console.log('🧹 Cleaning existing data...');
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

  console.log(`👤 Seeding ${TOTAL_USERS.toLocaleString()} users in batches of ${BATCH_SIZE}...`);
  const startTime = Date.now();

  const userIds: string[] = [];

  for (let i = 0; i < TOTAL_USERS; i += BATCH_SIZE) {
    const batchCount = Math.min(BATCH_SIZE, TOTAL_USERS - i);
    const valuePlaceholders: string[] = [];
    const params: unknown[] = [];
    let pIdx = 1;

    for (let j = 0; j < batchCount; j++) {
      const idx = i + j + 1;
      const id = crypto.randomUUID();
      userIds.push(id);
      const name = `Hacker ${idx}`;
      const email = `hacker${idx}_${Date.now()}@hackathon.org`;
      const skills = getRandomSubset(SKILLS_POOL, 2, 4);
      const desiredSkills = getRandomSubset(SKILLS_POOL, 2, 4);
      const tz = TIMEZONES[idx % TIMEZONES.length];

      valuePlaceholders.push(
        `($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`
      );
      params.push(id, name, email, skills, desiredSkills, tz);
    }

    await pool.query(
      `INSERT INTO users (id, name, email, skills, desired_skills, timezone_offset)
       VALUES ${valuePlaceholders.join(',')}`,
      params
    );

    process.stdout.write(`  Inserted ${i + batchCount}/${TOTAL_USERS} users\r`);
  }
  console.log(`\n✅ ${TOTAL_USERS.toLocaleString()} users seeded successfully!`);

  console.log(`🛡️  Seeding ${TOTAL_TEAMS.toLocaleString()} teams with leaders & open board seats...`);

  for (let i = 0; i < TOTAL_TEAMS; i += BATCH_SIZE) {
    const batchCount = Math.min(BATCH_SIZE, TOTAL_TEAMS - i);

    const teamValues: string[] = [];
    const teamParams: unknown[] = [];
    let tIdx = 1;

    const memberValues: string[] = [];
    const memberParams: unknown[] = [];
    let mIdx = 1;

    const auditValues: string[] = [];
    const auditParams: unknown[] = [];
    let aIdx = 1;

    for (let j = 0; j < batchCount; j++) {
      const idx = i + j;
      const teamId = crypto.randomUUID();
      const leaderId = userIds[idx];
      const minSize = 2;
      const maxSize = 4;

      const looking = idx % 5 !== 0;
      const memberCount = looking ? 1 : maxSize;
      const teamName = `Team ${idx + 1}: ${SKILLS_POOL[idx % SKILLS_POOL.length]} Innovators`;
      const desc = `Building cutting-edge AI and distributed apps for ${HACKATHON_ID}.`;
      const reqSkills = getRandomSubset(SKILLS_POOL, 1, 3);

      teamValues.push(
        `($${tIdx++}, $${tIdx++}, $${tIdx++}, $${tIdx++}, $${tIdx++}, $${tIdx++}, $${tIdx++}, $${tIdx++}, $${tIdx++}, $${tIdx++})`
      );
      teamParams.push(
        teamId,
        HACKATHON_ID,
        teamName,
        desc,
        leaderId,
        minSize,
        maxSize,
        memberCount,
        reqSkills,
        looking
      );

      memberValues.push(`($${mIdx++}, $${mIdx++}, $${mIdx++}, $${mIdx++})`);
      memberParams.push(teamId, HACKATHON_ID, leaderId, 'LEADER');

      auditValues.push(`($${aIdx++}, $${aIdx++}, $${aIdx++}, $${aIdx++}, $${aIdx++})`);
      auditParams.push(teamId, HACKATHON_ID, leaderId, 'TEAM_CREATED', JSON.stringify({}));
    }


    await pool.query(
      `INSERT INTO teams (
         id, hackathon_id, name, description, leader_id, min_size, max_size,
         current_member_count, required_skills, is_looking_for_members
       )
       VALUES ${teamValues.join(',')}`,
      teamParams
    );


    await pool.query(
      `INSERT INTO team_members (team_id, hackathon_id, user_id, role)
       VALUES ${memberValues.join(',')}`,
      memberParams
    );


    await pool.query(
      `INSERT INTO audit_logs (team_id, hackathon_id, actor_id, action, metadata)
       VALUES ${auditValues.join(',')}`,
      auditParams
    );

    process.stdout.write(`  Inserted ${i + batchCount}/${TOTAL_TEAMS} teams\r`);
  }

  console.log(`\n🇮🇳 Seeding 6 designated Indian demo personas & Saathi Core Team...`);
  const parvRes = await pool.query(
    `INSERT INTO users (name, email, skills, timezone_offset)
     VALUES ('Parv Jain', 'parv.leader@demo.hack', ARRAY['TypeScript', 'PostgreSQL', 'System Architecture'], 5.5)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, skills = EXCLUDED.skills, timezone_offset = EXCLUDED.timezone_offset
     RETURNING id`
  );
  const parvId = parvRes.rows[0].id;

  const garvRes = await pool.query(
    `INSERT INTO users (name, email, skills, timezone_offset)
     VALUES ('Garv Jain', 'garv.member@demo.hack', ARRAY['React', 'Tailwind CSS', 'Vite'], 5.5)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, skills = EXCLUDED.skills, timezone_offset = EXCLUDED.timezone_offset
     RETURNING id`
  );
  const garvId = garvRes.rows[0].id;

  const aaravRes = await pool.query(
    `INSERT INTO users (name, email, skills, timezone_offset)
     VALUES ('Aarav Sharma', 'aarav.member@demo.hack', ARRAY['Node.js', 'Fastify', 'Docker'], 5.5)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, skills = EXCLUDED.skills, timezone_offset = EXCLUDED.timezone_offset
     RETURNING id`
  );
  const aaravId = aaravRes.rows[0].id;

  await pool.query(
    `INSERT INTO users (name, email, skills, timezone_offset)
     VALUES
       ('Diya Patel', 'diya.solo@demo.hack', ARRAY['Python', 'PyTorch', 'Distributed Systems'], 5.5),
       ('Rohan Verma', 'rohan.solo@demo.hack', ARRAY['Rust', 'Go', 'WebAssembly'], 5.5),
       ('Ananya Iyer', 'ananya.solo@demo.hack', ARRAY['UI/UX', 'React', 'Frontend Engineering'], 5.5)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, skills = EXCLUDED.skills, timezone_offset = EXCLUDED.timezone_offset`
  );

  const teamRes = await pool.query(
    `INSERT INTO teams (hackathon_id, name, description, leader_id, min_size, max_size, current_member_count, required_skills, is_looking_for_members)
     VALUES ($1, 'Saathi Core Team', 'High-throughput consensus protocol & fault-tolerant engine', $2, 2, 4, 3, ARRAY['TypeScript', 'PostgreSQL', 'React'], TRUE)
     ON CONFLICT (hackathon_id, name) DO UPDATE SET leader_id = EXCLUDED.leader_id, current_member_count = 3
     RETURNING id`,
    [HACKATHON_ID, parvId]
  );
  const teamId = teamRes.rows[0].id;

  await pool.query(
    `INSERT INTO team_members (team_id, hackathon_id, user_id, role)
     VALUES
       ($1, $2, $3, 'LEADER'),
       ($1, $2, $4, 'MEMBER'),
       ($1, $2, $5, 'MEMBER')
     ON CONFLICT (team_id, user_id) DO NOTHING`,
    [teamId, HACKATHON_ID, parvId, garvId, aaravId]
  );

  await pool.query(
    `INSERT INTO invite_codes (code, team_id, created_by, expires_at)
     VALUES ('SAATHI_DEMO', $1, $2, NOW() + INTERVAL '24 hours')
     ON CONFLICT (code) DO NOTHING`,
    [teamId, parvId]
  );

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n🎉 Database successfully seeded with 10,006 users and 2,001 teams in ${durationSec}s!`);


  const userCount = await pool.query(`SELECT COUNT(*)::int AS count FROM users`);
  const teamCount = await pool.query(`SELECT COUNT(*)::int AS count FROM teams`);
  const openCount = await pool.query(
    `SELECT COUNT(*)::int AS count FROM teams WHERE is_looking_for_members = TRUE`
  );
  console.log(`📊 Stats:`);
  console.log(`   - Total Users: ${userCount.rows[0].count}`);
  console.log(`   - Total Teams: ${teamCount.rows[0].count}`);
  console.log(`   - Open Teams on Board: ${openCount.rows[0].count}`);

  await pool.end();
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
