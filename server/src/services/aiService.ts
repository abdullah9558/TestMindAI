import axios from 'axios';

interface TestCaseGenerationInput {
  appDescription: string;
  perspectives: string[];
  platform?: string;
  testCount?: number | 'Auto';
  videoAnalysis?: string;
}

interface GeneratedTestCase {
  title: string;
  preconditions: string;
  steps: string[];
  expectedResult: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  priority: 'P3' | 'P2' | 'P1' | 'P0';
  testType: string;
  module: string;
  platform?: string;
  tags: string[];
}

export async function generateTestCasesWithAI(input: TestCaseGenerationInput): Promise<GeneratedTestCase[]> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn('GEMINI_API_KEY not set, using comprehensive synthetic test cases');
      return generateComprehensiveSyntheticTestCases(input);
    }

    const countInstruction = input.testCount === 'Auto'
      ? 'Generate as many high-value test cases as possible with no strict upper limit. Aim for 50-100+ comprehensive test cases.'
      : typeof input.testCount === 'number'
      ? `Generate exactly ${input.testCount} distinct test cases. If you generate more, return only the first ${input.testCount} test cases.`
      : 'Generate a comprehensive set of test cases with at least 50 distinct entries covering all major features and edge cases.';

    const prompt = `You are an expert QA specialist with deep knowledge of game development, map creation systems, and multiplayer game architecture. Generate EXTENSIVE and COMPREHENSIVE test cases for the following application.

Application Description: 
${input.appDescription}

Platform Focus: ${input.platform || 'Cross-platform game'}

Generate test cases focusing on: ${input.perspectives.join(', ')}

${input.videoAnalysis ? `Video Analysis Notes: ${input.videoAnalysis}` : ''}

${countInstruction}

CRITICAL REQUIREMENTS:
1. ALL test cases MUST be directly tied to the user story and features described. Do NOT invent features.
2. Generate test cases for EVERY major feature module mentioned in the description.
3. Include edge cases, error conditions, boundary testing, and performance scenarios.
4. Test both happy paths and failure scenarios.
5. Include security, data integrity, and collision detection tests.
6. Test UI/UX, accessibility, and usability aspects.
7. Test integration between modules.
8. Include stress testing and limit testing scenarios.

FEATURE MODULES TO TEST (if present in description):
- Map Creation System (create, select, save, load, rename)
- Object Placement System (place, move, rotate, resize, delete, multi-select)
- Vehicle Placement System (spawn, respawn, collision, terrain validation)
- Match Configuration System (player limits, rules, lobby settings)
- Team Management System (team setup, spawn zones, balancing)
- Testing & Simulation Mode (test mode, AI bots, performance)
- Publishing & Sharing System (publish, share codes, versions)
- Community Discovery System (search, filters, ratings)
- Moderation & Reporting System (reporting, warnings, removals)
- Custom Lobby Integration (lobby creation, validation, launch)

TEST CASE CATEGORIES TO INCLUDE:
1. Functional tests (core features work)
2. Edge cases (boundaries, limits, special values)
3. Error handling (invalid inputs, errors)
4. Data integrity (persistence, consistency)
5. Security (authorization, exploit prevention)
6. Performance (load times, optimization)
7. UI/UX (responsiveness, accessibility)
8. Integration (module interaction)
9. Regression (existing features still work)
10. Stress tests (maximum loads, concurrent actions)

For each test case, provide a JSON object with this structure:
{
  "title": "Specific, descriptive test case title",
  "preconditions": "Detailed setup requirements before test",
  "steps": ["Step 1", "Step 2", "Step 3", ...],
  "expectedResult": "Specific expected outcome",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "priority": "P3|P2|P1|P0",
  "testType": "Functional|Integration|Security|Performance|UI/UX|Edge Case|Regression|Stress",
  "module": "Module name from the feature",
  "platform": "Platform identifier",
  "tags": ["tag1", "tag2", "tag3"]
}

Return ONLY a JSON array with test case objects, no other text. Ensure high quality and relevance to the actual user story.`;

    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        params: {
          key: apiKey,
        },
      }
    );

    const responseText = response.data.candidates[0].content.parts[0].text;
    console.debug('AI response (raw):', responseText?.slice ? responseText.slice(0, 3000) : responseText);
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      console.warn('Failed to parse AI response, using comprehensive synthetic data');
      return generateComprehensiveSyntheticTestCases(input);
    }

    let testCases: GeneratedTestCase[] = JSON.parse(jsonMatch[0]);
    testCases = testCases.map(tc => ({
      ...tc,
      platform: tc.platform || input.platform || 'Cross-platform',
    }));

    // Quality validation: ensure test cases are relevant
    const desc = (input.appDescription || '').toLowerCase();
    const seededKeywords = [
      'map', 'maps', 'map creator', 'create map', 'terrain', 'template', 'object', 'objects',
      'vehicle', 'vehicles', 'publish', 'publish map', 'match', 'matches', 'br', 'battle royale',
      'mp', 'multiplayer', 'spawn', 'spawn point', 'team', 'teams', 'lobby', 'simulation', 'test',
      'performance', 'collision', 'placement', 'editor', 'share', 'moderation', 'discovery'
    ];

    const dynamicKeywords = Array.from(new Set(seededKeywords.filter(k => desc.includes(k))));
    if (dynamicKeywords.length === 0) {
      const words = desc.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 4);
      const freq: Record<string, number> = {};
      for (const w of words) freq[w] = (freq[w] || 0) + 1;
      const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0]);
      dynamicKeywords.push(...top);
    }

    const matchCountFor = (tc: GeneratedTestCase) => {
      const hay = `${tc.title} ${tc.preconditions} ${tc.steps.join(' ')} ${tc.expectedResult} ${tc.module}`.toLowerCase();
      let count = 0;
      for (const k of dynamicKeywords) if (hay.includes(k)) count++;
      return count;
    };

    // Filter for relevance but keep all that have at least some match
    const filtered = testCases.filter(tc => matchCountFor(tc) > 0);
    
    if (filtered.length === 0) {
      console.warn('No relevant AI test cases found, using synthetic generation');
      return generateComprehensiveSyntheticTestCases(input);
    }

    // If user requested exact count, handle specially
    if (typeof input.testCount === 'number') {
      const target = input.testCount;
      const result: GeneratedTestCase[] = [];
      filtered.sort((a, b) => matchCountFor(b) - matchCountFor(a));
      result.push(...filtered);
      if (result.length < target) {
        const needed = target - result.length;
        result.push(...generateComprehensiveSyntheticTestCases({ ...input, testCount: needed }));
      }
      return result.slice(0, target);
    }

    // Auto mode: return all filtered cases (prioritize AI generation)
    if (input.testCount === 'Auto') {
      if (filtered.length > 0) {
        return filtered;
      }
      return generateComprehensiveSyntheticTestCases(input);
    }

    // Default: return filtered if present
    if (dynamicKeywords.length > 0 && filtered.length > 0) {
      return filtered;
    }

    return testCases;
  } catch (error) {
    console.error('Error generating test cases with AI:', error);
    // Return mock data on error
    return generateMockTestCases(input);
  }
}

function generateMockTestCases(input: TestCaseGenerationInput): GeneratedTestCase[] {
  const platformLabel = input.platform || 'Web';
  return [
    {
      title: `Verify core functionality of ${input.appDescription.substring(0, 30)}...`,
      preconditions: 'User is authenticated and system is ready',
      steps: ['Open the application', 'Navigate to main feature', 'Verify functionality'],
      expectedResult: 'Feature works as expected',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Core',
      platform: platformLabel,
      tags: ['functional', 'smoke'],
    },
    {
      title: 'Test UI/UX responsiveness on different screen sizes',
      preconditions: 'Application is loaded',
      steps: ['Resize browser window', 'Verify layout adjusts', 'Check element visibility'],
      expectedResult: 'UI is responsive and elements are visible',
      severity: 'MEDIUM',
      priority: 'P2',
      testType: 'UI/UX',
      module: 'Frontend',
      tags: ['responsive', 'ui'],
    },
    {
      title: 'Validate edge cases and error handling',
      preconditions: 'System is initialized',
      steps: ['Input invalid data', 'Submit form', 'Observe error handling'],
      expectedResult: 'System gracefully handles invalid input',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Edge Case',
      module: 'Validation',
      tags: ['edge-case', 'security'],
    },
    {
      title: 'Test API performance under load',
      preconditions: 'API endpoints are accessible',
      steps: ['Send multiple requests', 'Monitor response time', 'Verify accuracy'],
      expectedResult: 'API responds within acceptable time',
      severity: 'MEDIUM',
      priority: 'P2',
      testType: 'Performance',
      module: 'Backend',
      tags: ['performance', 'api'],
    },
    {
      title: 'Verify data persistence and consistency',
      preconditions: 'Database is connected',
      steps: ['Create data', 'Verify storage', 'Retrieve and compare'],
      expectedResult: 'Data is correctly persisted and retrieved',
      severity: 'CRITICAL',
      priority: 'P0',
      testType: 'Data Integrity',
      module: 'Database',
      tags: ['database', 'critical'],
    },
    {
      title: 'Check authentication and session handling',
      preconditions: 'User login is available',
      steps: ['Log in with valid credentials', 'Verify session persists', 'Log out and confirm access revoked'],
      expectedResult: 'Authentication and session state are correct',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Security',
      module: 'Auth',
      tags: ['security', 'auth'],
    },
    {
      title: 'Validate input validation and form submission',
      preconditions: 'Form page is loaded',
      steps: ['Enter invalid values', 'Submit form', 'Verify error messages'],
      expectedResult: 'Validation errors are shown and invalid submission is blocked',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Validation',
      module: 'Forms',
      tags: ['input', 'validation'],
    },
    {
      title: 'Verify accessibility of key workflows',
      preconditions: 'Application is accessible via keyboard',
      steps: ['Use keyboard only to navigate', 'Activate controls', 'Confirm focus indicators are present'],
      expectedResult: 'Application can be used with keyboard navigation',
      severity: 'MEDIUM',
      priority: 'P2',
      testType: 'Accessibility',
      module: 'Frontend',
      tags: ['accessibility', 'a11y'],
    },
    {
      title: 'Confirm error screens and recovery paths',
      preconditions: 'System is in a recoverable error state',
      steps: ['Trigger a failure', 'Observe error feedback', 'Recover and retry the action'],
      expectedResult: 'Errors are surfaced clearly and recovery is possible',
      severity: 'MEDIUM',
      priority: 'P2',
      testType: 'Error Handling',
      module: 'Recovery',
      tags: ['error-handling', 'usability'],
    },
    {
      title: 'Test permissions and access control boundaries',
      preconditions: 'Multiple user roles exist',
      steps: ['Log in as different user roles', 'Attempt restricted actions', 'Verify permissions behavior'],
      expectedResult: 'Access controls enforce role restrictions correctly',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Security',
      module: 'Authorization',
      tags: ['roles', 'access-control'],
    },
    {
      title: 'Validate data export and reporting features',
      preconditions: 'Relevant data is available',
      steps: ['Export a report', 'Open the exported file', 'Verify expected content'],
      expectedResult: 'Exported report contains accurate and complete data',
      severity: 'MEDIUM',
      priority: 'P2',
      testType: 'Functional',
      module: 'Reporting',
      tags: ['export', 'reporting'],
    },
    {
      title: 'Check session timeout and auto-logout behavior',
      preconditions: 'User is logged in',
      steps: ['Leave session idle', 'Wait for timeout', 'Attempt to perform an action'],
      expectedResult: 'Session expires and reauthentication is required',
      severity: 'MEDIUM',
      priority: 'P2',
      testType: 'Security',
      module: 'Session Management',
      tags: ['timeout', 'security'],
    },
  ];
}

function generateComprehensiveSyntheticTestCases(input: TestCaseGenerationInput): GeneratedTestCase[] {
  const testCases: GeneratedTestCase[] = [];
  const desc = (input.appDescription || '').toLowerCase();
  
  const modeBR = /\b(battle royale|br)\b/.test(desc);
  const modeMP = /\b(multiplayer|mp)\b/.test(desc);
  const hasMapCreator = /\b(map creator|custom map|map creation|map editor)\b/.test(desc);
  const hasPublishing = /\b(publish|share|community|discovery)\b/.test(desc);
  const hasTeams = /\b(team|teams|squad)\b/.test(desc);

  const sizes = ['Small', 'Medium', 'Large'];
  const terrains = ['Desert', 'Snow', 'Forest', 'Urban', 'Industrial', 'Island', 'Military Base'];
  const vehicleTypes = ['ATV', 'Motorcycle', 'Jeep', 'Tank', 'Helicopter', 'Boat', 'Truck'];
  const buildings = ['House', 'Warehouse', 'Tower', 'Bunker', 'Factory', 'Shop', 'Apartment'];
  const obstacles = ['Barrier', 'Sandbag', 'Crate', 'Container', 'Fence', 'Wall', 'Barricade'];
  
  // 1. Map Creation System Tests (15-20 test cases)
  if (hasMapCreator) {
    const mapModes = modeBR ? ['BR'] : modeMP ? ['MP'] : ['BR', 'MP'];
    
    for (const mode of mapModes) {
      for (const size of sizes) {
        testCases.push({
          title: `Create new ${mode} map with ${size} terrain template successfully`,
          preconditions: 'User is authenticated and logged into map creator',
          steps: [
            'Click "Create New Map"',
            `Select ${mode} map type`,
            `Choose ${size} ${terrains[0]} template`,
            'Click "Create"',
          ],
          expectedResult: `${mode} map created with ${size} ${terrains[0]} terrain, ready for object placement`,
          severity: 'CRITICAL',
          priority: 'P0',
          testType: 'Functional',
          module: 'Map Creation System',
          platform: input.platform || 'Cross-platform',
          tags: ['map-creation', 'core', 'acceptance'],
        });
      }
      
      for (const terrain of terrains) {
        testCases.push({
          title: `Create ${mode} map using ${terrain} terrain template`,
          preconditions: 'User is in map creation screen',
          steps: [
            'Select map mode',
            'Navigate terrain templates',
            `Select ${terrain} template`,
            'Verify terrain preview loads',
            'Click Create',
          ],
          expectedResult: `Map created with ${terrain} terrain properly rendered`,
          severity: 'HIGH',
          priority: 'P1',
          testType: 'Functional',
          module: 'Map Creation System',
          platform: input.platform || 'Cross-platform',
          tags: ['terrain', 'templates', 'map-creation'],
        });
      }
    }

    testCases.push({
      title: 'Save map as draft and verify reopen functionality',
      preconditions: 'User has created and configured a map',
      steps: [
        'Click "Save Draft"',
        'Verify save confirmation message',
        'Navigate away from map editor',
        'Open "My Drafts" section',
        'Click on saved draft map',
      ],
      expectedResult: 'Draft map reopens with all previous configurations intact',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Map Creation System',
      platform: input.platform || 'Cross-platform',
      tags: ['save', 'draft', 'data-persistence'],
    });

    testCases.push({
      title: 'Rename map and verify name updates across system',
      preconditions: 'User has a saved map draft',
      steps: [
        'Open draft map',
        'Click "Rename Map"',
        'Enter new map name',
        'Click "Confirm"',
        'Go back to drafts list',
      ],
      expectedResult: 'Map name updated everywhere, no data loss',
      severity: 'MEDIUM',
      priority: 'P2',
      testType: 'Functional',
      module: 'Map Creation System',
      platform: input.platform || 'Cross-platform',
      tags: ['rename', 'metadata'],
    });

    testCases.push({
      title: 'Clone existing map and verify independent copy created',
      preconditions: 'User has published or draft map',
      steps: [
        'Open map details',
        'Click "Clone Map"',
        'Enter new name for cloned map',
        'Click "Create Clone"',
        'Verify new map appears in drafts',
      ],
      expectedResult: 'New independent map created with all original objects and settings',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Map Creation System',
      platform: input.platform || 'Cross-platform',
      tags: ['clone', 'duplication'],
    });

    testCases.push({
      title: 'Verify grid snap-to-grid alignment system works correctly',
      preconditions: 'Map editor is open with grid visible',
      steps: [
        'Enable snap-to-grid option',
        'Place an object on the map',
        'Verify object aligns to grid points',
        'Move object and verify snapping behavior',
      ],
      expectedResult: 'Objects snap to grid points precisely, aiding alignment',
      severity: 'MEDIUM',
      priority: 'P2',
      testType: 'Functional',
      module: 'Map Creation System',
      platform: input.platform || 'Cross-platform',
      tags: ['alignment', 'ui', 'usability'],
    });

    testCases.push({
      title: 'Test camera zoom in/out functionality',
      preconditions: 'Map editor is open',
      steps: [
        'Use scroll wheel to zoom in',
        'Verify map zooms in smoothly',
        'Use scroll wheel to zoom out',
        'Verify zoom does not go beyond limits',
      ],
      expectedResult: 'Camera zooms smoothly within reasonable limits, maintains map visibility',
      severity: 'MEDIUM',
      priority: 'P2',
      testType: 'UI/UX',
      module: 'Map Creation System',
      platform: input.platform || 'Cross-platform',
      tags: ['camera', 'controls', 'usability'],
    });

    testCases.push({
      title: 'Test camera rotation and free movement',
      preconditions: 'Map editor is open',
      steps: [
        'Use right-click drag to rotate map',
        'Use arrow keys for camera movement',
        'Use middle-click to pan view',
        'Verify tactical top-down view toggle',
      ],
      expectedResult: 'Camera controls responsive, map remains visible and controllable from any angle',
      severity: 'MEDIUM',
      priority: 'P2',
      testType: 'UI/UX',
      module: 'Map Creation System',
      platform: input.platform || 'Cross-platform',
      tags: ['camera', 'controls'],
    });

    testCases.push({
      title: 'Verify terrain boundary indicators are visible',
      preconditions: 'Map editor is open',
      steps: [
        'Observe map boundaries',
        'Verify boundary lines are clearly visible',
        'Attempt to place object outside boundary',
      ],
      expectedResult: 'Boundaries clearly marked, objects cannot be placed outside valid area',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Map Creation System',
      platform: input.platform || 'Cross-platform',
      tags: ['boundaries', 'validation'],
    });
  }

  // 2. Object Placement System Tests (15-20 test cases)
  const hasObjectPlacement = /\b(object|placement|building|obstacle)\b/.test(desc);
  if (hasObjectPlacement) {
    for (const building of buildings.slice(0, 3)) {
      testCases.push({
        title: `Place ${building} object and verify collision detection`,
        preconditions: 'Map editor open with empty terrain',
        steps: [
          'Open object palette',
          `Select ${building} from buildings`,
          'Click on map to place object',
          'Place second object overlapping first',
          'Observe collision warning',
        ],
        expectedResult: `${building} placed successfully, collision warning shown for overlapping objects`,
        severity: 'HIGH',
        priority: 'P1',
        testType: 'Functional',
        module: 'Object Placement System',
        platform: input.platform || 'Cross-platform',
        tags: ['placement', 'collision', 'validation'],
      });
    }

    testCases.push({
      title: 'Test object move, rotate, and resize operations',
      preconditions: 'Map has objects placed',
      steps: [
        'Select an object',
        'Drag to move to new location',
        'Use rotate handle to rotate object',
        'Use resize handles to change size (if supported)',
        'Verify all changes save',
      ],
      expectedResult: 'Object transformations execute smoothly without data loss',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Object Placement System',
      platform: input.platform || 'Cross-platform',
      tags: ['edit', 'transform'],
    });

    testCases.push({
      title: 'Test duplicate object functionality',
      preconditions: 'Map has at least one object placed',
      steps: [
        'Select object',
        'Press Ctrl+D or right-click "Duplicate"',
        'Verify duplicate placed nearby',
        'Move duplicate to different location',
      ],
      expectedResult: 'Exact copy of object created and can be moved independently',
      severity: 'MEDIUM',
      priority: 'P2',
      testType: 'Functional',
      module: 'Object Placement System',
      platform: input.platform || 'Cross-platform',
      tags: ['duplicate', 'productivity'],
    });

    testCases.push({
      title: 'Test multi-select and batch operations',
      preconditions: 'Map has multiple objects',
      steps: [
        'Click first object',
        'Hold Shift and click additional objects',
        'Verify all selected objects highlighted',
        'Delete selected objects',
        'Verify all deleted',
      ],
      expectedResult: 'Multiple objects selected and batch operations work correctly',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Object Placement System',
      platform: input.platform || 'Cross-platform',
      tags: ['multi-select', 'batch', 'efficiency'],
    });

    testCases.push({
      title: 'Verify terrain validation prevents invalid placements',
      preconditions: 'Map with various terrain types',
      steps: [
        'Attempt to place building on water',
        'Attempt to place heavy object on weak terrain',
        'Observe validation error messages',
        'Place object on valid terrain',
      ],
      expectedResult: 'Invalid placements blocked with clear error messages, valid placements succeed',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Validation',
      module: 'Object Placement System',
      platform: input.platform || 'Cross-platform',
      tags: ['validation', 'terrain', 'rules'],
    });

    testCases.push({
      title: 'Test object alignment tools and snap-to-object',
      preconditions: 'Map with multiple objects',
      steps: [
        'Select multiple objects',
        'Use alignment tools (align left, center, etc)',
        'Enable snap-to-object option',
        'Move object near another',
        'Verify snap to edge/center',
      ],
      expectedResult: 'Objects align precisely using alignment tools and snap options',
      severity: 'MEDIUM',
      priority: 'P2',
      testType: 'UI/UX',
      module: 'Object Placement System',
      platform: input.platform || 'Cross-platform',
      tags: ['alignment', 'usability'],
    });

    testCases.push({
      title: 'Verify undo/redo functionality for object operations',
      preconditions: 'Map with objects being edited',
      steps: [
        'Place object',
        'Move object',
        'Delete object',
        'Press Ctrl+Z (undo) three times',
        'Press Ctrl+Y (redo) twice',
      ],
      expectedResult: 'Undo/redo restores correct state at each step',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Object Placement System',
      platform: input.platform || 'Cross-platform',
      tags: ['undo-redo', 'usability'],
    });

    testCases.push({
      title: 'Test restricted overlap prevention rules',
      preconditions: 'Map with spawn points and objective markers',
      steps: [
        'Place spawn point',
        'Attempt to place objective marker too close',
        'Observe overlap prevention',
        'Move objective to safe distance',
      ],
      expectedResult: 'Spawn points and objectives cannot overlap, system prevents invalid layouts',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Validation',
      module: 'Object Placement System',
      platform: input.platform || 'Cross-platform',
      tags: ['rules', 'validation'],
    });
  }

  // 3. Vehicle Placement System Tests (10-12 test cases)
  const hasVehicles = /\b(vehicle|vehicles|spawn|respawn)\b/.test(desc);
  if (hasVehicles) {
    for (const vehicle of vehicleTypes.slice(0, 4)) {
      testCases.push({
        title: `Place ${vehicle} and verify spawn functionality`,
        preconditions: 'Map editor open, vehicle placement mode active',
        steps: [
          'Select vehicle palette',
          `Choose ${vehicle}`,
          'Click on map to place',
          'Verify spawn marker displayed',
          'Test vehicle spawns correctly',
        ],
        expectedResult: `${vehicle} spawns at correct location with proper functionality`,
        severity: 'HIGH',
        priority: 'P1',
        testType: 'Functional',
        module: 'Vehicle Placement System',
        platform: input.platform || 'Cross-platform',
        tags: ['vehicle', 'spawn'],
      });
    }

    testCases.push({
      title: 'Configure vehicle respawn timers and limits',
      preconditions: 'Vehicle placed on map',
      steps: [
        'Select vehicle',
        'Open vehicle settings',
        'Set respawn timer to 60 seconds',
        'Set max active vehicles to 3',
        'Save settings',
      ],
      expectedResult: 'Vehicle respawns after configured time, max vehicles limit enforced',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Vehicle Placement System',
      platform: input.platform || 'Cross-platform',
      tags: ['configuration', 'settings'],
    });

    testCases.push({
      title: 'Verify vehicle spawn collision checks',
      preconditions: 'Multiple vehicles placed close together',
      steps: [
        'Attempt to place vehicles that would collide on spawn',
        'Observe collision warning',
        'Reposition vehicles to safe distance',
      ],
      expectedResult: 'Collision detected, vehicles moved to valid spawn locations',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Validation',
      module: 'Vehicle Placement System',
      platform: input.platform || 'Cross-platform',
      tags: ['collision', 'validation'],
    });

    testCases.push({
      title: 'Test air vehicle restricted zone validation',
      preconditions: 'Map with helicopter and restricted zones',
      steps: [
        'Select helicopter',
        'Attempt to place in restricted airspace',
        'Observe error',
        'Place in allowed zone',
      ],
      expectedResult: 'Helicopters cannot spawn in restricted airspace, validation enforced',
      severity: 'MEDIUM',
      priority: 'P2',
      testType: 'Validation',
      module: 'Vehicle Placement System',
      platform: input.platform || 'Cross-platform',
      tags: ['airspace', 'restrictions'],
    });

    testCases.push({
      title: 'Test water vehicle terrain validation',
      preconditions: 'Map with water and land areas',
      steps: [
        'Place boat on land',
        'Observe terrain validation error',
        'Place boat on water',
        'Verify correct placement',
      ],
      expectedResult: 'Water vehicles can only be placed on water terrain',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Validation',
      module: 'Vehicle Placement System',
      platform: input.platform || 'Cross-platform',
      tags: ['terrain', 'validation'],
    });
  }

  // 4. Match Configuration System Tests (10-12 test cases)
  const hasMatchConfig = /\b(match|configuration|player|lobby|rules)\b/.test(desc);
  if (hasMatchConfig) {
    const playerConfigs = [
      { min: 2, max: 20, mode: 'MP' },
      { min: 10, max: 150, mode: 'BR' },
    ];

    for (const config of playerConfigs) {
      testCases.push({
        title: `Configure ${config.mode} match with ${config.min}-${config.max} player limits`,
        preconditions: 'Map in match configuration screen',
        steps: [
          'Set minimum players to ' + config.min,
          'Set maximum players to ' + config.max,
          'Add spectator slots: 2',
          'Click Save',
        ],
        expectedResult: `Match configured for ${config.min}-${config.max} players, settings saved`,
        severity: 'HIGH',
        priority: 'P1',
        testType: 'Functional',
        module: 'Match Configuration System',
        platform: input.platform || 'Cross-platform',
        tags: ['configuration', 'rules'],
      });
    }

    testCases.push({
      title: 'Verify match fails to start with insufficient players',
      preconditions: 'Match configured with minimum 10 players',
      steps: [
        'Join with 9 players',
        'Click "Start Match"',
        'Observe error message',
        'Verify match does not start',
      ],
      expectedResult: 'Match prevents launch below minimum player count, shows clear error',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Validation',
      module: 'Match Configuration System',
      platform: input.platform || 'Cross-platform',
      tags: ['validation', 'rules'],
    });

    testCases.push({
      title: 'Configure match rules: respawn, friendly fire, damage',
      preconditions: 'Match configuration screen open',
      steps: [
        'Enable respawn',
        'Set respawn timer to 30 seconds',
        'Disable friendly fire',
        'Set damage modifier to 1.5x',
        'Save settings',
      ],
      expectedResult: 'All match rules configured and saved correctly',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Match Configuration System',
      platform: input.platform || 'Cross-platform',
      tags: ['rules', 'settings'],
    });

    testCases.push({
      title: 'Test public vs private lobby creation',
      preconditions: 'Match ready to launch',
      steps: [
        'Select private lobby',
        'Launch match',
        'Create another match with public setting',
        'Verify visibility in community lobbies',
      ],
      expectedResult: 'Private lobbies hidden, public lobbies visible to community',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Match Configuration System',
      platform: input.platform || 'Cross-platform',
      tags: ['privacy', 'lobby'],
    });

    testCases.push({
      title: 'Test password-protected lobby functionality',
      preconditions: 'Creating private match',
      steps: [
        'Set lobby as password-protected',
        'Enter password: "Test123"',
        'Launch lobby',
        'Try joining without password',
        'Join with correct password',
      ],
      expectedResult: 'Password protection enforced, only correct password grants access',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Security',
      module: 'Match Configuration System',
      platform: input.platform || 'Cross-platform',
      tags: ['security', 'privacy'],
    });

    testCases.push({
      title: 'Validate configuration prevents invalid parameter combinations',
      preconditions: 'Match configuration screen',
      steps: [
        'Set min players > max players',
        'Attempt to save',
        'Observe validation error',
        'Correct values',
        'Save successfully',
      ],
      expectedResult: 'System prevents invalid configurations with helpful error messages',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Validation',
      module: 'Match Configuration System',
      platform: input.platform || 'Cross-platform',
      tags: ['validation', 'rules'],
    });
  }

  // 5. Team Management System Tests (8-10 test cases)
  if (hasTeams) {
    const teamConfigs = [
      { count: 2, name: 'Deathmatch' },
      { count: 4, name: 'Squad Battle' },
      { count: 'Custom', name: 'Custom Teams' },
    ];

    for (const config of teamConfigs) {
      testCases.push({
        title: `Configure ${config.name} with ${config.count} teams`,
        preconditions: 'Team management screen open',
        steps: [
          `Select ${config.count} teams option`,
          'Configure players per team',
          'Assign team spawn zones',
          'Enable auto-balance',
          'Save configuration',
        ],
        expectedResult: `${config.count}-team configuration created with spawn zones assigned`,
        severity: 'HIGH',
        priority: 'P1',
        testType: 'Functional',
        module: 'Team Management System',
        platform: input.platform || 'Cross-platform',
        tags: ['teams', 'configuration'],
      });
    }

    testCases.push({
      title: 'Verify team auto-balance distributes players evenly',
      preconditions: '4-team match with auto-balance enabled',
      steps: [
        'Add 10 players to match',
        'Enable auto-balance',
        'Observe team distribution',
        'Verify each team has 2-3 players',
      ],
      expectedResult: 'Players distributed evenly across teams (max difference of 1)',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Team Management System',
      platform: input.platform || 'Cross-platform',
      tags: ['balancing', 'fairness'],
    });

    testCases.push({
      title: 'Test team spawn points and protected radius',
      preconditions: 'Teams configured with spawn zones',
      steps: [
        'Verify each team has dedicated spawn area',
        'Verify spawn protection radius visible',
        'Attempt to place objects in spawn protection',
        'Observe restriction',
      ],
      expectedResult: 'Team spawn zones protected, objects cannot overlap spawn areas',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Team Management System',
      platform: input.platform || 'Cross-platform',
      tags: ['spawn', 'protection'],
    });
  }

  // 6. Testing & Simulation Mode Tests (8-10 test cases)
  const hasSimulation = /\b(test|simulation|ai|bot|performance)\b/.test(desc);
  if (hasSimulation) {
    testCases.push({
      title: 'Launch solo test mode and verify map loads',
      preconditions: 'Map editor with completed map',
      steps: [
        'Click "Launch Test Mode"',
        'Select solo test',
        'Verify map loads in test environment',
        'Check all objects rendered correctly',
      ],
      expectedResult: 'Map loads quickly, all objects visible, playable',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Testing & Simulation Mode',
      platform: input.platform || 'Cross-platform',
      tags: ['testing', 'preview'],
    });

    testCases.push({
      title: 'Test AI bot simulation with pathfinding validation',
      preconditions: 'Map in test mode',
      steps: [
        'Launch with AI bots',
        'Observe bot movement and pathfinding',
        'Verify bots navigate around obstacles',
        'Check collision avoidance',
      ],
      expectedResult: 'AI bots navigate map smoothly, avoid collisions, reach waypoints',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Testing & Simulation Mode',
      platform: input.platform || 'Cross-platform',
      tags: ['ai', 'pathfinding', 'simulation'],
    });

    testCases.push({
      title: 'Verify collision detection during gameplay simulation',
      preconditions: 'Simulation running with objects and bots',
      steps: [
        'Observe bots interacting with environment',
        'Verify no collision clipping',
        'Test vehicle interactions',
        'Check projectile collisions',
      ],
      expectedResult: 'All collisions detected and handled correctly, no clipping',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Testing & Simulation Mode',
      platform: input.platform || 'Cross-platform',
      tags: ['collision', 'physics'],
    });

    testCases.push({
      title: 'Test spawn point validation and spawn failures',
      preconditions: 'Simulation in progress',
      steps: [
        'Monitor spawn events',
        'Verify players spawn at correct locations',
        'Test with maximum player count',
        'Observe spawn queue behavior',
      ],
      expectedResult: 'All players spawn successfully at designated spawn points',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Testing & Simulation Mode',
      platform: input.platform || 'Cross-platform',
      tags: ['spawn', 'logistics'],
    });

    testCases.push({
      title: 'Monitor FPS/performance metrics during simulation',
      preconditions: 'Test mode running with performance monitor',
      steps: [
        'Open performance monitor',
        'Observe FPS counter',
        'Verify FPS stays above 30',
        'Check memory usage',
        'Monitor frame drops',
      ],
      expectedResult: 'Stable FPS, reasonable memory usage, minimal frame drops',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Performance',
      module: 'Testing & Simulation Mode',
      platform: input.platform || 'Cross-platform',
      tags: ['performance', 'optimization'],
    });

    testCases.push({
      title: 'Verify debug warnings for missing assets and invalid spawns',
      preconditions: 'Simulation with intentional issues',
      steps: [
        'Check debug console',
        'Verify missing asset warnings shown',
        'Check for invalid spawn warnings',
        'Verify pathfinding errors logged',
      ],
      expectedResult: 'All warnings clearly logged, useful debugging information provided',
      severity: 'MEDIUM',
      priority: 'P2',
      testType: 'Functional',
      module: 'Testing & Simulation Mode',
      platform: input.platform || 'Cross-platform',
      tags: ['debugging', 'diagnostics'],
    });

    testCases.push({
      title: 'Test performance heatmap visualization',
      preconditions: 'Performance monitor enabled in test mode',
      steps: [
        'Enable heatmap view',
        'Observe CPU/GPU hot spots',
        'Identify performance-heavy areas',
        'Verify heatmap updates in real-time',
      ],
      expectedResult: 'Heatmap clearly shows performance bottlenecks, helps optimize map',
      severity: 'MEDIUM',
      priority: 'P2',
      testType: 'Performance',
      module: 'Testing & Simulation Mode',
      platform: input.platform || 'Cross-platform',
      tags: ['performance', 'visualization'],
    });
  }

  // 7. Publishing & Sharing System Tests (8-10 test cases)
  if (hasPublishing) {
    testCases.push({
      title: 'Publish map and verify it appears in community section',
      preconditions: 'Map ready for publication',
      steps: [
        'Click "Publish Map"',
        'Enter title, description, tags',
        'Upload thumbnail image',
        'Select game mode',
        'Click Publish',
      ],
      expectedResult: 'Map published, appears in community discovery section',
      severity: 'CRITICAL',
      priority: 'P0',
      testType: 'Functional',
      module: 'Publishing & Sharing System',
      platform: input.platform || 'Cross-platform',
      tags: ['publishing', 'community'],
    });

    testCases.push({
      title: 'Generate and test share code functionality',
      preconditions: 'Published map exists',
      steps: [
        'Click "Get Share Code"',
        'Copy generated code',
        'Send to friend',
        'Friend enters code in system',
        'Verify map loads from code',
      ],
      expectedResult: 'Share code generated, players can access map via code',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Publishing & Sharing System',
      platform: input.platform || 'Cross-platform',
      tags: ['sharing', 'collaboration'],
    });

    testCases.push({
      title: 'Save map as private and verify hidden from public discovery',
      preconditions: 'Map created',
      steps: [
        'Click Publish',
        'Select "Private" visibility',
        'Publish map',
        'Verify not in community discovery',
        'Verify visible in personal library',
      ],
      expectedResult: 'Private maps hidden from community, visible only to owner',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Security',
      module: 'Publishing & Sharing System',
      platform: input.platform || 'Cross-platform',
      tags: ['privacy', 'security'],
    });

    testCases.push({
      title: 'Update published map and verify version history',
      preconditions: 'Published map exists',
      steps: [
        'Edit published map',
        'Modify some objects',
        'Click "Update"',
        'View version history',
        'Verify both versions listed',
      ],
      expectedResult: 'Updated version published, version history preserved',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Publishing & Sharing System',
      platform: input.platform || 'Cross-platform',
      tags: ['versioning', 'updates'],
    });

    testCases.push({
      title: 'Verify metadata validation before publishing',
      preconditions: 'Attempting to publish map',
      steps: [
        'Try publishing without title',
        'Observe validation error',
        'Add required metadata',
        'Publish successfully',
      ],
      expectedResult: 'Metadata validation enforced, helpful errors shown',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Validation',
      module: 'Publishing & Sharing System',
      platform: input.platform || 'Cross-platform',
      tags: ['validation', 'metadata'],
    });
  }

  // 8. Community Discovery System Tests (8-10 test cases)
  if (hasPublishing) {
    testCases.push({
      title: 'Browse trending maps in community discovery',
      preconditions: 'Community discovery section open',
      steps: [
        'Navigate to Trending tab',
        'Observe list of trending maps',
        'Sort by different criteria',
        'Click on map to view details',
      ],
      expectedResult: 'Trending maps displayed, can view details and metadata',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Community Discovery System',
      platform: input.platform || 'Cross-platform',
      tags: ['discovery', 'community'],
    });

    testCases.push({
      title: 'Search and filter maps by mode, size, and tags',
      preconditions: 'Community discovery open',
      steps: [
        'Use search box to find maps',
        'Filter by BR/MP mode',
        'Filter by map size (Small/Medium/Large)',
        'Filter by tags',
        'Verify results match criteria',
      ],
      expectedResult: 'Search and filters work correctly, results are accurate',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Community Discovery System',
      platform: input.platform || 'Cross-platform',
      tags: ['search', 'filtering'],
    });

    testCases.push({
      title: 'Rate and like maps, verify updates in real-time',
      preconditions: 'Viewing published map',
      steps: [
        'Click Like button',
        'Verify like count increments',
        'Submit 5-star rating',
        'Refresh page',
        'Verify rating persisted',
      ],
      expectedResult: 'Likes and ratings tracked, updates visible immediately',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Community Discovery System',
      platform: input.platform || 'Cross-platform',
      tags: ['ratings', 'social'],
    });

    testCases.push({
      title: 'Follow creator and view their other maps',
      preconditions: 'Viewing map by a creator',
      steps: [
        'Click "Follow Creator"',
        'View creator profile',
        'Observe all maps by this creator',
        'Get notifications for new maps (if enabled)',
      ],
      expectedResult: 'Can follow creators, view their portfolio, receive updates',
      severity: 'MEDIUM',
      priority: 'P2',
      testType: 'Functional',
      module: 'Community Discovery System',
      platform: input.platform || 'Cross-platform',
      tags: ['social', 'follow'],
    });

    testCases.push({
      title: 'Verify favorite maps appear in personal favorites list',
      preconditions: 'Viewing maps in discovery',
      steps: [
        'Add maps to favorites',
        'Navigate to Favorites section',
        'Verify all favorited maps listed',
        'Remove from favorites',
        'Verify removed from list',
      ],
      expectedResult: 'Favorite maps persist and organized in personal list',
      severity: 'MEDIUM',
      priority: 'P2',
      testType: 'Functional',
      module: 'Community Discovery System',
      platform: input.platform || 'Cross-platform',
      tags: ['favorites', 'organization'],
    });
  }

  // 9. Moderation & Reporting System Tests (8-10 test cases)
  const hasModeration = /\b(moderation|report|offensive|abuse|safety)\b/.test(desc);
  if (hasModeration) {
    testCases.push({
      title: 'Submit report for offensive map content',
      preconditions: 'Viewing a suspicious map',
      steps: [
        'Click "Report Map"',
        'Select reason: Offensive Content',
        'Add explanation',
        'Submit report',
        'Verify confirmation',
      ],
      expectedResult: 'Report submitted successfully, user receives confirmation',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Moderation & Reporting System',
      platform: input.platform || 'Cross-platform',
      tags: ['moderation', 'safety'],
    });

    testCases.push({
      title: 'Report exploit map and verify escalation to moderators',
      preconditions: 'Map with suspected exploits',
      steps: [
        'Select "Report Map"',
        'Choose "Exploit Map" reason',
        'Detail the exploit',
        'Submit report',
        'Verify report logged',
      ],
      expectedResult: 'Exploit report submitted, forwarded to moderation team',
      severity: 'CRITICAL',
      priority: 'P0',
      testType: 'Functional',
      module: 'Moderation & Reporting System',
      platform: input.platform || 'Cross-platform',
      tags: ['security', 'reporting'],
    });

    testCases.push({
      title: 'Admin moderator removes inappropriate map',
      preconditions: 'Admin account, map with violations',
      steps: [
        'Log in as admin',
        'View reported maps',
        'Review map content and reports',
        'Click "Remove Map"',
        'Add removal reason',
        'Confirm removal',
      ],
      expectedResult: 'Map removed from community, creator notified, hidden from discovery',
      severity: 'CRITICAL',
      priority: 'P0',
      testType: 'Functional',
      module: 'Moderation & Reporting System',
      platform: input.platform || 'Cross-platform',
      tags: ['moderation', 'enforcement'],
    });

    testCases.push({
      title: 'Issue creator warning and restrict publishing rights',
      preconditions: 'Admin moderating creator with violations',
      steps: [
        'View creator profile',
        'Issue warning for policy violation',
        'Restrict publishing rights',
        'Set restriction duration',
        'Notify creator',
      ],
      expectedResult: 'Warning issued, publishing rights restricted for duration, creator notified',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Moderation & Reporting System',
      platform: input.platform || 'Cross-platform',
      tags: ['moderation', 'enforcement'],
    });

    testCases.push({
      title: 'Automated profanity filter prevents map publication',
      preconditions: 'Creating map with inappropriate name',
      steps: [
        'Enter offensive title for map',
        'Attempt to publish',
        'Observe automated filter warning',
        'Use appropriate title',
        'Publish successfully',
      ],
      expectedResult: 'Automated filter prevents offensive content, allows clean content',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Moderation & Reporting System',
      platform: input.platform || 'Cross-platform',
      tags: ['automation', 'safety'],
    });

    testCases.push({
      title: 'Automated performance check prevents resource-abusive maps',
      preconditions: 'Map with excessive object count',
      steps: [
        'Create map with object count exceeding limit',
        'Attempt to publish',
        'Observe performance threshold warning',
        'Reduce object count',
        'Publish successfully',
      ],
      expectedResult: 'Resource-heavy maps rejected, creator given guidance',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Performance',
      module: 'Moderation & Reporting System',
      platform: input.platform || 'Cross-platform',
      tags: ['performance', 'optimization'],
    });
  }

  // 10. Custom Lobby Integration Tests (8-10 test cases)
  const hasLobby = /\b(lobby|custom|private|invite|host)\b/.test(desc);
  if (hasLobby) {
    testCases.push({
      title: 'Create custom room with custom map',
      preconditions: 'User with published custom map',
      steps: [
        'Click "Create Lobby"',
        'Select custom map',
        'Configure match settings',
        'Set lobby as private',
        'Launch lobby',
      ],
      expectedResult: 'Custom lobby created with specified map and settings',
      severity: 'CRITICAL',
      priority: 'P0',
      testType: 'Functional',
      module: 'Custom Lobby Integration',
      platform: input.platform || 'Cross-platform',
      tags: ['lobby', 'custom-match'],
    });

    testCases.push({
      title: 'Invite friends to custom lobby and manage roster',
      preconditions: 'Custom lobby created and open',
      steps: [
        'Click "Invite Players"',
        'Select friends to invite',
        'Friends receive invitations',
        'Friends accept and join',
        'Verify players in lobby',
      ],
      expectedResult: 'Friends invited and joined successfully, roster updated',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Custom Lobby Integration',
      platform: input.platform || 'Cross-platform',
      tags: ['social', 'lobby'],
    });

    testCases.push({
      title: 'Enable spectator mode and verify spectator functionality',
      preconditions: 'Custom match in progress',
      steps: [
        'Join as spectator',
        'Observe free camera controls',
        'View all players',
        'Chat available for spectators',
      ],
      expectedResult: 'Spectators can watch match, use free camera, communicate',
      severity: 'MEDIUM',
      priority: 'P2',
      testType: 'Functional',
      module: 'Custom Lobby Integration',
      platform: input.platform || 'Cross-platform',
      tags: ['spectator', 'viewing'],
    });

    testCases.push({
      title: 'Validate minimum players before match launch',
      preconditions: 'Custom lobby with player minimum requirement',
      steps: [
        'Configure minimum 4 players',
        'Join with 3 players',
        'Attempt to start',
        'Observe error',
        'Fourth player joins',
        'Start successfully',
      ],
      expectedResult: 'Match launch blocked until minimum players met',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Validation',
      module: 'Custom Lobby Integration',
      platform: input.platform || 'Cross-platform',
      tags: ['validation', 'rules'],
    });

    testCases.push({
      title: 'Test tournament mode with multiple rounds',
      preconditions: 'Tournament setup enabled',
      steps: [
        'Configure tournament bracket',
        'Set match format and scoring',
        'Play matches',
        'Advance winners',
        'View final results',
      ],
      expectedResult: 'Tournament system manages rounds, scoring, and advancement',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Custom Lobby Integration',
      platform: input.platform || 'Cross-platform',
      tags: ['tournament', 'competitive'],
    });

    testCases.push({
      title: 'Verify map integrity check before match launch',
      preconditions: 'Lobby ready to launch',
      steps: [
        'System performs integrity check',
        'Verify all objects loaded',
        'Verify spawn points valid',
        'Verify collision system ready',
        'Match launches if all valid',
      ],
      expectedResult: 'Map integrity verified, match prevents launch with issues',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Validation',
      module: 'Custom Lobby Integration',
      platform: input.platform || 'Cross-platform',
      tags: ['validation', 'integrity'],
    });

    testCases.push({
      title: 'Test concurrent matches and server stability',
      preconditions: 'Multiple lobbies created',
      steps: [
        'Launch 5 concurrent matches',
        'Monitor server performance',
        'Verify all matches run smoothly',
        'Check inter-match interference',
      ],
      expectedResult: 'Multiple matches run independently without interference',
      severity: 'MEDIUM',
      priority: 'P2',
      testType: 'Performance',
      module: 'Custom Lobby Integration',
      platform: input.platform || 'Cross-platform',
      tags: ['concurrency', 'scalability'],
    });

    testCases.push({
      title: 'Handle player disconnection and reconnection',
      preconditions: 'Match in progress',
      steps: [
        'Player disconnects',
        'Observe player marked as disconnected',
        'Player reconnects within timeout',
        'Player returns to match',
      ],
      expectedResult: 'Players can reconnect within timeout window, maintain progress',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Custom Lobby Integration',
      platform: input.platform || 'Cross-platform',
      tags: ['resilience', 'connectivity'],
    });
  }

  // Trim to appropriate count
  const targetCount = typeof input.testCount === 'number' ? input.testCount : 'Auto';
  if (targetCount === 'Auto') {
    return testCases.slice(0, Math.max(60, testCases.length));
  }
  if (typeof targetCount === 'number') {
    return testCases.slice(0, targetCount);
  }

  return testCases;
}

export async function analyzeVideoWithAI(videoPath: string): Promise<string> {
  try {
    // For now, return placeholder analysis
    // In production, you would send the video file to Gemini or use a video analysis service
    const analysis = `Video analysis placeholder. In production, this would contain:
- UI element detection and analysis
- User interaction patterns
- Potential test scenarios
- Edge cases identified
- Performance metrics`;

    return analysis;
  } catch (error) {
    console.error('Error analyzing video with AI:', error);
    throw error;
  }
}
