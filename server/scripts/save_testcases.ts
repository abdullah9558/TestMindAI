import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config();

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  await client.connect();

  try {
    const projRes = await client.query('SELECT id FROM projects LIMIT 1');
    if (projRes.rows.length === 0) {
      console.error('No project found. Create a project first via the app.');
      process.exit(1);
    }
    const projectId = projRes.rows[0].id;

    const testCases = [
      {
        title: 'Create BR map from Desert template',
        preconditions: 'Authenticated user, Map Creator open.',
        steps: [
          'New map → choose Desert BR template',
          'Set map size=Large and enable snap-to-grid',
          'Place basic spawn and loot zones',
          'Save draft and reopen',
        ],
        expected: 'Map saved/loaded with Desert terrain, spawn/loot zones preserved.',
        severity: 'MEDIUM',
        priority: 'P2',
        testType: 'Functional',
        platform: 'BR',
        module: 'Map Creation System',
        tags: ['map', 'creation'],
      },
      {
        title: 'Create MP map — Small arena from Empty template',
        preconditions: 'Authenticated user, Map Creator open.',
        steps: [
          'New map → choose Empty terrain + Small arena',
          'Add 2 buildings, 4 cover obstacles',
          'Set map name and save',
          'Load in test simulation',
        ],
        expected: 'Objects persist, performance within threshold.',
        severity: 'MEDIUM',
        priority: 'P2',
        testType: 'Functional',
        platform: 'MP',
        module: 'Map Creation System',
        tags: ['map', 'mp'],
      },
      {
        title: 'Object placement — collision & boundary validation',
        preconditions: 'Editor loaded, snap grid on.',
        steps: [
          'Place building overlapping another',
          'Attempt to place object partially off-boundary',
          'Move object into valid cell',
        ],
        expected: 'Overlap blocked with clear error, out-of-bound placement blocked, valid snap works.',
        severity: 'HIGH',
        priority: 'P1',
        testType: 'Functional',
        platform: 'BR/MP',
        module: 'Object Placement System',
        tags: ['placement', 'validation'],
      },
      {
        title: 'Object editing — move/rotate/duplicate/delete',
        preconditions: 'Map with multiple objects.',
        steps: [
          'Select object → rotate 90°',
          'Duplicate object',
          'Resize one object',
          'Delete duplicated object',
          'Undo action',
        ],
        expected: 'Transformations apply; duplicate independent; undo restores.',
        severity: 'MEDIUM',
        priority: 'P2',
        testType: 'Functional',
        platform: 'BR/MP',
        module: 'Object Placement System',
        tags: ['edit', 'undo'],
      },
      {
        title: 'Vehicle placement & spawn rules',
        preconditions: 'Vehicle UI open; valid vehicle spawn zones.',
        steps: [
          'Place Jeep at spawn A',
          'Place Helicopter at helicopter pad',
          'Start simulation → destroy Jeep → observe respawn timer',
        ],
        expected: 'Vehicles spawn only on valid terrain; respawn respects timer; collision checks pass.',
        severity: 'HIGH',
        priority: 'P1',
        testType: 'Functional',
        platform: 'BR',
        module: 'Vehicle Placement System',
        tags: ['vehicle', 'spawn'],
      },
      {
        title: 'Match config — player limits and lobby validation (BR)',
        preconditions: 'Host in match config.',
        steps: [
          'Set min=10 max=150 for BR',
          'Attempt start with 8 players',
          'Add players to meet min → start',
        ],
        expected: 'Start blocked when below min; allowed when >= min; settings saved.',
        severity: 'HIGH',
        priority: 'P1',
        testType: 'Functional',
        platform: 'BR',
        module: 'Match Configuration System',
        tags: ['match', 'lobby'],
      },
      {
        title: 'Team management — custom team count and spawn zones (MP)',
        preconditions: 'MP config set to 4 teams.',
        steps: [
          'Create 4 teams',
          'Assign spawn areas per team',
          'Simulate match start and verify spawn integrity',
        ],
        expected: 'Teams formed correctly; spawns respected; auto-balance optional works.',
        severity: 'MEDIUM',
        priority: 'P2',
        testType: 'Functional',
        platform: 'MP',
        module: 'Team Management System',
        tags: ['teams', 'spawn'],
      },
      {
        title: 'Testing & Simulation — AI bots, pathfinding, performance',
        preconditions: 'Map saved; simulation enabled.',
        steps: [
          'Launch simulation with 30 AI bots',
          'Run collision/pathfinding scenarios',
          'Capture FPS and heatmap',
        ],
        expected: 'Bots navigate; collisions flagged; perf metrics recorded; missing assets warned.',
        severity: 'HIGH',
        priority: 'P1',
        testType: 'Simulation',
        platform: 'BR/MP',
        module: 'Testing & Simulation Mode',
        tags: ['simulation', 'performance'],
      },
      {
        title: 'Publish & share — metadata, versioning, visibility',
        preconditions: 'Map complete with metadata and thumbnail.',
        steps: [
          'Publish public',
          'Generate share code',
          'Update map and publish new version',
          'Verify discovery listing and version history',
        ],
        expected: 'Share code works; latest version visible; private maps hidden.',
        severity: 'MEDIUM',
        priority: 'P2',
        testType: 'Functional',
        platform: 'BR/MP',
        module: 'Publishing & Sharing System',
        tags: ['publish', 'share'],
      },
      {
        title: 'Moderation flow — report and admin removal',
        preconditions: 'Published map exists.',
        steps: [
          'Player files report for violation',
          'Admin reviews & removes map',
          'Notify creator and log action',
        ],
        expected: 'Report recorded; admin action executed; map removed and creator notified.',
        severity: 'HIGH',
        priority: 'P1',
        testType: 'Security/Moderation',
        platform: 'BR/MP',
        module: 'Moderation & Reporting System',
        tags: ['moderation', 'report'],
      },
    ];

    for (const tc of testCases) {
      const q = `INSERT INTO test_cases (project_id, title, description, preconditions, steps, expected_result, severity, priority, test_type, platform, module, tags, created_by)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`;
      await client.query(q, [
        projectId,
        tc.title,
        tc.title,
        tc.preconditions,
        JSON.stringify(tc.steps),
        tc.expected,
        tc.severity,
        tc.priority,
        tc.testType,
        tc.platform,
        tc.module,
        JSON.stringify(tc.tags),
        'script',
      ]);
    }

    console.log('Inserted', testCases.length, 'test cases into project', projectId);
  } catch (err) {
    console.error('Error inserting test cases:', err);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
